# File Manager Service

A serverless file management service built with AWS CDK and TypeScript. Upload files with metadata, automatic processing, and a React web interface.

**🎯 Purpose**: Technical demonstration showcasing serverless architecture patterns.

**⚠️ Security**: No authentication implemented - this is intentionally excluded from the task scope.

## 📋 Table of Contents

- [🏗️ Architecture](#️-architecture)
- [🚀 Quick Start](#-quick-start)
- [📡 API Overview](#-api-overview)
- [⚠️ Error Handling](#️-error-handling)
- [🔒 Security & Assumptions](#-security--assumptions)
- [🏗️ Design Decisions](#️-design-decisions)
- [🧹 Cleanup](#-cleanup)
- [🚨 Troubleshooting](#-troubleshooting)

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
- **React Web Client**: File upload, listing, and metadata viewing
- **API Gateway**: 3 REST endpoints with CORS support
- **4 Lambda Functions**: Upload, List, Metadata, Processing (all TypeScript)
- **S3**: File storage with event notifications
- **DynamoDB**: Metadata storage with flattened structure

## 🚀 Quick Start

### Prerequisites
- AWS CLI configured (`aws configure`)
- Node.js 18+
- AWS CDK installed globally: `npm install -g aws-cdk`

### Deploy to Your AWS Account
```bash
# Simple deployment
./deploy.sh

# With specific AWS profile/region
./deploy.sh --profile my-profile --region us-west-2
```

**📡 The API Gateway URL will be automatically copied to your clipboard!**

### Test the Deployment
```bash
# Automated API testing (paste URL from clipboard)
./test-api.sh https://YOUR-API-URL.amazonaws.com/prod/
```

### Start Web Client
```bash
# Automated setup (paste API URL from clipboard)
./update-web-client.sh https://YOUR-API-URL.amazonaws.com/prod/
cd web-client && npm install && npm start
```

## 📡 API Overview

### Endpoints
- **POST /upload** - Upload file with metadata
- **GET /files** - List all uploaded files
- **GET /metadata/{file_id}** - Get detailed file metadata

### File Upload
```bash
curl -X POST https://YOUR-API-URL/upload \
  -F "file=@document.pdf" \
  -F "author=John Doe" \
  -F "project=MyProject"
```

### Response Format
```json
{
  "file_id": "uuid-here",
  "file_name": "document.pdf",
  "upload_date": "2024-08-23T17:00:00Z",
  "author": "John Doe",
  "project": "MyProject",
  "extracted_file_type": "pdf",
  "extracted_size_category": "medium"
}
```

## ⚠️ Error Handling

The service implements comprehensive error handling:

- **400 Bad Request**: Invalid file or metadata
- **413 Payload Too Large**: File exceeds 10MB limit
- **500 Internal Server Error**: AWS service failures

**Advanced Error Handling:**
- **Retry Mechanism**: DynamoDB operations retry with exponential backoff
- **Race Condition Prevention**: Metadata stored before S3 upload
- **Cleanup on Failure**: DynamoDB records cleaned up if S3 upload fails
- **Conditional Updates**: Processing Lambda checks record exists before updating

**Error Response Example:**
```json
{
  "error": "File too large",
  "details": ["Maximum file size is 10MB"],
  "max_size": "10MB",
  "actual_size": "15.2MB"
}
```

**Fault Tolerance:**
- Individual file processing failures don't affect others
- S3 events trigger automatic retries
- Structured logging for debugging
- Graceful degradation when processing fails

## 🔒 Security & Assumptions

### Security (Intentionally Excluded)
**⚠️ No authentication implemented** - this was intentionally excluded from the task scope to focus on serverless architecture patterns.

**Current State:**
- Open API accessible to anyone with the URL
- Suitable for development, testing, and learning only
- Not intended for production use

### Key Assumptions
- **File Size**: 10MB maximum (API Gateway limit)
- **File Duplicates**: Multiple files with same name allowed (unique file_id per upload)
- **File Types**: Basic detection via Content-Type header
- **Metadata**: Simple extraction (size, type, estimated pages)
- **Region**: Single region deployment sufficient for demo

## 🏗️ Design Decisions

### Why API Gateway?
- **Serverless Integration**: Native Lambda integration
- **Built-in Features**: CORS, throttling, caching
- **Cost Effective**: Pay-per-request model
- **Scalability**: Auto-scaling with no infrastructure management

### Why 4 Lambda Functions?
- **Single Responsibility**: Each function has one clear purpose
- **Independent Scaling**: Functions scale based on individual demand
- **Fault Isolation**: One function failure doesn't affect others
- **Event-Driven**: Processing triggered by S3 events, not API calls

**Function Breakdown:**
1. **Upload Lambda**: File validation, S3 storage, initial metadata
2. **List Files Lambda**: Query and return file listings
3. **Metadata Lambda**: Retrieve detailed file information
4. **Processing Lambda**: Extract metadata from uploaded files (async)

### Why Flattened Metadata?
- **DynamoDB Optimization**: Enables Global Secondary Indexes
- **Query Performance**: Direct attribute access vs nested navigation
- **Conflict Prevention**: User metadata never conflicts with extracted data
- **Extensibility**: Easy to add new extracted fields

### Event-Driven Processing
- **Better UX**: Users get immediate upload confirmation
- **Decoupled**: Upload and processing are independent
- **Scalable**: Processing scales independently of uploads
- **Fault Tolerant**: Processing failures don't affect uploads

## 🧹 Cleanup

**Important**: Remove all AWS resources when done to avoid charges:

```bash
./cleanup.sh
```

This deletes all S3 files, DynamoDB data, Lambda functions, and associated resources.

## 🚨 Troubleshooting

### Common Issues

**Deployment fails:**
- Ensure AWS credentials are configured: `aws sts get-caller-identity`
- Check required permissions (CloudFormation, Lambda, S3, DynamoDB, API Gateway, IAM)
- Bootstrap CDK if needed: `cd file-manager-cdk && npx cdk bootstrap`

**Web client can't connect:**
- Verify API URL in `web-client/src/services/api.ts`
- Use helper script: `./update-web-client.sh <api-url>`

**File upload fails:**
- Check file size (10MB limit)
- Verify multipart/form-data format

### Debug Commands
```bash
# Check AWS credentials
aws sts get-caller-identity

# View Lambda logs
aws logs tail /aws/lambda/FileManagerStack-demo-* --follow --region us-east-2

# Test API
curl https://YOUR-API-URL/files
```

### About the Two S3 Buckets
After deployment, you'll see two S3 buckets:

1. **CDK Bootstrap Bucket** (`cdk-hnb659fds-assets-<account>-<region>`):
   - Created automatically by AWS CDK
   - Stores deployment artifacts (Lambda code, CloudFormation templates)
   - Shared across all CDK deployments in your account/region
   - **Do NOT delete** - needed for CDK functionality

2. **Application Bucket** (`filemanagerstack-demo-bucket-<hash>`):
   - Your file storage bucket
   - Stores uploaded files
   - Deleted during cleanup

### Get Help
- Check deployment script options: `./deploy.sh --help`
- View CloudFormation events in AWS Console
- Check Lambda logs in CloudWatch

---

**📚 Project Structure:**
```
├── deploy.sh              # Deployment script
├── cleanup.sh             # Resource cleanup
├── test-api.sh            # API testing
├── update-web-client.sh   # Web client setup helper
├── lambda-functions/      # TypeScript Lambda functions
├── file-manager-cdk/      # CDK infrastructure
└── web-client/            # React web interface
```

**🎯 This project demonstrates serverless architecture patterns using AWS CDK, TypeScript, and event-driven design - perfect for learning and technical assessment!**
