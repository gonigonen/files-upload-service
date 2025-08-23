import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { 
  createSuccessResponse, 
  createNotFoundError,
  createInternalError,
  createMissingParameterError,
} from './utils/responses';
import { createLogger, Logger } from './utils/logger';
import {
  FileMetadata,
  MetadataResponse
} from './types';

// Initialize AWS clients
const dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

// Initialize logger with AWS resource context
const baseLogger = createLogger({
    functionName: 'metadata',
    awsRegion: process.env.AWS_REGION,
    dynamoTable: process.env.DYNAMODB_TABLE_NAME
});

/**
 * Main Lambda handler for metadata retrieval
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const logger: Logger = baseLogger.addContext({ 
        requestId: event.requestContext.requestId,
        httpMethod: event.httpMethod,
        path: event.path
    });
    
    logger.info('Metadata retrieval request received');
    
    try {
        // Extract file_id from path parameters
        const fileId = event.pathParameters?.file_id;
        
        if (!fileId) {
            logger.warn('Missing file_id parameter');
            return createMissingParameterError('file_id');
        }

        logger.info('Retrieving metadata from DynamoDB', { fileId });

        // Retrieve metadata from DynamoDB
        const result = await docClient.send(new GetCommand({
            TableName: process.env.DYNAMODB_TABLE_NAME!,
            Key: {
                file_id: fileId
            }
        }));

        if (!result.Item) {
            logger.warn('File not found', { fileId });
            return createNotFoundError('File');
        }

        logger.info('Metadata retrieved successfully', { fileId });

        // Return the metadata
        return createSuccessResponse<MetadataResponse>({
            file_id: fileId,
            metadata: result.Item as FileMetadata
        });

    } catch (error) {
        logger.error('Error retrieving metadata', error as Error);
        return createInternalError(error as Error);
    }
};
