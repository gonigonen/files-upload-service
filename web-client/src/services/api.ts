import axios from 'axios';

// Configure the base URL for your API
const API_BASE_URL = 'https://jtfkv5ql16.execute-api.us-east-2.amazonaws.com/prod';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Types
export interface FileListItem {
  file_id: string;
  file_name: string;
  upload_date: string;
  file_size: number;
  status: string;
  content_type?: string;
}

export interface FileMetadata {
  file_id: string;
  file_name: string;
  content_type: string;
  s3_key: string;
  upload_date: string;
  file_size: number;
  status: string;
  client_metadata?: Record<string, any>;
  [key: string]: any; // For extracted metadata fields
}

export interface ListFilesResponse {
  files: FileListItem[];
  total_count: number;
  next_key?: string;
}

export interface UploadResponse {
  file_id: string;
  message: string;
  s3_key: string;
  file_name: string;
  file_size: number;
  metadata_fields_stored: number;
}

// Helper function for Object.entries compatibility
function getObjectEntries<T>(obj: Record<string, T>): Array<[string, T]> {
  const keys = Object.keys(obj);
  const entries: Array<[string, T]> = [];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    entries.push([key, obj[key]]);
  }
  return entries;
}

// API Functions
export const fileApi = {
  // List all files
  async listFiles(limit: number = 100): Promise<ListFilesResponse> {
    const response = await api.get(`/files?limit=${limit}`);
    return response.data;
  },

  // Get file metadata
  async getFileMetadata(fileId: string): Promise<FileMetadata> {
    const response = await api.get(`/metadata/${fileId}`);
    return response.data.metadata;
  },

  // Upload file
  async uploadFile(file: File, metadata: Record<string, any> = {}): Promise<UploadResponse> {
    // Validate file object
    if (!file) {
      throw new Error('No file provided');
    }
    
    if (!(file instanceof File)) {
      throw new Error('Invalid file object - must be a File instance');
    }
    
    if (!file.name) {
      throw new Error('File must have a name');
    }
    
    console.log('Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type);
    
    const formData = new FormData();
    formData.append('file', file, file.name); // Explicitly set filename
    
    // Add metadata fields using compatible approach
    const metadataEntries = getObjectEntries(metadata);
    for (let i = 0; i < metadataEntries.length; i++) {
      const [key, value] = metadataEntries[i];
      if (value !== undefined && value !== null && value !== '') {
        formData.append(key, String(value));
        console.log(`Added metadata: ${key} = ${value}`);
      }
    }

    // Debug: Log FormData contents
    console.log('FormData contents:');
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`${key}: File(name="${value.name}", size=${value.size}, type="${value.type}")`);
      } else {
        console.log(`${key}: ${value}`);
      }
    }

    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },
};

export default api;
