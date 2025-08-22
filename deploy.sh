#!/bin/bash

set -e

echo "🚀 Deploying File Manager Service..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
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

print_success() {
    echo -e "${BOLD}${GREEN}$1${NC}"
}

print_highlight() {
    echo -e "${BOLD}${BLUE}$1${NC}"
}

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    print_error "AWS CLI is not configured or credentials are invalid"
    print_warning "Please run 'aws configure' to set up your credentials"
    exit 1
fi

print_status "AWS credentials verified"

# Get current region
REGION=$(aws configure get region)
print_status "Deploying to region: $REGION"

# Build TypeScript Lambda functions
print_status "Building TypeScript Lambda functions..."
cd lambda-functions
if ! npm install; then
    print_error "Failed to install Lambda dependencies"
    exit 1
fi

if ! npm run build; then
    print_error "Failed to build Lambda functions"
    exit 1
fi
cd ..

# Build CDK project
print_status "Building CDK project..."
cd file-manager-cdk
if ! npm install; then
    print_error "Failed to install CDK dependencies"
    exit 1
fi

if ! npm run build; then
    print_error "Failed to build CDK project"
    exit 1
fi

# Check if old stack exists and warn user
print_status "Checking for existing stacks..."
if aws cloudformation describe-stacks --stack-name FileUploadStack --region $REGION > /dev/null 2>&1; then
    print_warning "Old FileUploadStack detected!"
    print_warning "You may want to destroy it first: npx cdk destroy FileUploadStack"
    print_warning "Continuing with FileManagerStack deployment..."
fi

# Bootstrap CDK (if not already done)
print_status "Bootstrapping CDK..."
if ! npx cdk bootstrap; then
    print_error "CDK bootstrap failed"
    exit 1
fi

# Deploy the stack
print_status "Deploying CDK stack..."
DEPLOY_OUTPUT=$(npx cdk deploy --require-approval never 2>&1)
DEPLOY_EXIT_CODE=$?

if [ $DEPLOY_EXIT_CODE -ne 0 ]; then
    print_error "CDK deployment failed"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

# Extract API Gateway URL from deployment output
API_URL=$(echo "$DEPLOY_OUTPUT" | grep -o 'https://[a-zA-Z0-9]*\.execute-api\.[a-zA-Z0-9-]*\.amazonaws\.com/prod/' | head -1)

echo ""
print_success "✅ DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo ""
print_highlight "📡 API GATEWAY URL:"
print_success "   $API_URL"
echo ""
print_highlight "🧪 QUICK TEST COMMANDS:"
echo -e "   ${BOLD}List files:${NC}"
echo "   curl $API_URL/files"
echo ""
echo -e "   ${BOLD}Upload file:${NC}"
echo "   curl -X POST $API_URL/upload \\"
echo "     -F \"file=@your-file.txt\" \\"
echo "     -F \"author=Your Name\""
echo ""
print_highlight "🌐 WEB CLIENT SETUP:"
echo "   1. cd web-client"
echo "   2. Update src/services/api.ts with: $API_URL"
echo "   3. npm start"
echo ""
print_highlight "🧪 AUTOMATED TESTING:"
echo "   ./test-api.sh $API_URL"
echo ""

cd ..
