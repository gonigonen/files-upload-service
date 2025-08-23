import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { 
  createSuccessResponse, 
  createInternalError,
} from './utils/responses';
import { createLogger } from './utils/logger';
import {
  FileListItem,
  ListFilesResponse,
  FileStatus,
  isValidFileStatus
} from './types';

// Initialize AWS clients
const dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

/**
 * Main Lambda handler for listing all files
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const logger = createLogger({ 
        requestId: event.requestContext.requestId,
        functionName: 'list-files'
    });
    
    logger.info('List files request received');
    
    try {
        // Get query parameters for pagination (optional)
        const limit = event.queryStringParameters?.limit ? 
            parseInt(event.queryStringParameters.limit) : 100;
        const lastEvaluatedKey = event.queryStringParameters?.lastKey;

        logger.info('Scanning DynamoDB for files', { limit, hasLastKey: !!lastEvaluatedKey });

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
                logger.warn('Invalid lastKey parameter', error as Error);
            }
        }

        const result = await docClient.send(new ScanCommand(scanParams));

        // Format the response
        const files: FileListItem[] = (result.Items || []).map(item => ({
            file_id: item.file_id,
            file_name: item.file_name,
            upload_date: item.upload_date,
            file_size: item.file_size,
            status: isValidFileStatus(item.status) ? item.status : FileStatus.UPLOADED,
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
            response.next_key = encodeURIComponent(JSON.stringify(result.LastEvaluatedKey));
        }

        logger.info('Files retrieved successfully', { 
            count: files.length,
            hasNextKey: !!response.next_key 
        });

        return createSuccessResponse<ListFilesResponse>(response);

    } catch (error) {
        logger.error('Error listing files', error as Error);
        return createInternalError(error as Error);
    }
};
