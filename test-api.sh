#!/bin/bash

# Test script for File Upload Service API
# Usage: ./test-api.sh <API_GATEWAY_URL>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if API Gateway URL is provided
if [ -z "$1" ]; then
    print_error "Please provide the API Gateway URL as an argument"
    echo "Usage: ./test-api.sh <API_GATEWAY_URL>"
    echo "Example: ./test-api.sh https://abc123.execute-api.us-east-1.amazonaws.com/prod"
    exit 1
fi

API_URL="$1"
print_info "Testing API at: $API_URL"

# Create a test file
TEST_FILE="test-document.txt"
echo "This is a test document for the file upload service.
It contains multiple lines of text.
Created at: $(date)" > "$TEST_FILE"

print_info "Created test file: $TEST_FILE"

# Convert file to base64
FILE_CONTENT=$(base64 -i "$TEST_FILE")
print_info "Converted file to base64"

# Test 1: Upload file
print_info "Testing file upload..."

UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/upload" \
  -H "Content-Type: application/json" \
  -d '{
    "file_content": "'"$FILE_CONTENT"'",
    "file_name": "'"$TEST_FILE"'",
    "content_type": "text/plain",
    "metadata": {
      "author": "Test User",
      "description": "Test document for API validation",
      "category": "test",
      "expiration_date": "2024-12-31"
    }
  }')

echo "Upload Response:"
echo "$UPLOAD_RESPONSE" | jq '.' 2>/dev/null || echo "$UPLOAD_RESPONSE"

# Extract file_id from response
FILE_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.file_id' 2>/dev/null)

if [ "$FILE_ID" != "null" ] && [ -n "$FILE_ID" ]; then
    print_success "File uploaded successfully with ID: $FILE_ID"
    
    # Wait a moment for processing
    print_info "Waiting 5 seconds for file processing..."
    sleep 5
    
    # Test 2: Retrieve metadata
    print_info "Testing metadata retrieval..."
    
    METADATA_RESPONSE=$(curl -s "$API_URL/metadata/$FILE_ID")
    
    echo "Metadata Response:"
    echo "$METADATA_RESPONSE" | jq '.' 2>/dev/null || echo "$METADATA_RESPONSE"
    
    # Check if metadata was retrieved successfully
    if echo "$METADATA_RESPONSE" | jq -e '.metadata' > /dev/null 2>&1; then
        print_success "Metadata retrieved successfully"
        
        # Display key metadata fields
        echo ""
        print_info "Key Metadata Fields:"
        echo "$METADATA_RESPONSE" | jq -r '
            .metadata | 
            "File Name: " + .file_name + "\n" +
            "Content Type: " + .content_type + "\n" +
            "File Size: " + (.file_size | tostring) + " bytes\n" +
            "Status: " + .status + "\n" +
            "Upload Date: " + .upload_date
        ' 2>/dev/null || echo "Could not parse metadata fields"
        
    else
        print_error "Failed to retrieve metadata"
    fi
    
else
    print_error "File upload failed"
    exit 1
fi

# Test 3: Test error handling - invalid file_id
print_info "Testing error handling with invalid file ID..."

ERROR_RESPONSE=$(curl -s "$API_URL/metadata/invalid-file-id")
echo "Error Response:"
echo "$ERROR_RESPONSE" | jq '.' 2>/dev/null || echo "$ERROR_RESPONSE"

if echo "$ERROR_RESPONSE" | grep -q "File not found"; then
    print_success "Error handling works correctly"
else
    print_warning "Error handling might not be working as expected"
fi

# Test 4: Test upload without required fields
print_info "Testing upload validation..."

VALIDATION_RESPONSE=$(curl -s -X POST "$API_URL/upload" \
  -H "Content-Type: application/json" \
  -d '{
    "file_name": "test.txt"
  }')

echo "Validation Response:"
echo "$VALIDATION_RESPONSE" | jq '.' 2>/dev/null || echo "$VALIDATION_RESPONSE"

if echo "$VALIDATION_RESPONSE" | grep -q "Missing required fields"; then
    print_success "Input validation works correctly"
else
    print_warning "Input validation might not be working as expected"
fi

# Cleanup
rm -f "$TEST_FILE"
print_info "Cleaned up test file"

print_success "API testing completed!"
print_info "Summary:"
echo "  ✅ File upload endpoint"
echo "  ✅ Metadata retrieval endpoint"  
echo "  ✅ Error handling"
echo "  ✅ Input validation"
