const fs = require('fs');
const path = require('path');
const https = require('https');

/**
 * Simple client for the File Upload Service
 * Usage: node example-client.js <API_URL> <FILE_PATH>
 */

class FileUploadClient {
    constructor(apiUrl) {
        this.apiUrl = apiUrl.replace(/\/$/, ''); // Remove trailing slash
    }

    /**
     * Upload a file to the service
     */
    async uploadFile(filePath, metadata = {}) {
        try {
            // Read and encode file
            const fileBuffer = fs.readFileSync(filePath);
            const fileContent = fileBuffer.toString('base64');
            const fileName = path.basename(filePath);
            const contentType = this.getContentType(fileName);

            console.log(`📤 Uploading file: ${fileName} (${fileBuffer.length} bytes)`);

            const payload = {
                file_content: fileContent,
                file_name: fileName,
                content_type: contentType,
                metadata: metadata
            };

            const response = await this.makeRequest('POST', '/upload', payload);
            
            if (response.file_id) {
                console.log('✅ Upload successful!');
                console.log(`   File ID: ${response.file_id}`);
                console.log(`   S3 Key: ${response.s3_key}`);
                return response.file_id;
            } else {
                throw new Error(response.error || 'Upload failed');
            }

        } catch (error) {
            console.error('❌ Upload failed:', error.message);
            throw error;
        }
    }

    /**
     * Retrieve metadata for a file
     */
    async getMetadata(fileId) {
        try {
            console.log(`📋 Retrieving metadata for file: ${fileId}`);
            
            const response = await this.makeRequest('GET', `/metadata/${fileId}`);
            
            if (response.metadata) {
                console.log('✅ Metadata retrieved successfully!');
                this.displayMetadata(response.metadata);
                return response.metadata;
            } else {
                throw new Error(response.error || 'Failed to retrieve metadata');
            }

        } catch (error) {
            console.error('❌ Failed to retrieve metadata:', error.message);
            throw error;
        }
    }

    /**
     * Display metadata in a formatted way
     */
    displayMetadata(metadata) {
        console.log('\n📊 File Metadata:');
        console.log('─'.repeat(50));
        console.log(`File ID: ${metadata.file_id}`);
        console.log(`File Name: ${metadata.file_name}`);
        console.log(`Content Type: ${metadata.content_type}`);
        console.log(`File Size: ${this.formatFileSize(metadata.file_size)}`);
        console.log(`Upload Date: ${new Date(metadata.upload_date).toLocaleString()}`);
        console.log(`Status: ${metadata.status}`);

        if (metadata.user_metadata && Object.keys(metadata.user_metadata).length > 0) {
            console.log('\n👤 User Metadata:');
            Object.entries(metadata.user_metadata).forEach(([key, value]) => {
                console.log(`  ${key}: ${value}`);
            });
        }

        if (metadata.extracted_metadata) {
            console.log('\n🔍 Extracted Metadata:');
            Object.entries(metadata.extracted_metadata).forEach(([key, value]) => {
                console.log(`  ${key}: ${value}`);
            });
        }
        console.log('─'.repeat(50));
    }

    /**
     * Make HTTP request to the API
     */
    makeRequest(method, endpoint, data = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.apiUrl + endpoint);
            
            const options = {
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname + url.search,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsedData = JSON.parse(responseData);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsedData);
                        } else {
                            reject(new Error(parsedData.error || `HTTP ${res.statusCode}`));
                        }
                    } catch (error) {
                        reject(new Error('Invalid JSON response'));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    /**
     * Get content type based on file extension
     */
    getContentType(fileName) {
        const ext = path.extname(fileName).toLowerCase();
        const contentTypes = {
            '.pdf': 'application/pdf',
            '.txt': 'text/plain',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.mp4': 'video/mp4',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.json': 'application/json',
            '.xml': 'application/xml',
            '.csv': 'text/csv'
        };
        return contentTypes[ext] || 'application/octet-stream';
    }

    /**
     * Format file size in human readable format
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('Usage: node example-client.js <API_URL> <FILE_PATH> [metadata]');
        console.log('Example: node example-client.js https://abc123.execute-api.us-east-1.amazonaws.com/prod document.pdf');
        process.exit(1);
    }

    const [apiUrl, filePath] = args;
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
    }

    const client = new FileUploadClient(apiUrl);
    
    try {
        // Example metadata
        const metadata = {
            author: 'Example Client',
            description: 'File uploaded via example client',
            timestamp: new Date().toISOString(),
            source: 'example-client.js'
        };

        // Upload file
        const fileId = await client.uploadFile(filePath, metadata);
        
        // Wait a moment for processing
        console.log('⏳ Waiting for file processing...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Retrieve metadata
        await client.getMetadata(fileId);
        
    } catch (error) {
        console.error('❌ Operation failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = FileUploadClient;
