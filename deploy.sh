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

print_section() {
    echo ""
    echo -e "${BOLD}${BLUE}=== $1 ===${NC}"
}

# Parse command line arguments
PROFILE=""
REGION=""

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
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --profile PROFILE      AWS profile to use (optional)"
            echo "  --region REGION        AWS region to deploy to (optional, uses profile default)"
            echo "  --help, -h             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Deploy with default settings"
            echo "  $0 --profile my-profile              # Deploy with specific AWS profile"
            echo "  $0 --region us-west-2                # Deploy to specific region"
            echo ""
            echo "Note: This is a demo/learning project - not intended for production use!"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Set up AWS CLI options
AWS_CLI_OPTS=""
if [ ! -z "$PROFILE" ]; then
    AWS_CLI_OPTS="--profile $PROFILE"
    print_status "Using AWS profile: $PROFILE"
fi

print_section "ENVIRONMENT VALIDATION"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed"
    print_warning "Please install AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    print_warning "Please install Node.js 18+: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version $NODE_VERSION is not supported. Please install Node.js 18 or higher."
    exit 1
fi
print_status "Node.js version: $(node --version)"

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    print_error "AWS CDK is not installed"
    print_warning "Please install CDK globally: npm install -g aws-cdk"
    exit 1
fi
print_status "CDK version: $(cdk --version)"

# Check AWS credentials
print_status "Validating AWS credentials..."
if ! aws sts get-caller-identity $AWS_CLI_OPTS > /dev/null 2>&1; then
    print_error "AWS CLI is not configured or credentials are invalid"
    if [ ! -z "$PROFILE" ]; then
        print_warning "Please check your AWS profile '$PROFILE' configuration"
        print_warning "Run: aws configure --profile $PROFILE"
    else
        print_warning "Please run 'aws configure' to set up your credentials"
    fi
    print_warning "Or set environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
    exit 1
fi

# Get AWS account and user info
ACCOUNT_ID=$(aws sts get-caller-identity $AWS_CLI_OPTS --query Account --output text)
USER_ARN=$(aws sts get-caller-identity $AWS_CLI_OPTS --query Arn --output text)
print_success "✅ AWS credentials verified"
print_status "Account ID: $ACCOUNT_ID"
print_status "User/Role: $USER_ARN"

# Get or validate region
if [ -z "$REGION" ]; then
    if [ ! -z "$PROFILE" ]; then
        REGION=$(aws configure get region --profile $PROFILE 2>/dev/null || echo "")
    else
        REGION=$(aws configure get region 2>/dev/null || echo "")
    fi
    
    if [ -z "$REGION" ]; then
        print_warning "No region configured. Using default: us-east-1"
        REGION="us-east-1"
    fi
fi

print_status "Deploying to region: $REGION"

# Validate region
if ! aws ec2 describe-regions $AWS_CLI_OPTS --region $REGION --query 'Regions[?RegionName==`'$REGION'`]' --output text | grep -q $REGION; then
    print_error "Invalid AWS region: $REGION"
    exit 1
fi

# Check required permissions (basic check)
print_status "Checking basic AWS permissions..."
REQUIRED_SERVICES=("s3" "dynamodb" "lambda" "apigateway" "iam" "cloudformation")
for service in "${REQUIRED_SERVICES[@]}"; do
    case $service in
        s3)
            if ! aws s3 ls $AWS_CLI_OPTS --region $REGION > /dev/null 2>&1; then
                print_warning "Cannot access S3. Some permissions may be missing."
            fi
            ;;
        dynamodb)
            if ! aws dynamodb list-tables $AWS_CLI_OPTS --region $REGION > /dev/null 2>&1; then
                print_warning "Cannot access DynamoDB. Some permissions may be missing."
            fi
            ;;
        lambda)
            if ! aws lambda list-functions $AWS_CLI_OPTS --region $REGION > /dev/null 2>&1; then
                print_warning "Cannot access Lambda. Some permissions may be missing."
            fi
            ;;
        cloudformation)
            if ! aws cloudformation list-stacks $AWS_CLI_OPTS --region $REGION > /dev/null 2>&1; then
                print_error "Cannot access CloudFormation. This is required for CDK deployment."
                exit 1
            fi
            ;;
    esac
done

print_section "BUILD VALIDATION"

# Check if project has been built
print_status "Validating project build..."

# Check Lambda functions build
if [ ! -d "lambda-functions/dist" ]; then
    print_error "Lambda functions not built"
    print_warning "Please run './build.sh' first to build the project"
    print_status "Example: ./build.sh"
    exit 1
fi

# Check if all expected Lambda files exist
EXPECTED_FILES=("upload.js" "list-files.js" "metadata.js" "processor.js")
for file in "${EXPECTED_FILES[@]}"; do
    if [ ! -f "lambda-functions/dist/$file" ]; then
        print_error "Lambda function '$file' not found in build output"
        print_warning "Please run './build.sh' to rebuild the project"
        exit 1
    fi
done

# Check CDK build
if [ ! -d "file-manager-cdk" ]; then
    print_error "file-manager-cdk directory not found"
    exit 1
fi

cd file-manager-cdk

# Check if CDK dependencies are installed
if [ ! -d "node_modules" ]; then
    print_error "CDK dependencies not installed"
    print_warning "Please run './build.sh' first to build the project"
    exit 1
fi

# Test CDK synthesis to validate build
print_status "Validating CDK configuration..."
if ! npx cdk synth --quiet >/dev/null 2>&1; then
    print_error "CDK configuration validation failed"
    print_warning "Please run './build.sh' to rebuild the project"
    exit 1
fi

print_success "✅ Build validation passed"

print_section "CDK DEPLOYMENT"

# Set CDK environment variables
export CDK_DEFAULT_ACCOUNT=$ACCOUNT_ID
export CDK_DEFAULT_REGION=$REGION

# Add profile to CDK commands if specified
CDK_OPTS=""
if [ ! -z "$PROFILE" ]; then
    CDK_OPTS="--profile $PROFILE"
fi

# Bootstrap CDK (if not already done)
print_status "Checking CDK bootstrap status..."
BOOTSTRAP_STACK_NAME="CDKToolkit"
if aws cloudformation describe-stacks --stack-name $BOOTSTRAP_STACK_NAME $AWS_CLI_OPTS --region $REGION > /dev/null 2>&1; then
    print_status "CDK already bootstrapped in this account/region"
else
    print_status "Bootstrapping CDK (this may take a few minutes)..."
    if ! npx cdk bootstrap $CDK_OPTS --region $REGION; then
        print_error "CDK bootstrap failed"
        print_warning "This might be due to insufficient permissions or existing resources"
        print_warning "Try running: npx cdk bootstrap --profile $PROFILE --region $REGION --verbose"
        exit 1
    fi
    print_success "✅ CDK bootstrapped successfully"
fi

# Check if stack already exists
STACK_NAME="FileManagerStack"
if aws cloudformation describe-stacks --stack-name $STACK_NAME $AWS_CLI_OPTS --region $REGION > /dev/null 2>&1; then
    print_warning "Stack '$STACK_NAME' already exists. This will update the existing stack."
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Deployment cancelled by user"
        exit 0
    fi
fi

# Deploy the stack
print_status "Deploying CDK stack: $STACK_NAME"
print_status "This may take 5-10 minutes..."

# Create a temporary file for deployment output
DEPLOY_LOG=$(mktemp)
trap "rm -f $DEPLOY_LOG" EXIT

if ! npx cdk deploy $STACK_NAME $CDK_OPTS --region $REGION --require-approval never --outputs-file cdk-outputs.json 2>&1 | tee $DEPLOY_LOG; then
    print_error "CDK deployment failed"
    print_warning "Check the error messages above for details"
    print_warning "Common issues:"
    print_warning "  - Insufficient IAM permissions"
    print_warning "  - Resource limits exceeded"
    print_warning "  - Stack name conflicts"
    exit 1
fi

print_section "DEPLOYMENT RESULTS"

# Extract API Gateway URL from deployment output
API_URL=""
if [ -f "cdk-outputs.json" ]; then
    API_URL=$(cat cdk-outputs.json | grep -o 'https://[a-zA-Z0-9]*\.execute-api\.[a-zA-Z0-9-]*\.amazonaws\.com/[^"]*' | head -1)
fi

# Fallback: try to extract from deployment log
if [ -z "$API_URL" ]; then
    API_URL=$(grep -o 'https://[a-zA-Z0-9]*\.execute-api\.[a-zA-Z0-9-]*\.amazonaws\.com/prod/' $DEPLOY_LOG | head -1)
fi

cd ..

echo ""
print_success "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo ""
print_highlight "📊 DEPLOYMENT SUMMARY:"
echo -e "   ${BOLD}Account:${NC} $ACCOUNT_ID"
echo -e "   ${BOLD}Region:${NC} $REGION"
echo -e "   ${BOLD}Stack:${NC} $STACK_NAME"
if [ ! -z "$PROFILE" ]; then
    echo -e "   ${BOLD}Profile:${NC} $PROFILE"
fi
echo ""

if [ ! -z "$API_URL" ]; then
    print_highlight "📡 API GATEWAY URL:"
    print_success "   $API_URL"
    
    # Copy API URL to clipboard (cross-platform)
    if command -v pbcopy >/dev/null 2>&1; then
        # macOS
        echo -n "$API_URL" | pbcopy
        print_success "   ✅ API URL copied to clipboard!"
    elif command -v xclip >/dev/null 2>&1; then
        # Linux with xclip
        echo -n "$API_URL" | xclip -selection clipboard
        print_success "   ✅ API URL copied to clipboard!"
    elif command -v xsel >/dev/null 2>&1; then
        # Linux with xsel
        echo -n "$API_URL" | xsel --clipboard --input
        print_success "   ✅ API URL copied to clipboard!"
    elif command -v clip >/dev/null 2>&1; then
        # Windows (WSL or Git Bash)
        echo -n "$API_URL" | clip
        print_success "   ✅ API URL copied to clipboard!"
    else
        print_warning "   📋 Copy this URL manually (clipboard tool not available)"
    fi
    
    echo ""
    print_highlight "🧪 QUICK TEST COMMANDS:"
    echo -e "   ${BOLD}List files:${NC}"
    echo "   curl ${API_URL}files"
    echo ""
    echo -e "   ${BOLD}Upload file:${NC}"
    echo "   curl -X POST ${API_URL}upload \\"
    echo "     -F \"file=@your-file.txt\" \\"
    echo "     -F \"author=Your Name\""
    echo ""
    print_highlight "🌐 WEB CLIENT SETUP:"
    echo "   1. cd web-client"
    echo "   2. Update src/services/api.ts with: $API_URL"
    echo "   3. npm install && npm start"
    echo ""
    print_highlight "🚀 AUTOMATED SETUP (RECOMMENDED):"
    echo "   Run this command to automatically update web client:"
    echo -e "   ${BOLD}./update-web-client.sh $API_URL${NC}"
    echo ""
    print_highlight "📋 OR MANUAL UPDATE:"
    echo "   Edit web-client/src/services/api.ts and change:"
    echo "   const API_BASE_URL = '$API_URL';"
    echo ""
else
    print_warning "Could not extract API Gateway URL from deployment output"
    print_status "You can find it in the AWS Console under API Gateway"
fi

print_highlight "🔍 AWS CONSOLE LINKS:"
echo "   CloudFormation: https://console.aws.amazon.com/cloudformation/home?region=$REGION#/stacks/stackinfo?stackId=$STACK_NAME"
echo "   API Gateway: https://console.aws.amazon.com/apigateway/home?region=$REGION"
echo "   Lambda: https://console.aws.amazon.com/lambda/home?region=$REGION"
echo "   S3: https://console.aws.amazon.com/s3/home?region=$REGION"
echo "   DynamoDB: https://console.aws.amazon.com/dynamodb/home?region=$REGION"
echo ""

print_highlight "📋 NEXT STEPS:"
echo "   1. Test the API endpoints above"
echo "   2. Set up the web client with the API URL"
echo "   3. Check CloudWatch logs if you encounter issues"
echo "   4. Run './cleanup.sh' when you want to remove all resources"
echo ""

print_highlight "🆘 NEED HELP?"
echo "   - Check the README.md for detailed documentation"
echo "   - View logs: aws logs tail /aws/lambda/FileManagerStack-* --follow --region $REGION"
echo "   - Troubleshooting guide in README.md"
echo ""

print_success "Happy file managing! 🚀"
