#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

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

echo "🧹 Cleaning up File Manager Service resources..."

# Parse command line arguments
PROFILE=""
REGION=""
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --profile)
            PROFILE="$2"
            shift 2
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --profile PROFILE      AWS profile to use (optional)"
            echo "  --region REGION        AWS region (optional, uses profile default)"
            echo "  --force                Skip confirmation prompts"
            echo "  --help, -h             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Clean up File Manager demo"
            echo "  $0 --profile my-profile              # Clean up with specific AWS profile"
            echo "  $0 --force                           # Force cleanup without confirmation"
            echo ""
            echo "Note: This removes all AWS resources for the File Manager demo!"
            echo "      CDK bootstrap resources are preserved (shared across deployments)"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Use fixed stack name
STACK_NAME="FileManagerStack"

# Set up AWS CLI options
AWS_OPTS=""
if [ ! -z "$PROFILE" ]; then
    AWS_OPTS="$AWS_OPTS --profile $PROFILE"
fi
if [ ! -z "$REGION" ]; then
    AWS_OPTS="$AWS_OPTS --region $REGION"
else
    # Get region from profile or default
    REGION=$(aws configure get region $AWS_OPTS 2>/dev/null || echo "us-east-2")
    AWS_OPTS="$AWS_OPTS --region $REGION"
fi

print_highlight "🔍 CLEANUP CONFIGURATION:"
echo -e "   ${BOLD}Stack Name:${NC} $STACK_NAME"
echo -e "   ${BOLD}Region:${NC} $REGION"
if [ ! -z "$PROFILE" ]; then
    echo -e "   ${BOLD}Profile:${NC} $PROFILE"
fi
echo ""

# Check if user wants to continue
if [ "$FORCE" != "true" ]; then
    print_warning "This will permanently delete all File Manager resources!"
    print_warning "Files, metadata, Lambda functions, and other AWS resources will be removed."
    echo ""
    print_highlight "Resources that will be deleted:"
    echo "  • S3 bucket and all uploaded files"
    echo "  • DynamoDB table and all metadata"
    echo "  • Lambda functions (upload, list, metadata, processor)"
    echo "  • API Gateway endpoints"
    echo "  • IAM roles and policies"
    echo "  • CloudWatch logs"
    echo ""
    print_highlight "Resources that will be preserved:"
    echo "  • CDK bootstrap bucket (cdk-hnb659fds-assets-*)"
    echo "  • CDK bootstrap resources (shared across deployments)"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        print_status "Cleanup cancelled"
        exit 0
    fi
fi

print_status "Starting cleanup process..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity $AWS_OPTS >/dev/null 2>&1; then
    print_error "AWS CLI not configured or invalid credentials"
    print_status "Please run 'aws configure' or check your profile settings"
    exit 1
fi

# Get account ID for verification
ACCOUNT_ID=$(aws sts get-caller-identity $AWS_OPTS --query Account --output text 2>/dev/null)
print_status "Using AWS Account: $ACCOUNT_ID"

# Check if stack exists
if aws cloudformation describe-stacks --stack-name "$STACK_NAME" $AWS_OPTS >/dev/null 2>&1; then
    print_status "Found stack: $STACK_NAME"
else
    print_warning "Stack '$STACK_NAME' not found"
    print_status "Nothing to clean up"
    exit 0
fi

# Get stack resources before deletion for verification
print_status "Retrieving stack resources..."
BUCKET_NAME=$(aws cloudformation describe-stack-resources --stack-name "$STACK_NAME" $AWS_OPTS --query "StackResources[?ResourceType=='AWS::S3::Bucket'].PhysicalResourceId" --output text 2>/dev/null)
TABLE_NAME=$(aws cloudformation describe-stack-resources --stack-name "$STACK_NAME" $AWS_OPTS --query "StackResources[?ResourceType=='AWS::DynamoDB::Table'].PhysicalResourceId" --output text 2>/dev/null)

if [ ! -z "$BUCKET_NAME" ]; then
    print_status "Found S3 bucket: $BUCKET_NAME"
    
    # Empty S3 bucket first (required before stack deletion)
    print_status "Emptying S3 bucket..."
    aws s3 rm "s3://$BUCKET_NAME" --recursive $AWS_OPTS 2>/dev/null || true
    print_status "S3 bucket emptied"
fi

if [ ! -z "$TABLE_NAME" ]; then
    print_status "Found DynamoDB table: $TABLE_NAME"
fi

# Delete the CloudFormation stack
print_status "Deleting CloudFormation stack..."
cd file-manager-cdk

# Use CDK destroy for proper cleanup
if [ ! -z "$PROFILE" ]; then
    export AWS_PROFILE="$PROFILE"
fi
if [ ! -z "$REGION" ]; then
    export AWS_DEFAULT_REGION="$REGION"
fi

# Use CDK destroy for proper cleanup
print_status "Destroying stack via CDK..."
npx cdk destroy "$STACK_NAME" --force

if [ $? -eq 0 ]; then
    print_success "✅ Stack deleted successfully!"
else
    print_error "Failed to delete stack"
    print_status "You may need to check the AWS Console for any remaining resources"
    exit 1
fi

cd ..

print_success "🎉 CLEANUP COMPLETED!"
echo ""
print_highlight "📊 CLEANUP SUMMARY:"
echo -e "   ${BOLD}Stack:${NC} $STACK_NAME"
echo -e "   ${BOLD}Region:${NC} $REGION"
echo -e "   ${BOLD}Account:${NC} $ACCOUNT_ID"
if [ ! -z "$BUCKET_NAME" ]; then
    echo -e "   ${BOLD}S3 Bucket:${NC} $BUCKET_NAME (deleted)"
fi
if [ ! -z "$TABLE_NAME" ]; then
    echo -e "   ${BOLD}DynamoDB Table:${NC} $TABLE_NAME (deleted)"
fi
echo ""
print_highlight "✅ All File Manager resources have been removed"
print_status "CDK bootstrap resources preserved (shared across deployments)"
echo ""
print_status "Your AWS account is now clean of File Manager demo resources"
