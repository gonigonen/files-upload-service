import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  createFileSizeError,
  createValidationError,
  createInternalError,
  HTTP_STATUS,
  ERROR_MESSAGES 
} from './utils/responses';
import { createLogger } from './utils/logger';
import {
  FileData,
  ParsedMultipartData,
  MultipartPart,
  ValidationResult,
  UploadResponse,
  FileStatus,
  FILE_SIZE_LIMITS,
  S3_KEY_PATTERNS
} from './types';

// Initialize AWS clients
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

/**
 * Main Lambda handler for file upload
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const logger = createLogger({ 
        requestId: event.requestContext.requestId,
        functionName: 'upload'
    });
    
    logger.info('File upload request received', { 
        httpMethod: event.httpMethod,
        path: event.path 
    });
    
    try {
        // Parse multipart form data
        const { fileData, metadata } = await parseMultipartData(event);
        
        if (!fileData) {
            logger.warn('No file provided in request');
            return createErrorResponse(HTTP_STATUS.BAD_REQUEST, ERROR_MESSAGES.FILE_NOT_PROVIDED);
        }

        // Validate and process metadata
        const metadataValidation = validateMetadata(metadata);
        if (!metadataValidation.isValid) {
            logger.warn('Invalid metadata format', { errors: metadataValidation.errors });
            return createValidationError(metadataValidation.errors);
        }

        // Validate file size (max 10MB)
        if (fileData.content.length > FILE_SIZE_LIMITS.MAX_FILE_SIZE) {
            logger.warn('File too large', { 
                actualSize: fileData.content.length,
                maxSize: FILE_SIZE_LIMITS.MAX_FILE_SIZE 
            });
            return createFileSizeError(fileData.content.length, FILE_SIZE_LIMITS.MAX_FILE_SIZE);
        }

        // Generate unique file ID and S3 key
        const fileId = uuidv4();
        const s3Key = `${S3_KEY_PATTERNS.UPLOAD_PREFIX}${fileId}/${fileData.filename}`;

        logger.info('Processing file upload', { 
            fileId, 
            filename: fileData.filename,
            size: fileData.content.length,
            contentType: fileData.contentType
        });

        // Upload file to S3
        await uploadFileToS3(fileData, s3Key, fileId);

        // Store metadata in DynamoDB
        await storeMetadataInDynamoDB(fileId, fileData, s3Key, metadataValidation.cleanedMetadata);

        logger.info('File uploaded successfully', { fileId });

        return createSuccessResponse<UploadResponse>({
            file_id: fileId,
            message: 'File uploaded successfully',
            s3_key: s3Key,
            file_name: fileData.filename,
            file_size: fileData.content.length,
            metadata_fields_stored: Object.keys(metadataValidation.cleanedMetadata).length
        });

    } catch (error) {
        logger.error('Error uploading file', error as Error);
        return createInternalError(error as Error);
    }
};

/**
 * Upload file to S3 bucket
 */
async function uploadFileToS3(fileData: FileData, s3Key: string, fileId: string): Promise<void> {
    const uploadParams = {
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: s3Key,
        Body: fileData.content,
        ContentType: fileData.contentType,
        Metadata: {
            'original-name': fileData.filename,
            'file-id': fileId,
            'upload-timestamp': new Date().toISOString()
        }
    };

    await s3Client.send(new PutObjectCommand(uploadParams));
}

/**
 * Store file metadata in DynamoDB
 */
async function storeMetadataInDynamoDB(
    fileId: string, 
    fileData: FileData, 
    s3Key: string, 
    clientMetadata: Record<string, string | number | boolean>
): Promise<void> {
    const dbItem = {
        file_id: fileId,
        file_name: fileData.filename,
        content_type: fileData.contentType,
        s3_key: s3Key,
        upload_date: new Date().toISOString(),
        file_size: fileData.content.length,
        status: FileStatus.UPLOADED,
        client_metadata: clientMetadata
    };

    await docClient.send(new PutCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME!,
        Item: dbItem
    }));
}

/**
 * Parse multipart form data from API Gateway event
 */
async function parseMultipartData(event: APIGatewayProxyEvent): Promise<ParsedMultipartData> {
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    
    if (!contentType.includes('multipart/form-data')) {
        throw new Error('Content-Type must be multipart/form-data');
    }

    // Extract boundary from content-type header
    const boundaryMatch = contentType.match(/boundary=([^;]+)/);
    if (!boundaryMatch) {
        throw new Error('No boundary found in Content-Type header');
    }
    
    const boundary = boundaryMatch[1];
    const body = event.isBase64Encoded ? 
        Buffer.from(event.body!, 'base64') : 
        Buffer.from(event.body!, 'utf8');

    const parts = parseMultipartBody(body, boundary);
    
    let fileData: FileData | null = null;
    const metadata: Record<string, string | number | boolean> = {};

    for (const part of parts) {
        console.log(`Processing part: name=${part.name}, filename=${part.filename}`);
        
        if (part.name === 'file') {
            fileData = {
                filename: part.filename || 'unnamed_file',
                contentType: part.contentType || 'application/octet-stream',
                content: part.data
            };
            console.log(`File data created: filename=${fileData.filename}, contentType=${fileData.contentType}, size=${fileData.content.length}`);
        } else if (part.name && part.data) {
            // All other fields are treated as metadata
            const value = part.data.toString('utf8').trim();
            
            // Try to parse as number if it looks like one
            if (/^\d+(\.\d+)?$/.test(value)) {
                metadata[part.name] = parseFloat(value);
            } else if (value.toLowerCase() === 'true') {
                metadata[part.name] = true;
            } else if (value.toLowerCase() === 'false') {
                metadata[part.name] = false;
            } else {
                metadata[part.name] = value;
            }
        }
    }

    return { fileData, metadata };
}

/**
 * Parse multipart body into parts
 */
function parseMultipartBody(body: Buffer, boundary: string): MultipartPart[] {
    const parts: MultipartPart[] = [];
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const endBoundaryBuffer = Buffer.from(`--${boundary}--`);
    
    let start = 0;
    let end = body.indexOf(boundaryBuffer, start);
    
    while (end !== -1) {
        if (start > 0) {
            const partData = body.slice(start, end);
            const part = parseMultipartPart(partData);
            if (part) {
                parts.push(part);
            }
        }
        
        start = end + boundaryBuffer.length;
        
        // Check for end boundary
        if (body.indexOf(endBoundaryBuffer, start) === start) {
            break;
        }
        
        end = body.indexOf(boundaryBuffer, start);
    }
    
    return parts;
}

/**
 * Parse individual multipart part
 */
function parseMultipartPart(partData: Buffer): MultipartPart | null {
    const headerEndIndex = partData.indexOf('\r\n\r\n');
    if (headerEndIndex === -1) {
        return null;
    }
    
    const headerSection = partData.slice(0, headerEndIndex).toString('utf8');
    const dataSection = partData.slice(headerEndIndex + 4);
    
    // Remove trailing \r\n
    const data = dataSection.slice(0, -2);
    
    console.log('Parsing multipart header:', headerSection);
    
    // Parse Content-Disposition header with multiple patterns for better compatibility
    let name: string | undefined;
    let filename: string | undefined;
    
    // Pattern 1: Standard quoted format
    let dispositionMatch = headerSection.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?/i);
    
    if (dispositionMatch) {
        name = dispositionMatch[1];
        filename = dispositionMatch[2];
    } else {
        // Pattern 2: Unquoted format
        dispositionMatch = headerSection.match(/Content-Disposition:\s*form-data;\s*name=([^;,\s]+)(?:;\s*filename=([^;,\s]+))?/i);
        if (dispositionMatch) {
            name = dispositionMatch[1].replace(/"/g, '');
            filename = dispositionMatch[2] ? dispositionMatch[2].replace(/"/g, '') : undefined;
        } else {
            // Pattern 3: Mixed format (name quoted, filename unquoted or vice versa)
            const nameMatch = headerSection.match(/name=(?:"([^"]+)"|([^;,\s]+))/i);
            const filenameMatch = headerSection.match(/filename=(?:"([^"]+)"|([^;,\s]+))/i);
            
            if (nameMatch) {
                name = nameMatch[1] || nameMatch[2];
                if (filenameMatch) {
                    filename = filenameMatch[1] || filenameMatch[2];
                }
            }
        }
    }
    
    if (!name) {
        console.log('Could not parse name from Content-Disposition header');
        return null;
    }
    
    // Parse Content-Type header
    const contentTypeMatch = headerSection.match(/Content-Type:\s*([^\r\n]+)/i);
    const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : undefined;
    
    console.log(`Parsed part - name: ${name}, filename: ${filename}, contentType: ${contentType}`);
    
    return {
        name: name.trim(),
        filename: filename ? filename.trim() : undefined,
        contentType,
        data
    };
}

/**
 * Validates metadata object to ensure all values are strings, numbers, or booleans
 */
function validateMetadata(metadata: Record<string, string | number | boolean>): ValidationResult {
    const errors: string[] = [];
    const cleanedMetadata: Record<string, string | number | boolean> = {};
    
    // Check if metadata is an object
    if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
        return {
            isValid: true, // Empty metadata is valid
            errors: [],
            cleanedMetadata: {}
        };
    }
    
    // Validate each field
    for (const [key, value] of Object.entries(metadata)) {
        // Check key format
        if (typeof key !== 'string' || key.trim() === '') {
            errors.push(`Invalid key: "${key}" - keys must be non-empty strings`);
            continue;
        }
        
        // Sanitize key (remove special characters except underscore, convert to lowercase)
        const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
        
        // Check value type
        if (typeof value === 'string') {
            const trimmedValue = value.trim();
            if (trimmedValue === '') {
                errors.push(`Empty string value for key: "${key}"`);
                continue;
            }
            cleanedMetadata[sanitizedKey] = trimmedValue;
        } else if (typeof value === 'number') {
            if (!isFinite(value)) {
                errors.push(`Invalid number value for key: "${key}" - must be a finite number`);
                continue;
            }
            cleanedMetadata[sanitizedKey] = value;
        } else if (typeof value === 'boolean') {
            cleanedMetadata[sanitizedKey] = value;
        } else {
            errors.push(`Invalid value type for key: "${key}" - must be string, number, or boolean`);
        }
    }
    
    // Check for too many fields
    if (Object.keys(metadata).length > 50) {
        errors.push('Too many metadata fields - maximum 50 allowed');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors,
        cleanedMetadata: cleanedMetadata
    };
}
