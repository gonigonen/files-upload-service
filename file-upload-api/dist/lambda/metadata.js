const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

exports.handler = async (event) => {
    console.log('Metadata retrieval event:', JSON.stringify(event, null, 2));
    
    try {
        // Extract file_id from path parameters
        const fileId = event.pathParameters?.file_id;
        
        if (!fileId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Missing file_id parameter'
                })
            };
        }

        // Retrieve metadata from DynamoDB
        const result = await docClient.send(new GetCommand({
            TableName: process.env.DYNAMODB_TABLE_NAME,
            Key: {
                file_id: fileId
            }
        }));

        if (!result.Item) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'File not found',
                    file_id: fileId
                })
            };
        }

        // Return the metadata
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                file_id: fileId,
                metadata: result.Item
            })
        };

    } catch (error) {
        console.error('Error retrieving metadata:', error);
        
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
