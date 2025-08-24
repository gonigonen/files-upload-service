# File Manager Service

A serverless file management service built with AWS CDK and TypeScript. Upload files with metadata, automatic processing, and a React web interface.

**🎯 Purpose**: Technical demonstration showcasing serverless architecture patterns.

**⚠️ Security**: No authentication implemented - this is intentionally excluded from the task scope.

**🔧 BEFORE YOU START**: You must have AWS CLI configured with valid credentials. Run `aws configure` first!

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

## 🚀 Quick Start

### Prerequisites

**⚠️ IMPORTANT: Configure AWS CLI first!**

```bash
# 1. Configure AWS CLI
aws configure

# 2. Verify setup
aws sts get-caller-identity

# 3. Install requirements
npm install -g aws-cdk
```

**Required**: Node.js 18+, AWS CLI, AWS CDK

### Deploy

```bash
# Build project
./build.sh

# Deploy to AWS
./deploy.sh

# Test API (paste URL from clipboard)
./test-api.sh https://YOUR-API-URL.amazonaws.com/prod/

# Start web client (paste URL from clipboard)
./update-web-client.sh https://YOUR-API-URL.amazonaws.com/prod/
cd web-client && npm install && npm start
```


## 🔬 Technical Evaluation

### Component Separation Analysis

**✅ Well-Separated Components:**
- **API Gateway**: Single entry point, handles routing, CORS, request validation
- **S3 Storage**: Dedicated file storage, isolated from business logic
- **4 Lambda Functions**: Each with single responsibility
- **DynamoDB**: Metadata storage, separate from file content

### Architecture Decisions

**Why API Gateway + 4 Lambdas?**
- **Single Responsibility**: Each Lambda handles one specific operation
- **Independent Scaling**: Functions scale based on individual usage patterns
- **Fault Isolation**: Failure in one function doesn't affect others
- **Cost Optimization**: Pay only for actual function execution time

**Lambda Function Breakdown:**
- **Upload Lambda**: Handles multipart uploads, validates files, stores metadata
- **List Lambda**: Optimized for fast file listing with pagination support
- **Metadata Lambda**: Dedicated metadata retrieval with detailed information
- **Processor Lambda**: Async file processing triggered by S3 events

**Why This Architecture?**
- **Event-Driven**: S3 triggers processing automatically
- **Serverless**: No infrastructure management, automatic scaling
- **Decoupled**: Components communicate via events, not direct calls
- **Resilient**: Built-in retry mechanisms and error handling

**📊 Request Flow**: See [SEQUENCE_DIAGRAM.md](SEQUENCE_DIAGRAM.md) for detailed request flow visualization

## 📡 API Overview

### Endpoints
- **POST /upload** - Upload file with metadata
- **GET /files** - List all uploaded files
- **GET /metadata/{file_id}** - Get detailed file metadata

### Example Usage
```bash
# Upload file
curl -X POST https://YOUR-API-URL/upload \
  -F "file=@document.pdf" \
  -F "author=John Doe" \
  -F "project=MyProject"

# List files
curl https://YOUR-API-URL/files

# Get metadata
curl https://YOUR-API-URL/metadata/{file_id}
```

## 🧹 Cleanup

```bash
./cleanup.sh
```

## 🚨 Troubleshooting

### AWS Issues
```bash
# Credentials not configured
aws configure

# Access denied
aws iam get-user

# Region not set
aws configure set region us-east-2
```

### Build/Deploy Issues
```bash
# Build fails
./build.sh --clean

# Deploy fails (ensure build first)
./build.sh
./deploy.sh

# CDK bootstrap needed
cd file-manager-cdk && npx cdk bootstrap
```

### Common Problems
- **File upload fails**: Check 10MB limit
- **Web client can't connect**: Use `./update-web-client.sh <api-url>`
- **"Stack not found"**: Run `./cleanup.sh --force`

## 🔒 Security & Assumptions

- **No authentication** (intentionally excluded for demo)
- **10MB file limit** (API Gateway constraint)
- **Single region deployment**
- **Demo/learning purpose only**

---

**📚 Project Structure:**
```
├── build.sh               # Build script
├── deploy.sh              # Deployment script  
├── cleanup.sh             # Resource cleanup
├── test-api.sh            # API testing
├── update-web-client.sh   # Web client setup
├── lambda-functions/      # TypeScript Lambda functions
├── file-manager-cdk/      # CDK infrastructure
└── web-client/            # React web interface
```

**🎯 This project demonstrates serverless architecture patterns using AWS CDK, TypeScript, and event-driven design - perfect for learning and technical assessment!**
