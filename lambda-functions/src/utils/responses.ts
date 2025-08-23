import { APIGatewayProxyResult } from 'aws-lambda';
import { StatusCodes, ReasonPhrases } from 'http-status-codes';

/**
 * Standard error response interface
 */
export interface ErrorResponse {
  error: string;
  details?: string[];
  timestamp: string;
  [key: string]: any; // Allow additional fields
}

/**
 * Standard success response interface
 */
export interface SuccessResponse {
  [key: string]: any;
}

/**
 * Create standardized success response
 */
export function createSuccessResponse<T = any>(
  data: T,
  statusCode: number = StatusCodes.OK
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(data),
  };
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  statusCode: number,
  error: string,
  details?: string[],
  additionalData?: Record<string, any>
): APIGatewayProxyResult {
  const responseBody: ErrorResponse = {
    error,
    timestamp: new Date().toISOString(),
  };

  if (details && details.length > 0) {
    responseBody.details = details;
  }

  if (additionalData) {
    Object.assign(responseBody, additionalData);
  }

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(responseBody),
  };
}

/**
 * Export HTTP status codes from http-status-codes library
 */
export { StatusCodes as HTTP_STATUS } from 'http-status-codes';

/**
 * Common error messages for consistency
 */
export const ERROR_MESSAGES = {
  FILE_NOT_PROVIDED: 'No file provided in the request',
  FILE_TOO_LARGE: 'File too large',
  INVALID_METADATA: 'Invalid metadata format',
  FILE_NOT_FOUND: 'File not found',
  INTERNAL_ERROR: 'Internal server error',
  FAILED_TO_RETRIEVE_FILES: 'Failed to retrieve files',
  FAILED_TO_RETRIEVE_METADATA: 'Failed to retrieve metadata',
  MISSING_PARAMETER: 'Missing required parameter',
} as const;

/**
 * Helper function for file size validation errors
 */
export function createFileSizeError(actualSize: number, maxSize: number = 10 * 1024 * 1024): APIGatewayProxyResult {
  return createErrorResponse(
    StatusCodes.REQUEST_TOO_LONG,
    ERROR_MESSAGES.FILE_TOO_LARGE,
    [`Maximum file size is ${Math.round(maxSize / 1024 / 1024)}MB`],
    {
      max_size: `${Math.round(maxSize / 1024 / 1024)}MB`,
      actual_size: `${Math.round(actualSize / 1024 / 1024 * 100) / 100}MB`,
    }
  );
}

/**
 * Helper function for validation errors
 */
export function createValidationError(errors: string[]): APIGatewayProxyResult {
  return createErrorResponse(
    StatusCodes.BAD_REQUEST,
    ERROR_MESSAGES.INVALID_METADATA,
    errors
  );
}

/**
 * Helper function for not found errors
 */
export function createNotFoundError(resource: string = 'Resource'): APIGatewayProxyResult {
  return createErrorResponse(
    StatusCodes.NOT_FOUND,
    `${resource} not found`
  );
}

/**
 * Helper function for internal server errors
 */
export function createInternalError(error: Error): APIGatewayProxyResult {
  return createErrorResponse(
    StatusCodes.INTERNAL_SERVER_ERROR,
    ERROR_MESSAGES.INTERNAL_ERROR,
    [error.message]
  );
}

/**
 * Helper function for missing parameter errors
 */
export function createMissingParameterError(parameterName: string): APIGatewayProxyResult {
  return createErrorResponse(
    StatusCodes.BAD_REQUEST,
    ERROR_MESSAGES.MISSING_PARAMETER,
    [`Missing required parameter: ${parameterName}`]
  );
}
