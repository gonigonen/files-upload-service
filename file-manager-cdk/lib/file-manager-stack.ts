import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';

export class FileManagerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create S3 bucket for file storage
    const bucket = new s3.Bucket(this, 'FileManagerBucket', {
      bucketName: `file-manager-${this.account}-${this.region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
            s3.HttpMethods.DELETE,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    // Create DynamoDB table for file metadata
    const metadataTable = new dynamodb.Table(this, 'FileMetadataTable', {
      tableName: 'file-metadata',
      partitionKey: { name: 'file_id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Create Lambda function for file upload
    const uploadFunction = new lambda.Function(this, 'UploadFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'upload.handler',
      code: lambda.Code.fromAsset('../lambda-functions/dist'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        DYNAMODB_TABLE_NAME: metadataTable.tableName,
        S3_BUCKET_NAME: bucket.bucketName,
      },
    });

    // Create Lambda function for listing files
    const listFilesFunction = new lambda.Function(this, 'ListFilesFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'list-files.handler',
      code: lambda.Code.fromAsset('../lambda-functions/dist'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        DYNAMODB_TABLE_NAME: metadataTable.tableName,
      },
    });

    // Create Lambda function for metadata retrieval
    const metadataFunction = new lambda.Function(this, 'MetadataFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'metadata.handler',
      code: lambda.Code.fromAsset('../lambda-functions/dist'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        DYNAMODB_TABLE_NAME: metadataTable.tableName,
      },
    });

    // Create Lambda function for file processing
    const processorFunction = new lambda.Function(this, 'ProcessorFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'processor.handler',
      code: lambda.Code.fromAsset('../lambda-functions/dist'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        DYNAMODB_TABLE_NAME: metadataTable.tableName,
        S3_BUCKET_NAME: bucket.bucketName,
      },
    });

    // Grant permissions
    bucket.grantReadWrite(uploadFunction);
    bucket.grantRead(processorFunction);
    metadataTable.grantReadWriteData(uploadFunction);
    metadataTable.grantReadData(listFilesFunction);
    metadataTable.grantReadData(metadataFunction);
    metadataTable.grantReadWriteData(processorFunction);

    // Add S3 event notification to trigger processor function
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(processorFunction),
      { prefix: 'uploads/' }
    );

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'FileManagerApi', {
      restApiName: 'File Manager Service',
      description: 'API for file upload and management demo',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    // Add API Gateway endpoints
    api.root.addResource('upload').addMethod('POST', new apigateway.LambdaIntegration(uploadFunction));
    api.root.addResource('files').addMethod('GET', new apigateway.LambdaIntegration(listFilesFunction));
    
    const metadataResource = api.root.addResource('metadata');
    metadataResource.addResource('{file_id}').addMethod('GET', new apigateway.LambdaIntegration(metadataFunction));

    // Output the API Gateway URL
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'API Gateway endpoint URL for File Manager Service',
    });

    // Output the S3 bucket name
    new cdk.CfnOutput(this, 'S3BucketName', {
      value: bucket.bucketName,
      description: 'S3 bucket name for file storage',
    });

    // Output the DynamoDB table name
    new cdk.CfnOutput(this, 'DynamoDBTableName', {
      value: metadataTable.tableName,
      description: 'DynamoDB table name for file metadata',
    });
  }
}
