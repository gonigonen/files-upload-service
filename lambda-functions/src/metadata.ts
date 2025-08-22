import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

// Initialize AWS clients
const dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

/**
 * Main Lambda handler for metadata retrieval
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log('Metadata retrieval event:', JSON.stringify(event, null, 2));
    
    try {
        // Extract file_id from path parameters
        const fileId = event.pathParameters?.file_id;
        
        if (!fileId) {
            return createErrorResponse(400, 'Missing file_id parameter');
        }

        // Retrieve metadata from DynamoDB
        const result = await docClient.send(new GetCommand({
            TableName: process.env.DYNAMODB_TABLE_NAME!,
            Key: {
                file_id: fileId
            }
        }));

        if (!result.Item) {
            return createErrorResponse(404, 'File not found', { file_id: fileId });
        }

        // Return the metadata
        return createSuccessResponse({
            file_id: fileId,
            metadata: result.Item
        });

    } catch (error) {
        console.error('Error retrieving metadata:', error);
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
        },
        body: JSON.stringify(responseBody)
    };
}
