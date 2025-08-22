# File Manager Service

A serverless file management service built with AWS CDK and TypeScript. Upload files with metadata, automatic processing, and a React web interface.

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

### Start Web Client
```bash
cd web-client
npm install
# Update src/services/api.ts with your API Gateway URL
npm start
# Open http://localhost:3000
```

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
- **React Web Client**: Modern UI with file upload, listing, and metadata viewing
- **API Gateway**: 3 REST endpoints (upload, list, metadata)
- **4 Lambda Functions**: TypeScript-based serverless processing
- **S3**: Secure file storage with event notifications
- **DynamoDB**: Fast metadata storage and retrieval

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

## 🔒 Security

- Private S3 bucket
- Unique file IDs prevent enumeration
- CORS-enabled API Gateway
- IAM roles with minimal permissions
- Input validation and sanitization

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

## 🧹 Cleanup

Remove all AWS resources:
```bash
cd file-manager-cdk
npx cdk destroy
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

## 📄 License

MIT License
