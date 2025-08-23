import winston from 'winston';

/**
 * Log context interface
 */
export interface LogContext {
  functionName?: string;
  requestId?: string;
  fileId?: string;
  userId?: string;
  awsRegion?: string;
  s3Bucket?: string;
  dynamoTable?: string;
  httpMethod?: string;
  path?: string;
  [key: string]: any;
}

/**
 * Create Winston logger configured for AWS Lambda
 */
function createWinstonLogger(): winston.Logger {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: {
      service: 'file-manager',
      environment: process.env.NODE_ENV || 'production',
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
      region: process.env.AWS_REGION,
    },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize({ all: true }),
          winston.format.simple()
        )
      })
    ],
  });
}

/**
 * Logger wrapper class for structured logging
 */
export class Logger {
  private winston: winston.Logger;
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.winston = createWinstonLogger();
    this.context = {
      ...context,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Add context to all subsequent log messages
   */
  addContext(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  /**
   * Log info message
   */
  info(message: string, meta?: any): void {
    this.winston.info(message, { ...this.context, ...meta });
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: any): void {
    this.winston.warn(message, { ...this.context, ...meta });
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | any, meta?: any): void {
    const errorMeta = error instanceof Error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    } : { error };

    this.winston.error(message, { 
      ...this.context, 
      ...errorMeta,
      ...meta 
    });
  }

  /**
   * Log debug message
   */
  debug(message: string, meta?: any): void {
    this.winston.debug(message, { ...this.context, ...meta });
  }

  /**
   * Log verbose message
   */
  verbose(message: string, meta?: any): void {
    this.winston.verbose(message, { ...this.context, ...meta });
  }

  /**
   * Log silly message (most verbose)
   */
  silly(message: string, meta?: any): void {
    this.winston.silly(message, { ...this.context, ...meta });
  }

  /**
   * Create child logger with additional context
   */
  child(context: LogContext): Logger {
    return this.addContext(context);
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, meta?: any): void {
    this.info(`Performance: ${operation}`, {
      operation,
      duration_ms: duration,
      performance: true,
      ...meta
    });
  }

  /**
   * Log API request/response
   */
  apiCall(method: string, endpoint: string, statusCode: number, duration: number, meta?: any): void {
    this.info(`API Call: ${method} ${endpoint}`, {
      http: {
        method,
        endpoint,
        status_code: statusCode,
        duration_ms: duration,
      },
      ...meta
    });
  }
}

/**
 * Create logger with Lambda context
 */
export function createLogger(context: LogContext = {}): Logger {
  return new Logger({
    functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
    ...context,
  });
}

/**
 * Default logger instance
 */
export const logger = createLogger();
