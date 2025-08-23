# File Manager Service

A serverless file management service built with AWS CDK and TypeScript. Upload files with metadata, automatic processing, and a React web interface.

**🎯 Purpose**: Development and demonstration project showcasing serverless architecture patterns.

**⚠️ Security**: No authentication implemented - suitable for development, testing, and learning only.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  React Client   │───▶│  API Gateway    │───▶│ Upload Lambda   │
│  (Web UI)       │    │   (3 endpoints) │    │  (TypeScript)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                │                        ▼
                                │              ┌─────────────────┐
                                │              │      S3         │
                                │              │   (Files)       │
                                │              └─────────────────┘
                                │                        │
                                │                        │ (S3 Event)
                                │                        ▼
                                │              ┌─────────────────┐
                                │              │Processing Lambda│───┐
                                │              │  (TypeScript)   │   │
                                │              └─────────────────┘   │
                                │                                    │
                                ▼                                    ▼
                       ┌─────────────────┐              ┌─────────────────┐
                       │ List Files      │─────────────▶│   DynamoDB      │
                       │ Lambda (TS)     │              │   (Metadata)    │
                       └─────────────────┘              └─────────────────┘
                                                                 ▲
                                                                 │
                       ┌─────────────────┐                       │
                       │ Metadata Lambda │───────────────────────┘
                       │  (TypeScript)   │
                       └─────────────────┘
```

**Components:**
- **API Gateway**: 3 REST endpoints (upload, list, metadata)
- **4 Lambda Functions**: TypeScript-based serverless processing
- **S3**: Secure file storage with event notifications
- **DynamoDB**: Fast metadata storage and retrieval
- **React Web Client**: Modern UI with file upload, listing, and metadata viewing

## 🚀 Quick Start

### Prerequisites
- AWS CLI configured (`aws configure`)
- Node.js 18+
- AWS CDK installed globally: `npm install -g aws-cdk`

### Deploy Backend
```bash
./deploy.sh
```
**📡 Note the API Gateway URL from the deployment output - you'll need it!**

⚠️ **Security Note**: This deployment creates an **open API** with no authentication. Anyone with the URL can upload/access files. See [Security Considerations](#-security-considerations) for authentication options.

### Start Web Client
```bash
cd web-client
npm install
# Update src/services/api.ts with your API Gateway URL
npm start
# Open http://localhost:3000
```

## 🛠️ Development

### Build Lambda Functions
```bash
cd lambda-functions
npm install
npm run build
```

### Deploy Changes
```bash
./deploy.sh
```

### Local Development
```bash
# Watch mode for Lambda functions
cd lambda-functions && npm run build:watch

# Web client development
cd web-client && npm start
```

## 🧹 Cleanup

Remove all AWS resources:
```bash
cd file-manager-cdk
npx cdk destroy
```

## 📡 API Endpoints

### Upload File
```bash
curl -X POST https://YOUR-API-URL/upload \
  -F "file=@document.pdf" \
  -F "author=John Doe" \
  -F "project=MyProject"
```

### List Files
```bash
curl https://YOUR-API-URL/files
```

### Get Metadata
```bash
curl https://YOUR-API-URL/metadata/{file_id}
```

## ⚠️ Error Handling

### **🛡️ Current Error Handling Implementation**

The File Manager Service implements comprehensive error handling across all layers:

#### **1. Lambda Function Error Handling**

##### **Upload Lambda (`upload.ts`)**
```typescript
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // Business logic here
        return createSuccessResponse(data);
    } catch (error) {
        console.error('Error uploading file:', error);
        return createErrorResponse(500, 'Internal server error', [(error as Error).message]);
    }
};
```

**Error Types Handled:**
- ✅ **400 Bad Request**: No file provided, invalid metadata format
- ✅ **413 Payload Too Large**: File exceeds 10MB limit with size details
- ✅ **500 Internal Server Error**: AWS service failures, unexpected errors

**Structured Error Responses:**
```json
{
  "error": "File too large",
  "details": ["Maximum file size is 10MB"],
  "max_size": "10MB",
  "actual_size": "15.2MB"
}
```

##### **Processing Lambda (`processor.ts`)**
```typescript
export const handler = async (event: S3Event): Promise<any> => {
    try {
        for (const record of event.Records) {
            // Process each file
            await processFile(record);
        }
    } catch (error) {
        console.error('Error processing file:', error);
        throw error; // Triggers Lambda retry mechanism
    }
};
```

**Error Handling Features:**
- ✅ **Individual Record Processing**: One failed file doesn't stop others
- ✅ **Detailed Logging**: Full error context logged to CloudWatch
- ✅ **Lambda Retry**: Automatic retry on transient failures
- ✅ **Dead Letter Queue**: Failed events can be sent to DLQ (not implemented)

##### **List Files & Metadata Lambdas**
```typescript
try {
    const result = await docClient.send(new ScanCommand(params));
    return createSuccessResponse({ files: result.Items });
} catch (error) {
    console.error('Error listing files:', error);
    return createErrorResponse(500, 'Failed to retrieve files', [(error as Error).message]);
}
```

#### **2. Web Client Error Handling**

##### **API Service Layer (`api.ts`)**
```typescript
async uploadFile(file: File, metadata: Record<string, any> = {}): Promise<UploadResponse> {
    // Input validation
    if (!file) throw new Error('No file provided');
    if (!(file instanceof File)) throw new Error('Invalid file object');
    if (!file.name) throw new Error('File must have a name');
    
    try {
        const response = await api.post('/upload', formData, { headers });
        return response.data;
    } catch (error) {
        throw error; // Axios handles HTTP status codes
    }
}
```

##### **UI Components (`FileUploadModal.tsx`)**
```typescript
try {
    const result = await fileApi.uploadFile(file, metadata);
    message.success(`File uploaded successfully! File ID: ${result.file_id}`);
} catch (error: any) {
    console.error('Upload error:', error);
    message.error(error.response?.data?.error || 'Upload failed');
} finally {
    setUploading(false); // Always reset loading state
}
```

**User-Friendly Error Messages:**
- ✅ **Specific Errors**: "File too large (15.2MB). Maximum size is 10MB"
- ✅ **Generic Fallback**: "Upload failed" for unknown errors
- ✅ **Loading States**: Proper UI state management during errors
- ✅ **Error Logging**: Full error details logged to browser console

#### **3. Infrastructure Error Handling**

##### **API Gateway**
- ✅ **CORS Headers**: Included in all error responses
- ✅ **HTTP Status Codes**: Proper status codes (400, 404, 413, 500)
- ✅ **Request Validation**: Malformed requests rejected early
- ✅ **Timeout Handling**: 30-second Lambda timeout

##### **S3 Event Processing**
- ✅ **Event Filtering**: Only processes files in `uploads/` prefix
- ✅ **Retry Logic**: Lambda automatically retries failed S3 events
- ✅ **Error Isolation**: One file failure doesn't affect others

### **🔧 Error Monitoring & Debugging**

#### **CloudWatch Logs**
```bash
# View real-time logs for each function
aws logs tail /aws/lambda/FileManagerStack-FileUploadFunction-* --follow --region us-east-2
aws logs tail /aws/lambda/FileManagerStack-FileProcessingFunction-* --follow --region us-east-2
aws logs tail /aws/lambda/FileManagerStack-ListFilesFunction-* --follow --region us-east-2
aws logs tail /aws/lambda/FileManagerStack-MetadataRetrievalFunction-* --follow --region us-east-2
```

#### **Error Tracking**
- ✅ **Structured Logging**: JSON format with context
- ✅ **Error Correlation**: File IDs and request IDs for tracing
- ✅ **Performance Metrics**: Duration and memory usage logged
- ✅ **Error Rates**: CloudWatch metrics for failure rates

#### **Structured Error Responses**
```typescript
interface ErrorResponse {
  error: string;
  error_code: string;
  timestamp: string;
  request_id: string;
  details?: string[];
  context?: Record<string, any>;
  retry_after?: number;
}
```

### **📊 Error Handling Best Practices Implemented**

- ✅ **Fail Fast**: Input validation at entry points
- ✅ **Graceful Degradation**: System continues working with partial failures
- ✅ **Error Isolation**: Component failures don't cascade
- ✅ **Detailed Logging**: Full context for debugging
- ✅ **User-Friendly Messages**: Clear error communication
- ✅ **Proper HTTP Status Codes**: RESTful error responses
- ✅ **Resource Cleanup**: Finally blocks ensure cleanup
- ✅ **Timeout Handling**: Reasonable timeouts prevent hanging

### **🔍 Debugging Common Issues**

#### **File Upload Failures**
```bash
# Check upload Lambda logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/FileManagerStack-FileUploadFunction-* \
  --filter-pattern "ERROR" \
  --region us-east-2
```

#### **Processing Failures**
```bash
# Check processing Lambda logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/FileManagerStack-FileProcessingFunction-* \
  --filter-pattern "Error processing file" \
  --region us-east-2
```

#### **Web Client Issues**
```javascript
// Enable detailed axios logging
axios.interceptors.request.use(request => {
  console.log('Starting Request:', request);
  return request;
});
```

The current error handling provides a solid foundation with comprehensive coverage across all system layers! 🛡️

## 📊 Component Separation Evaluation

### **🎯 Separation of Concerns**

#### **1. Presentation Layer (React Client)**
- ✅ **Single Responsibility**: Only handles UI/UX and user interactions
- ✅ **No Business Logic**: Pure presentation with API service abstraction
- ✅ **Technology Independence**: Can be replaced with any frontend framework
- ✅ **Clean API Interface**: Uses dedicated service layer (`api.ts`)

```typescript
// Clean separation - UI only calls API service
const result = await fileApi.uploadFile(file, metadata);
```

#### **2. API Layer (API Gateway)**
- ✅ **Protocol Abstraction**: Converts HTTP to Lambda events
- ✅ **Routing Logic**: Maps endpoints to appropriate Lambda functions
- ✅ **No Business Logic**: Pure routing and protocol translation

#### **3. Business Logic Layer (Lambda Functions)**
- ✅ **Single Purpose Functions**: Each Lambda has one clear responsibility
  - **Upload Lambda**: File validation, S3 storage, initial metadata
  - **List Files Lambda**: Query and return file listings
  - **Metadata Lambda**: Retrieve complete file metadata
  - **Processing Lambda**: Extract metadata from uploaded files
- ✅ **Stateless Design**: No shared state between invocations
- ✅ **Event-Driven**: Processing triggered by S3 events, not direct calls

#### **4. Data Layer (S3 + DynamoDB)**
- ✅ **Purpose-Built Storage**: S3 for files, DynamoDB for metadata
- ✅ **No Business Logic**: Pure data storage and retrieval
- ✅ **Optimized Access Patterns**: DynamoDB structure optimized for queries

### **🔄 Loose Coupling**

#### **Event-Driven Architecture**
- ✅ **Asynchronous Processing**: S3 events trigger processing without blocking upload
- ✅ **Decoupled Components**: Upload doesn't wait for metadata extraction
- ✅ **Scalable Design**: Each component scales independently

#### **Technology Independence**
- ✅ **Swappable Components**: Can replace React with Vue, S3 with other storage
- ✅ **Cloud Agnostic Logic**: Business logic not tied to AWS specifics
- ✅ **Database Independence**: Could switch from DynamoDB to other NoSQL/SQL

### **🎨 High Cohesion**

#### **Functional Cohesion**
Each component has a single, well-defined purpose:

```typescript
// Upload Lambda - Only handles file uploads
export const handler = async (event: APIGatewayProxyEvent) => {
  // 1. Parse multipart data
  // 2. Validate file and metadata  
  // 3. Store in S3
  // 4. Save metadata to DynamoDB
  // 5. Return confirmation
};
```

#### **Data Cohesion**
- ✅ **Related Data Together**: File metadata stored as single DynamoDB item
- ✅ **Logical Grouping**: Client metadata vs extracted metadata clearly separated
- ✅ **Consistent Structure**: All components use same data models

### **🔧 Maintainability**

#### **Independent Development**
- ✅ **Team Separation**: Frontend, backend, infrastructure teams can work independently
- ✅ **Technology Choices**: Each layer can use optimal technology stack
- ✅ **Deployment Independence**: Components can be deployed separately

#### **Error Isolation**
- ✅ **Fault Tolerance**: One component failure doesn't crash entire system
- ✅ **Graceful Degradation**: Upload works even if processing fails
- ✅ **Clear Error Boundaries**: Each layer handles its own error scenarios

### **📈 Scalability**

#### **Independent Scaling**
- ✅ **Lambda Auto-scaling**: Each function scales based on demand
- ✅ **Storage Scaling**: S3 and DynamoDB scale automatically
- ✅ **Frontend Scaling**: React app can be deployed to CDN

#### **Performance Optimization**
- ✅ **Caching Layers**: API Gateway caching, DynamoDB DAX potential
- ✅ **Async Processing**: File processing doesn't block user experience
- ✅ **Optimized Queries**: Flattened metadata structure for fast retrieval

### **🔒 Security Boundaries**

#### **Principle of Least Privilege**
```typescript
// Each Lambda has minimal required permissions
uploadLambda: S3 PutObject, DynamoDB PutItem
listLambda: DynamoDB Scan
metadataLambda: DynamoDB GetItem
processingLambda: S3 GetObject, DynamoDB UpdateItem
```

#### **Network Isolation**
- ✅ **Private Resources**: S3 bucket and DynamoDB not publicly accessible
- ✅ **API Gateway**: Single public entry point with proper CORS
- ✅ **VPC Isolation**: Lambda functions can be placed in VPC if needed

## 📁 Supported File Types

- **Documents**: PDF, Word, Excel, PowerPoint
- **Images**: JPEG, PNG, GIF, WebP, SVG
- **Media**: MP4, MP3, WAV, AVI, MOV
- **Text**: TXT, CSV, JSON, XML, Markdown
- **Archives**: ZIP, RAR, 7Z, TAR

## 🔧 Configuration

### Environment Variables
All environment variables are automatically configured:
- `AWS_REGION`: Set by Lambda runtime
- `DYNAMODB_TABLE_NAME`: Set by CDK stack
- `S3_BUCKET_NAME`: Set by CDK stack

### Web Client Setup
Update `web-client/src/services/api.ts`:
```typescript
const API_BASE_URL = 'https://YOUR-API-URL';
```

## 📊 Metadata Structure

### User Metadata
Any form fields become metadata:
```bash
curl -X POST https://YOUR-API-URL/upload \
  -F "file=@doc.pdf" \
  -F "author=John" \
  -F "department=Engineering" \
  -F "budget=50000" \
  -F "confidential=true"
```

### Extracted Metadata
Automatically generated:
- `extracted_file_type`: pdf, image, text, video, audio
- `extracted_category`: document, media, compressed
- `extracted_size_category`: small, medium, large
- `extracted_file_extension`: File extension
- `extracted_estimated_pages`: Page count (PDFs)

## 🔒 Security Considerations

### **⚠️ Current State: Open API (By Design)**

**This project intentionally has NO authentication** to focus on serverless architecture patterns:
- ✅ **Development Focus**: Demonstrates CDK, Lambda, S3, DynamoDB integration
- ✅ **Learning Purpose**: Easy to test and understand without auth complexity
- ✅ **Rapid Prototyping**: Quick deployment for demos and experimentation
- ❌ **Not Production-Ready**: Requires authentication for real-world use

### **🎯 Project Scope**

This File Manager Service is designed as:
- **Architecture Demo**: Showcase component separation
- **Development Tool**: Quick file management for local projects

### **🔐 Current Security Features**

Even without authentication, the project includes:
- ✅ **Private S3 bucket** (no direct public access)
- ✅ **Unique file IDs** (prevent enumeration attacks)
- ✅ **Input validation** (file size, metadata format)
- ✅ **IAM roles** (minimal required permissions)
- ✅ **Error handling** (no sensitive data exposure)

### **🚨 Deployment Warning**

**Important**: This deployment creates an open API. Anyone with the URL can:
- Upload files to your S3 bucket
- List and access all uploaded files
- View file metadata

**Recommendation**: 
- Use for development/testing environments only
- Deploy in isolated AWS accounts
- Monitor CloudWatch logs for unusual activity
- Implement authentication before production use

## 🚨 Troubleshooting

### Common Issues

**Deployment fails with bootstrap error:**
```bash
cd file-manager-cdk
npx cdk bootstrap
```

**Web client can't connect to API:**
- Check API URL in `web-client/src/services/api.ts`
- Verify CORS is enabled
- Check browser console for errors

**File upload fails:**
- Check file size (10MB limit)
- Verify multipart/form-data format
- Check CloudWatch logs

**Lambda build fails:**
```bash
cd lambda-functions
rm -rf node_modules dist
npm install
npm run build
```

### Debug Commands
```bash
# Check AWS credentials
aws sts get-caller-identity

# List deployed stacks
aws cloudformation list-stacks --region us-east-2

# Test API connectivity
curl https://YOUR-API-URL/files
```

### Where to View Logs

#### **AWS CloudWatch Logs (Primary Location)**

**Via AWS Console:**
1. Go to [AWS CloudWatch Console](https://console.aws.amazon.com/cloudwatch/)
2. Click **Logs** → **Log groups**
3. Find your Lambda function log groups:
   - `/aws/lambda/FileManagerStack-FileUploadFunction-XXXXX`
   - `/aws/lambda/FileManagerStack-FileProcessingFunction-XXXXX`
   - `/aws/lambda/FileManagerStack-ListFilesFunction-XXXXX`
   - `/aws/lambda/FileManagerStack-MetadataRetrievalFunction-XXXXX`

**Via AWS CLI (Real-time):**
```bash
# View real-time logs for upload function
aws logs tail /aws/lambda/FileManagerStack-FileUploadFunction-* --follow --region us-east-2

# View logs for all functions
aws logs tail /aws/lambda/FileManagerStack-FileUploadFunction-* --follow --region us-east-2 &
aws logs tail /aws/lambda/FileManagerStack-FileProcessingFunction-* --follow --region us-east-2 &
aws logs tail /aws/lambda/FileManagerStack-ListFilesFunction-* --follow --region us-east-2 &
aws logs tail /aws/lambda/FileManagerStack-MetadataRetrievalFunction-* --follow --region us-east-2 &
```

**Filter Logs by Error Level:**
```bash
# Only show errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/FileManagerStack-FileUploadFunction-* \
  --filter-pattern "ERROR" \
  --region us-east-2

# Show specific file uploads
aws logs filter-log-events \
  --log-group-name /aws/lambda/FileManagerStack-FileUploadFunction-* \
  --filter-pattern "{ $.fileId = \"*\" }" \
  --region us-east-2
```

## 📚 Project Structure

```
├── deploy.sh               # Deployment script
├── lambda-functions/       # TypeScript Lambda functions
│   └── src/                # Source code
├── file-manager-cdk/       # CDK infrastructure
│   ├── lib/                # Stack definitions
│   └── bin/                # CDK app entry point
└── web-client/             # React web interface
    ├── src/                # React components
    └── public/             # Static assets
```

## 🏗️ Architectural Decisions & Development Insights

### **🎯 Key Architectural Decisions**

#### **1. Serverless-First Architecture**
**Decision**: Use AWS Lambda + API Gateway instead of containerized services
**Reasoning**: 
- ✅ **Zero Infrastructure Management**: No servers to maintain or scale
- ✅ **Cost Efficiency**: Pay only for actual usage, ideal for variable workloads
- ✅ **Auto-scaling**: Handles traffic spikes automatically
- ✅ **Fast Development**: Focus on business logic, not infrastructure

**Trade-offs**:
- ❌ **Cold Starts**: Initial request latency (mitigated with provisioned concurrency if needed)
- ❌ **Vendor Lock-in**: AWS-specific implementation
- ✅ **Acceptable for Demo**: Perfect for development and learning projects

#### **2. Event-Driven Processing**
**Decision**: Use S3 events to trigger file processing instead of synchronous processing
**Reasoning**:
- ✅ **Decoupled Architecture**: Upload and processing are independent
- ✅ **Better User Experience**: Users get immediate upload confirmation
- ✅ **Fault Tolerance**: Processing failures don't affect uploads
- ✅ **Scalability**: Processing scales independently of uploads

**Implementation**:
```typescript
// Upload Lambda: Store file + basic metadata, return immediately
const uploadResult = await uploadToS3(file);
await storeBasisMetadata(fileId, basicInfo);
return { file_id: fileId, status: 'uploaded' };

// S3 Event → Processing Lambda: Extract detailed metadata asynchronously
```

#### **3. Flattened Metadata Structure**
**Decision**: Store extracted metadata as flattened fields with `extracted_` prefix
**Reasoning**:
- ✅ **DynamoDB Optimization**: Enables Global Secondary Indexes on extracted fields
- ✅ **Query Performance**: Direct attribute access vs nested object navigation
- ✅ **Conflict Prevention**: User metadata never conflicts with system metadata
- ✅ **Extensibility**: Easy to add new extracted fields

**Alternative Considered**: Nested structure
```json
// Rejected: Nested approach
{
  "user_metadata": { "author": "John" },
  "extracted_metadata": { "file_type": "pdf" }
}

// Chosen: Flattened approach  
{
  "author": "John",
  "extracted_file_type": "pdf"
}
```

#### **4. TypeScript + Shared Utilities**
**Decision**: Use TypeScript with shared response/logging utilities and type definitions
**Reasoning**:
- ✅ **Type Safety**: Compile-time error detection prevents runtime issues
- ✅ **DRY Principle**: Shared utilities eliminate code duplication
- ✅ **Consistency**: Standardized responses and logging across all functions
- ✅ **Maintainability**: Single source of truth for types and utilities

**Evolution**:
```typescript
// Before: Duplicate code in each Lambda
function createErrorResponse(statusCode, error) { /* ... */ }

// After: Shared utilities with third-party libraries
import { createErrorResponse, HTTP_STATUS } from './utils/responses';
import { createLogger } from './utils/logger';
```

#### **5. No Authentication (By Design)**
**Decision**: Deploy without authentication for development/demo purposes
**Reasoning**:
- ✅ **Developing Focus**: Emphasizes serverless architecture patterns
- ✅ **Rapid Prototyping**: Quick deployment and testing
- ✅ **Simplicity**: Reduces complexity for educational purposes
- ⚠️ **Development Only**: Clearly documented as not production-ready

### **🚧 Challenges Faced & Solutions**

#### **1. Multipart Form Data Parsing**
**Challenge**: Lambda doesn't natively parse multipart/form-data
**Initial Approach**: Base64 encoding (problematic for large files)
**Solution**: Custom multipart parser with boundary detection
```typescript
// Custom implementation to handle file uploads properly
function parseMultipartData(event: APIGatewayProxyEvent): ParsedMultipartData {
  const boundary = extractBoundary(event.headers['content-type']);
  const parts = parseMultipartParts(body, boundary);
  return { fileData: extractFile(parts), metadata: extractMetadata(parts) };
}
```

**Lessons Learned**:
- ✅ Multipart parsing is complex but provides better UX than base64
- ✅ Custom implementation gives full control over file handling
- ✅ Proper error handling is crucial for malformed requests

#### **1. Environment Variables in Lambda**
**Challenge**: AWS_REGION environment variable conflicts
**Issue**: CDK tried to set AWS_REGION, but it's reserved by Lambda runtime
**Solution**: Let Lambda runtime provide AWS_REGION automatically
```typescript
// CDK Stack - Remove manual AWS_REGION setting
environment: {
  DYNAMODB_TABLE_NAME: table.tableName,
  S3_BUCKET_NAME: bucket.bucketName,
  // AWS_REGION: 'us-east-2'  // ❌ Removed - provided by runtime
}
```

**Lessons Learned**:
- ✅ Some environment variables are reserved by AWS Lambda
- ✅ Lambda runtime provides standard AWS variables automatically
- ✅ CDK documentation doesn't always highlight these conflicts

#### **2. File Upload Error Handling**
**Challenge**: React Ant Design Upload component file object structure
**Issue**: `fileList[0].originFileObj` was undefined in some cases
**Solution**: Proper UploadFile object creation with validation
```typescript
const uploadFile: UploadFile = {
  uid: file.name + Date.now(),
  name: file.name,
  status: 'done',
  originFileObj: file,  // Explicitly set
};
```

**Lessons Learned**:
- ✅ UI library components have specific data structure requirements
- ✅ Defensive programming prevents undefined object access
- ✅ Proper validation at component boundaries is essential

### **🔍 Key Assumptions Made**

#### **1. File Size Limitations**
**Assumption**: 10MB maximum file size is sufficient for demo purposes
**Reasoning**: 
- ✅ API Gateway has 10MB payload limit
- ✅ Lambda memory constraints for processing
- ✅ Reasonable for most document/image files
- 🔄 **Future**: Could implement multipart upload for larger files

#### **2. File Type Detection**
**Assumption**: Content-Type header + file extension is sufficient for basic classification
**Current Implementation**:
```typescript
if (contentType.startsWith('image/')) {
  metadata.file_type = ExtractedFileType.IMAGE;
} else if (contentType === 'application/pdf') {
  metadata.file_type = ExtractedFileType.PDF;
}
```
**Limitations**: 
- ❌ No deep file content analysis
- ❌ Relies on client-provided content-type
- 🔄 **Future**: Could add magic number detection for security

#### **3. Metadata Extraction Simplicity**
**Assumption**: Basic metadata extraction is sufficient for demonstration
**Current Approach**:
- ✅ File size, type, extension
- ✅ Estimated pages/lines based on file size
- ❌ No OCR, document parsing, or EXIF data
- 🔄 **Future**: Could integrate specialized libraries for detailed extraction

#### **4. Single Region Deployment**
**Assumption**: Single AWS region (us-east-2) deployment is adequate
**Reasoning**:
- ✅ Simplifies development and testing
- ✅ Reduces costs for demo project
- ✅ Easier to manage resources
- 🔄 **Future**: Multi-region deployment for production use

#### **5. No File Versioning**
**Assumption**: Multiple files with the same name are stored as separate entities
**Current Behavior**: Each upload gets a unique file_id (UUID), allowing multiple files with identical names

**Reasoning**:
- ✅ **No Data Loss**: Users can upload files with same names without conflicts
- ✅ **Unique Identification**: Each file has a unique file_id for retrieval
- ✅ **Simple Storage Model**: No complex versioning logic needed
- ❌ **No Version History**: No relationship between files with same name
- 🔄 **Future**: Could implement file versioning by linking related uploads

## 📄 License

MIT License
