const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

exports.handler = async (event) => {
    console.log('Upload event:', JSON.stringify(event, null, 2));
    
    try {
        // Parse the request body
        let body;
        if (event.isBase64Encoded) {
            body = JSON.parse(Buffer.from(event.body, 'base64').toString());
        } else {
            body = JSON.parse(event.body);
        }

        const { file_content, file_name, content_type, metadata } = body;
        
        // Validate required fields
        if (!file_content || !file_name || !content_type) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Missing required fields: file_content, file_name, content_type'
                })
            };
        }

        // Generate unique file ID
        const fileId = uuidv4();
        const s3Key = `uploads/${fileId}/${file_name}`;

        // Decode base64 file content
        const fileBuffer = Buffer.from(file_content, 'base64');

        // Upload file to S3
        const uploadParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: s3Key,
            Body: fileBuffer,
            ContentType: content_type,
            Metadata: {
                'original-name': file_name,
                'file-id': fileId,
                'upload-timestamp': new Date().toISOString()
            }
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        // Store user metadata in DynamoDB
        const userMetadata = metadata || {};
        const dbItem = {
            file_id: fileId,
            file_name: file_name,
            content_type: content_type,
            s3_key: s3Key,
            upload_date: new Date().toISOString(),
            file_size: fileBuffer.length,
            status: 'uploaded',
            user_metadata: userMetadata,
            // Add user-provided metadata fields directly
            ...userMetadata
        };

        await docClient.send(new PutCommand({
            TableName: process.env.DYNAMODB_TABLE_NAME,
            Item: dbItem
        }));

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                file_id: fileId,
                message: 'File uploaded successfully',
                s3_key: s3Key
            })
        };

    } catch (error) {
        console.error('Error uploading file:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};
