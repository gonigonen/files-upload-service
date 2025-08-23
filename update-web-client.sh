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
    echo ""
    print_highlight "💡 TIP: The API URL is automatically copied to your clipboard after deployment!"
    echo "   Just paste it here: $0 <paste-url>"
    exit 1
fi

API_URL="$1"
# Ensure URL ends with /
if [[ ! "$API_URL" =~ /$ ]]; then
    API_URL="${API_URL}/"
fi

echo "🔧 Updating Web Client Configuration..."
echo ""

# Check if web-client directory exists
if [ ! -d "web-client" ]; then
    print_error "web-client directory not found"
    print_warning "Please run this script from the project root directory"
    exit 1
fi

# Check if api.ts file exists
API_FILE="web-client/src/services/api.ts"
if [ ! -f "$API_FILE" ]; then
    print_error "API service file not found: $API_FILE"
    exit 1
fi

# Backup the original file
cp "$API_FILE" "$API_FILE.bak"
print_status "Created backup: $API_FILE.bak"

# Update the API URL
if sed -i.tmp "s|const API_BASE_URL = '.*'|const API_BASE_URL = '$API_URL'|" "$API_FILE" 2>/dev/null; then
    rm -f "$API_FILE.tmp"
    print_success "✅ API URL updated successfully!"
elif sed -i "s|const API_BASE_URL = '.*'|const API_BASE_URL = '$API_URL'|" "$API_FILE" 2>/dev/null; then
    print_success "✅ API URL updated successfully!"
else
    print_error "Failed to update API URL"
    print_warning "Please update manually in: $API_FILE"
    exit 1
fi

# Show the change
print_highlight "📝 UPDATED CONFIGURATION:"
grep "API_BASE_URL" "$API_FILE" || print_warning "Could not display updated line"
echo ""

print_highlight "🚀 NEXT STEPS:"
echo "   1. cd web-client"
echo "   2. npm install (if not done already)"
echo "   3. npm start"
echo "   4. Open http://localhost:3000"
echo ""

print_success "Web client is ready to use! 🎉"
