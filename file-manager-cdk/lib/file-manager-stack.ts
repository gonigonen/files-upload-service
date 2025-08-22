import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
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

    // Lambda function for file upload API
    const uploadLambda = new lambda.Function(this, 'FileUploadFunction', {
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

    // Lambda function for metadata retrieval API
    const metadataLambda = new lambda.Function(this, 'MetadataRetrievalFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'metadata.handler',
      code: lambda.Code.fromAsset('../lambda-functions/dist'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        DYNAMODB_TABLE_NAME: metadataTable.tableName,
      },
    });

    // Lambda function for listing files API
    const listFilesLambda = new lambda.Function(this, 'ListFilesFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'list-files.handler',
      code: lambda.Code.fromAsset('../lambda-functions/dist'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        DYNAMODB_TABLE_NAME: metadataTable.tableName,
      },
    });

    // Lambda function for processing uploaded files (metadata extraction)
    const processingLambda = new lambda.Function(this, 'FileProcessingFunction', {
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
    bucket.grantReadWrite(uploadLambda);
    bucket.grantRead(processingLambda);
    metadataTable.grantReadWriteData(uploadLambda);
    metadataTable.grantReadData(metadataLambda);
    metadataTable.grantReadData(listFilesLambda);
    metadataTable.grantReadWriteData(processingLambda);

    // S3 event notification to trigger processing Lambda
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(processingLambda)
    );

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'FileManagerApi', {
      restApiName: 'File Manager Service',
      description: 'API for file management and metadata operations',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
      },
    });

    // Upload endpoint
    const uploadIntegration = new apigateway.LambdaIntegration(uploadLambda);
    api.root.addResource('upload').addMethod('POST', uploadIntegration);

    // Files endpoint for listing
    const filesIntegration = new apigateway.LambdaIntegration(listFilesLambda);
    api.root.addResource('files').addMethod('GET', filesIntegration);

    // Metadata endpoint
    const metadataResource = api.root.addResource('metadata');
    const metadataIntegration = new apigateway.LambdaIntegration(metadataLambda);
    metadataResource.addResource('{file_id}').addMethod('GET', metadataIntegration);

    // Output the API Gateway URL
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    // Output the S3 bucket name
    new cdk.CfnOutput(this, 'S3BucketName', {
      value: bucket.bucketName,
      description: 'S3 Bucket Name',
    });

    // Output the DynamoDB table name
    new cdk.CfnOutput(this, 'DynamoDBTableName', {
      value: metadataTable.tableName,
      description: 'DynamoDB Table Name',
    });
  }
}
