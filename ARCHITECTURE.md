# File Upload Service Architecture

## Overview

This serverless file upload service provides a complete solution for uploading files with metadata, automatic metadata extraction, and retrieval capabilities. The architecture follows AWS best practices for serverless applications.

## Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │───▶│  API Gateway    │───▶│ Upload Lambda   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   DynamoDB      │◀───│      S3         │
                       │   (Metadata)    │    │   (Files)       │
                       └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Metadata Lambda │◀───│Processing Lambda│
                       │  (Retrieval)    │    │  (Extraction)   │
                       └─────────────────┘    └─────────────────┘
```

## Components

### 1. API Gateway
- **Purpose**: RESTful API endpoints
- **Endpoints**:
  - `POST /upload` - File upload with metadata
  - `GET /metadata/{file_id}` - Retrieve file metadata
- **Features**:
  - CORS enabled
  - Request/response validation
  - Rate limiting (configurable)
  - CloudWatch logging

### 2. Lambda Functions

#### Upload Lambda (`upload.js`)
- **Trigger**: API Gateway POST /upload
- **Purpose**: Handle file uploads and store user metadata
- **Process**:
  1. Validate request payload
  2. Generate unique file ID (UUID)
  3. Decode base64 file content
  4. Upload file to S3
  5. Store initial metadata in DynamoDB
  6. Return file ID and S3 key

#### Processing Lambda (`processor.js`)
- **Trigger**: S3 Object Created event
- **Purpose**: Extract metadata from uploaded files
- **Process**:
  1. Receive S3 event notification
  2. Download file from S3
  3. Extract metadata based on file type
  4. Update DynamoDB with extracted metadata
  5. Mark file as "processed"

#### Metadata Retrieval Lambda (`metadata.js`)
- **Trigger**: API Gateway GET /metadata/{file_id}
- **Purpose**: Retrieve complete file metadata
- **Process**:
  1. Extract file_id from path parameters
  2. Query DynamoDB for metadata
  3. Return complete metadata object

### 3. Amazon S3
- **Purpose**: File storage
- **Configuration**:
  - Private bucket with unique naming
  - Event notifications to trigger processing
  - CORS configuration for web uploads
  - Lifecycle policies (optional)
- **Structure**: `uploads/{file_id}/{filename}`

### 4. Amazon DynamoDB
- **Purpose**: Metadata storage
- **Table**: `file-metadata`
- **Partition Key**: `file_id` (String)
- **Attributes**:
  - User metadata (author, expiration_date, etc.)
  - System metadata (upload_date, file_size, status)
  - Extracted metadata (file_type, category, etc.)

## Data Flow

### Upload Flow
1. Client encodes file as base64
2. Client sends POST request to `/upload` with file and metadata
3. Upload Lambda validates request
4. Upload Lambda stores file in S3
5. Upload Lambda stores user metadata in DynamoDB
6. S3 triggers Processing Lambda via event notification
7. Processing Lambda extracts additional metadata
8. Processing Lambda updates DynamoDB with extracted metadata

### Retrieval Flow
1. Client sends GET request to `/metadata/{file_id}`
2. Metadata Lambda queries DynamoDB
3. Complete metadata returned to client

## Security

### IAM Permissions
- **Upload Lambda**: S3 PutObject, DynamoDB PutItem
- **Processing Lambda**: S3 GetObject, DynamoDB UpdateItem
- **Metadata Lambda**: DynamoDB GetItem

### Data Protection
- Files stored in private S3 bucket
- Unique file IDs prevent enumeration
- API Gateway with CORS restrictions
- Input validation and sanitization

## Monitoring

### CloudWatch Logs
- `/aws/lambda/FileUploadStack-FileUploadFunction-*`
- `/aws/lambda/FileUploadStack-MetadataRetrievalFunction-*`
- `/aws/lambda/FileUploadStack-FileProcessingFunction-*`

### Metrics
- API Gateway request count and latency
- Lambda invocation count and duration
- DynamoDB read/write capacity
- S3 storage and requests

## Scalability

### Automatic Scaling
- Lambda functions scale automatically
- DynamoDB on-demand billing scales with usage
- S3 handles unlimited storage

### Performance Optimization
- DynamoDB single-table design for fast queries
- Lambda memory allocation optimized per function
- S3 event notifications for real-time processing

## Cost Optimization

### Pay-per-use Model
- Lambda: Pay per invocation and duration
- DynamoDB: Pay per request (on-demand)
- S3: Pay for storage and requests
- API Gateway: Pay per API call

### Optimization Strategies
- Right-sized Lambda memory allocation
- DynamoDB on-demand billing mode
- S3 Intelligent Tiering for long-term storage
- CloudWatch log retention policies

## Deployment

### Infrastructure as Code
- AWS CDK for infrastructure definition
- TypeScript for type safety
- Automated deployment script
- Environment-specific configurations

### CI/CD Ready
- Separate environments (dev, staging, prod)
- Automated testing capabilities
- Blue/green deployment support
- Rollback capabilities

## Error Handling

### Lambda Functions
- Try-catch blocks with proper error logging
- Graceful degradation
- Retry logic for transient failures

### API Gateway
- HTTP status codes
- Structured error responses
- Request validation

### Monitoring
- CloudWatch alarms for error rates
- Dead letter queues for failed processing
- X-Ray tracing (optional)

## Future Enhancements

### Advanced Metadata Extraction
- PDF text extraction with AWS Textract
- Image analysis with Amazon Rekognition
- Video analysis with Amazon Transcribe

### Additional Features
- File versioning
- Bulk upload support
- File sharing and permissions
- Search capabilities with Amazon OpenSearch

### Performance
- CloudFront for global distribution
- ElastiCache for metadata caching
- S3 Transfer Acceleration
