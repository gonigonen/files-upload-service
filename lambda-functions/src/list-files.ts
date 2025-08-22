import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

// Initialize AWS clients
const dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

// Types
interface FileListItem {
    file_id: string;
    file_name: string;
    upload_date: string;
    file_size: number;
    status: string;
    content_type?: string;
}

interface ListFilesResponse {
    files: FileListItem[];
    total_count: number;
}

/**
 * Main Lambda handler for listing all files
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log('List files event:', JSON.stringify(event, null, 2));
    
    try {
        // Get query parameters for pagination (optional)
        const limit = event.queryStringParameters?.limit ? 
            parseInt(event.queryStringParameters.limit) : 100;
        const lastEvaluatedKey = event.queryStringParameters?.lastKey;

        // Scan DynamoDB table to get all files
        const scanParams: any = {
            TableName: process.env.DYNAMODB_TABLE_NAME!,
            Limit: Math.min(limit, 100), // Cap at 100 items per request
            ProjectionExpression: 'file_id, file_name, upload_date, file_size, #status, content_type',
            ExpressionAttributeNames: {
                '#status': 'status'
            }
        };

        // Add pagination if provided
        if (lastEvaluatedKey) {
            try {
                scanParams.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastEvaluatedKey));
            } catch (error) {
                console.warn('Invalid lastKey parameter:', error);
            }
        }

        const result = await docClient.send(new ScanCommand(scanParams));

        // Format the response
        const files: FileListItem[] = (result.Items || []).map(item => ({
            file_id: item.file_id,
            file_name: item.file_name,
            upload_date: item.upload_date,
            file_size: item.file_size,
            status: item.status || 'unknown',
            content_type: item.content_type
        }));

        // Sort by upload date (newest first)
        files.sort((a, b) => new Date(b.upload_date).getTime() - new Date(a.upload_date).getTime());

        const response: ListFilesResponse = {
            files: files,
            total_count: result.Count || 0
        };

        // Add pagination info if there are more items
        if (result.LastEvaluatedKey) {
            (response as any).next_key = encodeURIComponent(JSON.stringify(result.LastEvaluatedKey));
        }

        return createSuccessResponse(response);

    } catch (error) {
        console.error('Error listing files:', error);
        return createErrorResponse(500, 'Internal server error', { 
            message: (error as Error).message 
        });
    }
};

/**
 * Create success response
 */
function createSuccessResponse(data: any): APIGatewayProxyResult {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,OPTIONS'
        },
        body: JSON.stringify(data)
    };
}

/**
 * Create error response
 */
function createErrorResponse(
    statusCode: number, 
    error: string, 
    additionalData?: any
): APIGatewayProxyResult {
    const responseBody: any = { error };
    
    if (additionalData) {
        Object.assign(responseBody, additionalData);
    }
    
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,OPTIONS'
        },
        body: JSON.stringify(responseBody)
    };
}
