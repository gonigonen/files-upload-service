const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

exports.handler = async (event) => {
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
            
            // Update DynamoDB with extracted metadata
            const updateParams = {
                TableName: process.env.DYNAMODB_TABLE_NAME,
                Key: {
                    file_id: fileId
                },
                UpdateExpression: 'SET #status = :status, #extracted_metadata = :metadata, #processing_date = :date',
                ExpressionAttributeNames: {
                    '#status': 'status',
                    '#extracted_metadata': 'extracted_metadata',
                    '#processing_date': 'processing_date'
                },
                ExpressionAttributeValues: {
                    ':status': 'processed',
                    ':metadata': extractedMetadata,
                    ':date': new Date().toISOString()
                }
            };
            
            await docClient.send(new UpdateCommand(updateParams));
            
            console.log(`Successfully processed file ${fileId}`);
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

async function extractFileMetadata(s3Object, fileName, fileSize) {
    const contentType = s3Object.ContentType || '';
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
    
    const metadata = {
        file_size: fileSize,
        content_type: contentType,
        file_extension: fileExtension,
        processing_timestamp: new Date().toISOString()
    };
    
    // Basic file type detection
    if (contentType.startsWith('image/')) {
        metadata.file_type = 'image';
        metadata.category = 'media';
        
        // For images, we could extract EXIF data, dimensions, etc.
        // This is a simplified implementation
        if (contentType.includes('jpeg') || contentType.includes('jpg')) {
            metadata.format = 'JPEG';
        } else if (contentType.includes('png')) {
            metadata.format = 'PNG';
        } else if (contentType.includes('gif')) {
            metadata.format = 'GIF';
        }
        
    } else if (contentType === 'application/pdf' || fileExtension === 'pdf') {
        metadata.file_type = 'pdf';
        metadata.category = 'document';
        
        // For PDFs, we could extract page count, text content, etc.
        // This would require additional libraries like pdf-parse
        metadata.estimated_pages = Math.ceil(fileSize / 50000); // Rough estimate
        
    } else if (contentType.startsWith('text/')) {
        metadata.file_type = 'text';
        metadata.category = 'document';
        
        // For text files, we could extract line count, word count, etc.
        if (fileSize > 0) {
            metadata.estimated_lines = Math.ceil(fileSize / 50); // Rough estimate
        }
        
    } else if (contentType.startsWith('video/')) {
        metadata.file_type = 'video';
        metadata.category = 'media';
        
    } else if (contentType.startsWith('audio/')) {
        metadata.file_type = 'audio';
        metadata.category = 'media';
        
    } else {
        metadata.file_type = 'unknown';
        metadata.category = 'other';
    }
    
    // Add file size category
    if (fileSize < 1024 * 1024) { // < 1MB
        metadata.size_category = 'small';
    } else if (fileSize < 10 * 1024 * 1024) { // < 10MB
        metadata.size_category = 'medium';
    } else if (fileSize < 100 * 1024 * 1024) { // < 100MB
        metadata.size_category = 'large';
    } else {
        metadata.size_category = 'very_large';
    }
    
    return metadata;
}
