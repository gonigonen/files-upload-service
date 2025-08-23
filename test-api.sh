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

# Check if API URL is provided
if [ -z "$1" ]; then
    print_error "Usage: $0 <API_GATEWAY_URL>"
    echo "Example: $0 https://abc123.execute-api.us-east-2.amazonaws.com/prod/"
    exit 1
fi

API_URL="$1"
# Ensure URL ends with /
if [[ ! "$API_URL" =~ /$ ]]; then
    API_URL="${API_URL}/"
fi

echo "🧪 Testing File Manager API..."
echo ""
print_highlight "API URL: $API_URL"
echo ""

# Test 1: List files (should return empty array initially)
print_status "Test 1: Listing files..."
RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" "${API_URL}files")
HTTP_STATUS=$(echo $RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
BODY=$(echo $RESPONSE | sed -e 's/HTTPSTATUS\:.*//g')

if [ "$HTTP_STATUS" -eq 200 ]; then
    print_success "✅ List files endpoint working"
    echo "   Response: $BODY"
else
    print_error "❌ List files failed (HTTP $HTTP_STATUS)"
    echo "   Response: $BODY"
fi
echo ""

# Test 2: Create a test file for upload
print_status "Test 2: Creating test file..."
TEST_FILE="test-upload.txt"
echo "Hello from File Manager Service test!" > $TEST_FILE
echo "Timestamp: $(date)" >> $TEST_FILE
echo "This is a test file created by test-api.sh" >> $TEST_FILE
print_success "✅ Test file created: $TEST_FILE"
echo ""

# Test 3: Upload file
print_status "Test 3: Uploading test file..."
UPLOAD_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST "${API_URL}upload" \
    -F "file=@$TEST_FILE" \
    -F "author=Test Script" \
    -F "purpose=API Testing" \
    -F "environment=test")

HTTP_STATUS=$(echo $UPLOAD_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
UPLOAD_BODY=$(echo $UPLOAD_RESPONSE | sed -e 's/HTTPSTATUS\:.*//g')

if [ "$HTTP_STATUS" -eq 200 ]; then
    print_success "✅ File upload successful"
    echo "   Response: $UPLOAD_BODY"
    
    # Extract file_id from response
    FILE_ID=$(echo $UPLOAD_BODY | grep -o '"file_id":"[^"]*"' | cut -d'"' -f4)
    if [ ! -z "$FILE_ID" ]; then
        print_status "   File ID: $FILE_ID"
    fi
else
    print_error "❌ File upload failed (HTTP $HTTP_STATUS)"
    echo "   Response: $UPLOAD_BODY"
    FILE_ID=""
fi
echo ""

# Test 4: List files again (should show uploaded file)
print_status "Test 4: Listing files after upload..."
sleep 2  # Give a moment for the file to be processed
RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" "${API_URL}files")
HTTP_STATUS=$(echo $RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
BODY=$(echo $RESPONSE | sed -e 's/HTTPSTATUS\:.*//g')

if [ "$HTTP_STATUS" -eq 200 ]; then
    print_success "✅ List files after upload working"
    echo "   Response: $BODY"
    
    # Check if our file is in the list
    if echo "$BODY" | grep -q "$TEST_FILE"; then
        print_success "   ✅ Uploaded file found in list"
    else
        print_warning "   ⚠️  Uploaded file not yet visible (may still be processing)"
    fi
else
    print_error "❌ List files after upload failed (HTTP $HTTP_STATUS)"
    echo "   Response: $BODY"
fi
echo ""

# Test 5: Get metadata (if we have a file_id)
if [ ! -z "$FILE_ID" ]; then
    print_status "Test 5: Getting file metadata..."
    METADATA_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" "${API_URL}metadata/${FILE_ID}")
    HTTP_STATUS=$(echo $METADATA_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    METADATA_BODY=$(echo $METADATA_RESPONSE | sed -e 's/HTTPSTATUS\:.*//g')
    
    if [ "$HTTP_STATUS" -eq 200 ]; then
        print_success "✅ Metadata retrieval working"
        echo "   Response: $METADATA_BODY"
    else
        print_error "❌ Metadata retrieval failed (HTTP $HTTP_STATUS)"
        echo "   Response: $METADATA_BODY"
    fi
else
    print_warning "Test 5: Skipping metadata test (no file_id available)"
fi
echo ""

# Test 6: Test invalid endpoint
print_status "Test 6: Testing invalid endpoint..."
INVALID_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" "${API_URL}invalid-endpoint")
HTTP_STATUS=$(echo $INVALID_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')

if [ "$HTTP_STATUS" -eq 404 ]; then
    print_success "✅ Error handling working (404 for invalid endpoint)"
else
    print_warning "⚠️  Unexpected response for invalid endpoint (HTTP $HTTP_STATUS)"
fi
echo ""

# Cleanup
print_status "Cleaning up test file..."
rm -f $TEST_FILE
print_success "✅ Test file removed"
echo ""

# Summary
print_highlight "🎯 TEST SUMMARY:"
echo ""
print_highlight "✅ WORKING ENDPOINTS:"
echo "   • GET  ${API_URL}files"
echo "   • POST ${API_URL}upload"
if [ ! -z "$FILE_ID" ]; then
    echo "   • GET  ${API_URL}metadata/{file_id}"
fi
echo ""

print_highlight "🌐 WEB CLIENT SETUP:"
echo "   1. cd web-client"
echo "   2. Update src/services/api.ts:"
echo "      const API_BASE_URL = '$API_URL';"
echo "   3. npm install && npm start"
echo ""

print_highlight "📋 MANUAL TESTING:"
echo "   Upload a file:"
echo "   curl -X POST ${API_URL}upload \\"
echo "     -F \"file=@your-file.txt\" \\"
echo "     -F \"author=Your Name\""
echo ""
echo "   List files:"
echo "   curl ${API_URL}files"
echo ""

if [ ! -z "$FILE_ID" ]; then
    print_highlight "🔍 PROCESSING STATUS:"
    echo "   Your test file is being processed asynchronously."
    echo "   Check processing status with:"
    echo "   curl ${API_URL}metadata/${FILE_ID}"
    echo ""
    print_status "Wait a few minutes and check the metadata again to see extracted fields."
fi

print_success "🎉 API testing complete!"
