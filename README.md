# File Upload Service

A serverless file upload service built with AWS CDK, featuring automatic metadata extraction and RESTful API endpoints.

## Architecture

This service implements a complete serverless architecture using:

- **API Gateway**: RESTful API endpoints for file upload and metadata retrieval
- **AWS Lambda**: Three functions handling upload, metadata retrieval, and file processing
- **Amazon S3**: Secure file storage with event notifications
- **Amazon DynamoDB**: Metadata storage with fast retrieval
- **AWS CDK**: Infrastructure as Code for easy deployment

## Features

- ✅ RESTful API for file uploads with metadata
- ✅ Automatic metadata extraction (file type, size, format detection)
- ✅ Secure file storage in S3
- ✅ Fast metadata retrieval by file ID
- ✅ Support for multiple file types (PDF, images, text, video, audio)
- ✅ CORS enabled for web applications
- ✅ Error handling and validation

## API Endpoints

### 1. Upload File
**POST** `/upload`

Upload a file with optional user metadata.

**Request Body:**
```json
{
  "file_content": "base64-encoded-file-content",
  "file_name": "document.pdf",
  "content_type": "application/pdf",
  "metadata": {
    "author": "John Doe",
    "expiration_date": "2024-12-31",
    "description": "Important document",
    "tags": ["work", "important"]
  }
}
```

**Response (Success):**
```json
{
  "file_id": "123e4567-e89b-12d3-a456-426614174000",
  "message": "File uploaded successfully",
  "s3_key": "uploads/123e4567-e89b-12d3-a456-426614174000/document.pdf"
}
```

**Response (Error):**
```json
{
  "error": "Missing required fields: file_content, file_name, content_type"
}
```

### 2. Get File Metadata
**GET** `/metadata/{file_id}`

Retrieve complete metadata for a specific file.

**Response (Success):**
```json
{
  "file_id": "123e4567-e89b-12d3-a456-426614174000",
  "metadata": {
    "file_id": "123e4567-e89b-12d3-a456-426614174000",
    "file_name": "document.pdf",
    "content_type": "application/pdf",
    "s3_key": "uploads/123e4567-e89b-12d3-a456-426614174000/document.pdf",
    "upload_date": "2024-08-22T14:30:00.000Z",
    "file_size": 1048576,
    "status": "processed",
    "user_metadata": {
      "author": "John Doe",
      "expiration_date": "2024-12-31",
      "description": "Important document"
    },
    "extracted_metadata": {
      "file_type": "pdf",
      "category": "document",
      "file_extension": "pdf",
      "estimated_pages": 21,
      "size_category": "medium",
      "processing_timestamp": "2024-08-22T14:30:15.000Z"
    },
    "processing_date": "2024-08-22T14:30:15.000Z"
  }
}
```

**Response (Not Found):**
```json
{
  "error": "File not found",
  "file_id": "invalid-file-id"
}
```

## Deployment

### Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Node.js** (version 18 or later)
3. **AWS CDK** installed globally: `npm install -g aws-cdk`

### Quick Deploy

```bash
# Clone and navigate to the project
cd files-upload-service

# Run the deployment script
./deploy.sh
```

### Manual Deployment

```bash
# Install Lambda dependencies
cd file-upload-api/dist/lambda
npm install --production
cd ../../../

# Build and deploy CDK
cd file-upload-cdk
npm install
npm run build
npx cdk bootstrap  # Only needed once per account/region
npx cdk deploy
```

## Usage Examples

### Upload a PDF file with metadata

```bash
# Convert file to base64
FILE_CONTENT=$(base64 -i document.pdf)

# Upload via API
curl -X POST https://your-api-gateway-url/upload \
  -H "Content-Type: application/json" \
  -d '{
    "file_content": "'$FILE_CONTENT'",
    "file_name": "document.pdf",
    "content_type": "application/pdf",
    "metadata": {
      "author": "John Doe",
      "expiration_date": "2024-12-31",
      "department": "Engineering"
    }
  }'
```

### Upload an image file

```bash
# Convert image to base64
IMAGE_CONTENT=$(base64 -i photo.jpg)

# Upload via API
curl -X POST https://your-api-gateway-url/upload \
  -H "Content-Type: application/json" \
  -d '{
    "file_content": "'$IMAGE_CONTENT'",
    "file_name": "photo.jpg",
    "content_type": "image/jpeg",
    "metadata": {
      "photographer": "Jane Smith",
      "location": "New York",
      "event": "Conference 2024"
    }
  }'
```

### Retrieve file metadata

```bash
# Get metadata by file ID
curl https://your-api-gateway-url/metadata/123e4567-e89b-12d3-a456-426614174000
```

### JavaScript/Node.js Example

```javascript
const fs = require('fs');
const axios = require('axios');

async function uploadFile(filePath, metadata = {}) {
  // Read and encode file
  const fileBuffer = fs.readFileSync(filePath);
  const fileContent = fileBuffer.toString('base64');
  const fileName = path.basename(filePath);
  
  // Determine content type
  const contentType = getContentType(fileName);
  
  try {
    const response = await axios.post('https://your-api-gateway-url/upload', {
      file_content: fileContent,
      file_name: fileName,
      content_type: contentType,
      metadata: metadata
    });
    
    console.log('Upload successful:', response.data);
    return response.data.file_id;
  } catch (error) {
    console.error('Upload failed:', error.response?.data || error.message);
    throw error;
  }
}

async function getMetadata(fileId) {
  try {
    const response = await axios.get(`https://your-api-gateway-url/metadata/${fileId}`);
    return response.data.metadata;
  } catch (error) {
    console.error('Failed to get metadata:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
uploadFile('./document.pdf', {
  author: 'John Doe',
  expiration_date: '2024-12-31'
}).then(fileId => {
  console.log('File uploaded with ID:', fileId);
  return getMetadata(fileId);
}).then(metadata => {
  console.log('File metadata:', metadata);
});
```

## Metadata Extraction

The service automatically extracts metadata based on file type:

### PDF Files
- Estimated page count
- File size category
- Processing timestamp

### Image Files
- Format detection (JPEG, PNG, GIF)
- File size analysis
- Category classification

### Text Files
- Estimated line count
- Content type validation

### Video/Audio Files
- Media type classification
- Size categorization

## File Size Categories

- **Small**: < 1MB
- **Medium**: 1MB - 10MB  
- **Large**: 10MB - 100MB
- **Very Large**: > 100MB

## Security Features

- Files stored in private S3 bucket
- API Gateway with CORS configuration
- Lambda functions with minimal IAM permissions
- Unique file IDs prevent enumeration attacks
- Input validation and sanitization

## Monitoring and Logging

- CloudWatch logs for all Lambda functions
- S3 access logging available
- DynamoDB metrics and alarms
- API Gateway request/response logging

## Cost Optimization

- Pay-per-request DynamoDB billing
- S3 Intelligent Tiering for cost optimization
- Lambda functions with appropriate memory allocation
- API Gateway caching can be enabled

## Cleanup

To remove all resources:

```bash
cd file-upload-cdk
npx cdk destroy
```

## Troubleshooting

### Common Issues

1. **Deployment fails**: Ensure AWS credentials are configured and have sufficient permissions
2. **File upload fails**: Check file size limits and base64 encoding
3. **Metadata not found**: Verify file was processed (check CloudWatch logs)

### Logs

Check CloudWatch logs for each Lambda function:
- `/aws/lambda/FileUploadStack-FileUploadFunction-*`
- `/aws/lambda/FileUploadStack-MetadataRetrievalFunction-*`
- `/aws/lambda/FileUploadStack-FileProcessingFunction-*`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.