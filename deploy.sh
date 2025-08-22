#!/bin/bash

set -e

echo "🚀 Deploying File Upload Service..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    print_error "AWS CLI is not configured or credentials are invalid"
    print_warning "Please run 'aws configure' to set up your credentials"
    exit 1
fi

print_status "AWS credentials verified"

# Install Lambda dependencies
print_status "Installing Lambda function dependencies..."
cd file-upload-api/dist/lambda
npm install --production
cd ../../../

# Build CDK project
print_status "Building CDK project..."
cd file-upload-cdk
npm install
npm run build

# Bootstrap CDK (if not already done)
print_status "Bootstrapping CDK..."
npx cdk bootstrap

# Deploy the stack
print_status "Deploying CDK stack..."
npx cdk deploy --require-approval never

print_status "✅ Deployment completed successfully!"
print_warning "Note: The API endpoints and resource details are shown in the CDK output above"

cd ..
