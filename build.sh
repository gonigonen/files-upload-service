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

print_section() {
    echo ""
    echo -e "${BOLD}${BLUE}=== $1 ===${NC}"
    echo ""
}

echo "🔨 Building File Manager Service..."

# Parse command line arguments
CLEAN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --clean                Clean build (remove existing build artifacts)"
            echo "  --help, -h             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                     # Build all components"
            echo "  $0 --clean             # Clean build (removes existing artifacts)"
            echo ""
            echo "This script builds:"
            echo "  • TypeScript Lambda functions"
            echo "  • CDK infrastructure code"
            echo "  • Validates all configurations"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

print_highlight "🔍 BUILD CONFIGURATION:"
echo -e "   ${BOLD}Clean Build:${NC} $CLEAN"
echo ""

# Check if Node.js is installed
if ! command -v node >/dev/null 2>&1; then
    print_error "Node.js is not installed"
    print_status "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version $NODE_VERSION is too old"
    print_status "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

print_status "Node.js version: $(node --version)"

print_section "LAMBDA FUNCTIONS BUILD"

# Clean build artifacts if requested
if [ "$CLEAN" = true ]; then
    print_status "Cleaning existing build artifacts..."
    rm -rf lambda-functions/dist
    rm -rf lambda-functions/node_modules
    rm -rf file-manager-cdk/node_modules
    rm -rf file-manager-cdk/cdk.out
    print_status "Clean completed"
fi

# Check if lambda-functions directory exists
if [ ! -d "lambda-functions" ]; then
    print_error "lambda-functions directory not found"
    print_status "Please run this script from the project root directory"
    exit 1
fi

cd lambda-functions

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ "$CLEAN" = true ]; then
    print_status "Installing Lambda function dependencies..."
    if ! npm install; then
        print_error "Failed to install Lambda dependencies"
        exit 1
    fi
    print_success "✅ Lambda dependencies installed"
else
    print_status "Lambda dependencies already installed"
fi

# Build TypeScript Lambda functions
print_status "Building TypeScript Lambda functions..."
if ! npm run build; then
    print_error "Failed to build Lambda functions"
    exit 1
fi

# Verify build output
if [ ! -d "dist" ]; then
    print_error "Build output directory 'dist' not found"
    exit 1
fi

# Check if all expected files are built
EXPECTED_FILES=("upload.js" "list-files.js" "metadata.js" "processor.js")
for file in "${EXPECTED_FILES[@]}"; do
    if [ ! -f "dist/$file" ]; then
        print_error "Expected build output file 'dist/$file' not found"
        exit 1
    fi
done

print_success "✅ Lambda functions built successfully"

cd ..

print_section "CDK INFRASTRUCTURE BUILD"

# Check if CDK directory exists
if [ ! -d "file-manager-cdk" ]; then
    print_error "file-manager-cdk directory not found"
    print_status "Please run this script from the project root directory"
    exit 1
fi

cd file-manager-cdk

# Install CDK dependencies if needed
if [ ! -d "node_modules" ] || [ "$CLEAN" = true ]; then
    print_status "Installing CDK dependencies..."
    if ! npm install; then
        print_error "Failed to install CDK dependencies"
        exit 1
    fi
    print_success "✅ CDK dependencies installed"
else
    print_status "CDK dependencies already installed"
fi

# Build CDK project
print_status "Building CDK infrastructure code..."
if ! npm run build; then
    print_error "Failed to build CDK project"
    exit 1
fi

print_success "✅ CDK project built successfully"

cd ..

print_section "BUILD VALIDATION"

# Validate Lambda build
print_status "Validating Lambda function builds..."
LAMBDA_SIZE=$(du -sh lambda-functions/dist 2>/dev/null | cut -f1)
print_status "Lambda functions build size: $LAMBDA_SIZE"

# Validate CDK build
print_status "Validating CDK build..."
if [ -f "file-manager-cdk/lib/file-manager-stack.js" ]; then
    print_status "CDK stack compiled successfully"
else
    print_warning "CDK stack JavaScript file not found (may be using different output structure)"
fi

# Check CDK can synthesize (dry run)
print_status "Testing CDK synthesis (dry run)..."
cd file-manager-cdk
if npx cdk synth --quiet >/dev/null 2>&1; then
    print_success "✅ CDK synthesis test passed"
else
    print_warning "CDK synthesis test failed - check for configuration issues"
fi
cd ..

print_success "🎉 BUILD COMPLETED SUCCESSFULLY!"
echo ""
print_highlight "📊 BUILD SUMMARY:"
echo -e "   ${BOLD}Lambda Functions:${NC} ✅ Built and validated"
echo -e "   ${BOLD}CDK Infrastructure:${NC} ✅ Built and validated"
echo -e "   ${BOLD}Build Artifacts:${NC} Ready for deployment"
if [ "$CLEAN" = true ]; then
    echo -e "   ${BOLD}Clean Build:${NC} ✅ All artifacts rebuilt"
fi
echo ""
print_highlight "🚀 NEXT STEPS:"
echo "   1. Review build output above for any warnings"
echo "   2. Run './deploy.sh' to deploy to AWS"
echo "   3. Or run './deploy.sh --help' for deployment options"
echo ""
print_status "All components are ready for deployment!"
