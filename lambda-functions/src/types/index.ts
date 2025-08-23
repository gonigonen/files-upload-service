/**
 * Shared types and interfaces for File Manager Service
 */

// ===== API Gateway Types =====

export interface APIResponse<T = any> {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

// ===== File-related Types =====

export interface FileData {
  filename: string;
  contentType: string;
  content: Buffer;
}

export interface FileMetadata {
  file_id: string;
  file_name: string;
  content_type: string;
  s3_key: string;
  upload_date: string;
  file_size: number;
  status: FileStatus;
  client_metadata?: Record<string, string | number | boolean>;
  // Extracted metadata fields (flattened for DynamoDB queries)
  extracted_file_type?: ExtractedFileType;
  extracted_category?: ExtractedCategory;
  extracted_size_category?: ExtractedSizeCategory;
  extracted_file_extension?: string;
  extracted_estimated_pages?: number;
  extracted_estimated_lines?: number;
  extracted_format?: string;
  processing_timestamp?: string;
}

export interface FileListItem {
  file_id: string;
  file_name: string;
  upload_date: string;
  file_size: number;
  status: FileStatus;
  content_type?: string;
}

// ===== Multipart Upload Types =====

export interface ParsedMultipartData {
  fileData: FileData | null;
  metadata: Record<string, string | number | boolean>;
}

export interface MultipartPart {
  name: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
}

// ===== Validation Types =====

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  cleanedMetadata: Record<string, string | number | boolean>;
}

// ===== Response Types =====

export interface UploadResponse {
  file_id: string;
  message: string;
  s3_key: string;
  file_name: string;
  file_size: number;
  metadata_fields_stored: number;
}

export interface ListFilesResponse {
  files: FileListItem[];
  total_count: number;
  scanned_count?: number;
  next_key?: string;
}

export interface MetadataResponse {
  file_id: string;
  metadata: FileMetadata;
}

export interface ErrorResponse {
  error: string;
  details?: string[];
  timestamp: string;
  [key: string]: any;
}

// ===== Processing Types =====

export interface ExtractedMetadata {
  file_size: number;
  content_type: string;
  file_extension: string;
  processing_timestamp: string;
  file_type: ExtractedFileType;
  category: ExtractedCategory;
  size_category: ExtractedSizeCategory;
  format?: string;
  estimated_pages?: number;
  estimated_lines?: number;
}

// ===== Enums and Constants =====

export enum FileStatus {
  UPLOADED = 'uploaded',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  ERROR = 'error'
}

export enum ExtractedFileType {
  PDF = 'pdf',
  IMAGE = 'image',
  TEXT = 'text',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  ARCHIVE = 'archive',
  UNKNOWN = 'unknown'
}

export enum ExtractedCategory {
  DOCUMENT = 'document',
  MEDIA = 'media',
  COMPRESSED = 'compressed',
  TEXT = 'text',
  OTHER = 'other'
}

export enum ExtractedSizeCategory {
  SMALL = 'small',    // < 1MB
  MEDIUM = 'medium',  // 1MB - 10MB
  LARGE = 'large'     // > 10MB
}

// ===== Logging Types =====

export interface LogContext {
  functionName?: string;
  requestId?: string;
  fileId?: string;
  userId?: string;
  bucketName?: string;
  objectKey?: string;
  objectSize?: number;
  fileName?: string;
  [key: string]: any;
}

export interface PerformanceMetrics {
  operation: string;
  duration_ms: number;
  memory_used?: number;
  items_processed?: number;
}

export interface HttpMetrics {
  method: string;
  endpoint: string;
  status_code: number;
  duration_ms: number;
  request_size?: number;
  response_size?: number;
}

// ===== S3 Event Types =====

export interface S3EventRecord {
  eventVersion: string;
  eventSource: string;
  eventTime: string;
  eventName: string;
  s3: {
    bucket: {
      name: string;
    };
    object: {
      key: string;
      size: number;
    };
  };
}

// ===== DynamoDB Types =====

export interface DynamoDBUpdateExpression {
  UpdateExpression: string;
  ExpressionAttributeNames: Record<string, string>;
  ExpressionAttributeValues: Record<string, any>;
}

// ===== Configuration Types =====

export interface LambdaConfig {
  tableName: string;
  bucketName: string;
  region: string;
  logLevel: string;
  maxFileSize: number;
  allowedFileTypes: string[];
}

// ===== Utility Types =====

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type Partial<T> = { [P in keyof T]?: T[P] };
export type Required<T> = { [P in keyof T]-?: T[P] };

// ===== Type Guards =====

export function isFileData(obj: any): obj is FileData {
  return obj && 
    typeof obj.filename === 'string' &&
    typeof obj.contentType === 'string' &&
    Buffer.isBuffer(obj.content);
}

export function isValidFileStatus(status: string): status is FileStatus {
  return Object.values(FileStatus).includes(status as FileStatus);
}

export function isValidExtractedFileType(type: string): type is ExtractedFileType {
  return Object.values(ExtractedFileType).includes(type as ExtractedFileType);
}

// ===== Constants =====

export const FILE_SIZE_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  SMALL_FILE_THRESHOLD: 1024 * 1024, // 1MB
  LARGE_FILE_THRESHOLD: 10 * 1024 * 1024, // 10MB
} as const;

export const SUPPORTED_FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  TEXT: ['text/plain', 'text/csv', 'application/json', 'text/xml'],
  ARCHIVES: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'],
} as const;

export const S3_KEY_PATTERNS = {
  UPLOAD_PREFIX: 'uploads/',
  PROCESSED_PREFIX: 'processed/',
  TEMP_PREFIX: 'temp/',
} as const;

export const DYNAMODB_ATTRIBUTES = {
  PARTITION_KEY: 'file_id',
  SORT_KEY: 'upload_date',
  GSI_STATUS: 'status-index',
  GSI_FILE_TYPE: 'file-type-index',
} as const;
