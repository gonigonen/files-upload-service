import { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Initialize AWS clients
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

// Types
interface ExtractedMetadata {
    file_size: number;
    content_type: string;
    file_extension: string;
    processing_timestamp: string;
    file_type: string;
    category: string;
    size_category: string;
    format?: string;
    estimated_pages?: number;
    estimated_lines?: number;
}

/**
 * Main Lambda handler for file processing and metadata extraction
 */
export const handler = async (event: S3Event): Promise<any> => {
    console.log('File processing event:', JSON.stringify(event, null, 2));
    
    try {
        // Process each S3 event record
        for (const record of event.Records) {
            const bucketName = record.s3.bucket.name;
            const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
            const objectSize = record.s3.object.size;
            
            console.log(`Processing file: ${objectKey} (${objectSize} bytes)`);
            
            // Extract file_id from S3 key (assuming format: uploads/{file_id}/{filename})
            const keyParts = objectKey.split('/');
            if (keyParts.length < 3 || keyParts[0] !== 'uploads') {
                console.log('Skipping file - not in expected format');
                continue;
            }
            
            const fileId = keyParts[1];
            const fileName = keyParts.slice(2).join('/');
            
            // Get file from S3 to analyze
            const s3Object = await s3Client.send(new GetObjectCommand({
                Bucket: bucketName,
                Key: objectKey
            }));
            
            // Extract metadata based on file type
            const extractedMetadata = await extractFileMetadata(s3Object, fileName, objectSize);
            
            // Update DynamoDB with flattened extracted metadata
            await updateDynamoDBWithMetadata(fileId, extractedMetadata);
            
            console.log(`Successfully processed file ${fileId} with extracted metadata:`, extractedMetadata);
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Files processed successfully'
            })
        };
        
    } catch (error) {
        console.error('Error processing file:', error);
        throw error;
    }
};

/**
 * Update DynamoDB with flattened extracted metadata
 */
async function updateDynamoDBWithMetadata(fileId: string, extractedMetadata: ExtractedMetadata): Promise<void> {
    // Build update expression for flattened metadata
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};
    
    // Add status and processing_date
    updateExpressions.push('#status = :status');
    updateExpressions.push('#processing_date = :processing_date');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeNames['#processing_date'] = 'processing_date';
    expressionAttributeValues[':status'] = 'processed';
    expressionAttributeValues[':processing_date'] = new Date().toISOString();
    
    // Add each extracted metadata field as individual column
    Object.entries(extractedMetadata).forEach(([key, value]) => {
        const attrName = `#extracted_${key}`;
        const attrValue = `:extracted_${key}`;
        
        updateExpressions.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = `extracted_${key}`;
        expressionAttributeValues[attrValue] = value;
    });
    
    // Update DynamoDB with flattened extracted metadata
    const updateParams = {
        TableName: process.env.DYNAMODB_TABLE_NAME!,
        Key: {
            file_id: fileId
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues
    };
    
    await docClient.send(new UpdateCommand(updateParams));
}

/**
 * Extract metadata from file based on its type and content
 */
async function extractFileMetadata(s3Object: any, fileName: string, fileSize: number): Promise<ExtractedMetadata> {
    const contentType = s3Object.ContentType || '';
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
    
    const metadata: ExtractedMetadata = {
        file_size: fileSize,
        content_type: contentType,
        file_extension: fileExtension,
        processing_timestamp: new Date().toISOString(),
        file_type: 'unknown',
        category: 'other',
        size_category: getSizeCategory(fileSize)
    };
    
    // Basic file type detection and metadata extraction
    if (contentType.startsWith('image/')) {
        metadata.file_type = 'image';
        metadata.category = 'media';
        
        if (contentType.includes('jpeg') || contentType.includes('jpg')) {
            metadata.format = 'JPEG';
        } else if (contentType.includes('png')) {
            metadata.format = 'PNG';
        } else if (contentType.includes('gif')) {
            metadata.format = 'GIF';
        } else if (contentType.includes('webp')) {
            metadata.format = 'WebP';
        } else if (contentType.includes('svg')) {
            metadata.format = 'SVG';
        }
        
    } else if (contentType === 'application/pdf' || fileExtension === 'pdf') {
        metadata.file_type = 'pdf';
        metadata.category = 'document';
        
        // Rough estimate of pages based on file size
        // This is a simplified approach - for accurate page count, you'd need a PDF parsing library
        metadata.estimated_pages = Math.max(1, Math.ceil(fileSize / 50000));
        
    } else if (contentType.startsWith('text/') || ['txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(fileExtension)) {
        metadata.file_type = 'text';
        metadata.category = 'document';
        
        // Rough estimate of lines based on file size
        if (fileSize > 0) {
            metadata.estimated_lines = Math.max(1, Math.ceil(fileSize / 50));
        }
        
    } else if (contentType.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(fileExtension)) {
        metadata.file_type = 'video';
        metadata.category = 'media';
        
        if (contentType.includes('mp4') || fileExtension === 'mp4') {
            metadata.format = 'MP4';
        } else if (contentType.includes('webm') || fileExtension === 'webm') {
            metadata.format = 'WebM';
        } else if (fileExtension === 'avi') {
            metadata.format = 'AVI';
        }
        
    } else if (contentType.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(fileExtension)) {
        metadata.file_type = 'audio';
        metadata.category = 'media';
        
        if (contentType.includes('mpeg') || fileExtension === 'mp3') {
            metadata.format = 'MP3';
        } else if (contentType.includes('wav') || fileExtension === 'wav') {
            metadata.format = 'WAV';
        } else if (fileExtension === 'flac') {
            metadata.format = 'FLAC';
        }
        
    } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(fileExtension)) {
        metadata.file_type = 'office';
        metadata.category = 'document';
        
        if (['doc', 'docx'].includes(fileExtension)) {
            metadata.format = 'Word Document';
        } else if (['xls', 'xlsx'].includes(fileExtension)) {
            metadata.format = 'Excel Spreadsheet';
        } else if (['ppt', 'pptx'].includes(fileExtension)) {
            metadata.format = 'PowerPoint Presentation';
        }
        
    } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(fileExtension)) {
        metadata.file_type = 'archive';
        metadata.category = 'compressed';
        metadata.format = fileExtension.toUpperCase();
    }
    
    return metadata;
}

/**
 * Determine file size category
 */
function getSizeCategory(fileSize: number): string {
    if (fileSize < 1024 * 1024) { // < 1MB
        return 'small';
    } else if (fileSize < 10 * 1024 * 1024) { // < 10MB
        return 'medium';
    } else if (fileSize < 100 * 1024 * 1024) { // < 100MB
        return 'large';
    } else {
        return 'very_large';
    }
}
