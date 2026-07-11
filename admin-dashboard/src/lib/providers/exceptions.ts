/**
 * exceptions.ts
 *
 * Unified exception hierarchy for the Provider Abstraction Layer.
 * Normalizes provider-specific API errors, HTTP failures, and credential issues
 * into consistent internal exceptions.
 */

export class ProviderException extends Error {
  public readonly providerName: string;
  public readonly errorCode: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    providerName: string,
    errorCode: string = 'PROVIDER_ERROR',
    statusCode: number = 500,
    details?: unknown
  ) {
    super(message);
    this.name = 'ProviderException';
    this.providerName = providerName;
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, ProviderException.prototype);
  }
}

export class ProviderNotConfiguredException extends ProviderException {
  constructor(providerName: string, missingField?: string) {
    const message = missingField
      ? `Provider "${providerName}" is not configured: missing required credential variable "${missingField}" in .env.`
      : `Provider "${providerName}" is not configured: missing API credentials in .env.`;
    super(message, providerName, 'PROVIDER_NOT_CONFIGURED', 503);
    this.name = 'ProviderNotConfiguredException';
    Object.setPrototypeOf(this, ProviderNotConfiguredException.prototype);
  }
}

export class ProviderNotImplementedException extends ProviderException {
  constructor(providerName: string, methodName: string) {
    super(
      `Method "${methodName}" is not implemented by the provider adapter "${providerName}".`,
      providerName,
      'PROVIDER_NOT_IMPLEMENTED',
      501
    );
    this.name = 'ProviderNotImplementedException';
    Object.setPrototypeOf(this, ProviderNotImplementedException.prototype);
  }
}

export class ProviderAuthenticationException extends ProviderException {
  constructor(providerName: string, details?: unknown) {
    super(
      `Authentication failed with provider "${providerName}". Check API credentials.`,
      providerName,
      'PROVIDER_AUTH_ERROR',
      401,
      details
    );
    this.name = 'ProviderAuthenticationException';
    Object.setPrototypeOf(this, ProviderAuthenticationException.prototype);
  }
}

export class ProviderAPIException extends ProviderException {
  constructor(providerName: string, message: string, statusCode: number = 502, details?: unknown) {
    super(
      `Provider "${providerName}" API request failed: ${message}`,
      providerName,
      'PROVIDER_API_ERROR',
      statusCode,
      details
    );
    this.name = 'ProviderAPIException';
    Object.setPrototypeOf(this, ProviderAPIException.prototype);
  }
}

export class ProviderKYCException extends ProviderException {
  constructor(providerName: string, reason: string, details?: unknown) {
    super(
      `Cardholder KYC verification failed or rejected by provider "${providerName}": ${reason}`,
      providerName,
      'PROVIDER_KYC_FAILED',
      400,
      details
    );
    this.name = 'ProviderKYCException';
    Object.setPrototypeOf(this, ProviderKYCException.prototype);
  }
}

export class ProviderRateLimitException extends ProviderException {
  constructor(providerName: string, details?: unknown) {
    super(
      `Rate limit exceeded for provider "${providerName}".`,
      providerName,
      'PROVIDER_RATE_LIMIT_EXCEEDED',
      429,
      details
    );
    this.name = 'ProviderRateLimitException';
    Object.setPrototypeOf(this, ProviderRateLimitException.prototype);
  }
}

export class ProviderCardNotFoundException extends ProviderException {
  constructor(providerName: string, providerCardId: string) {
    super(
      `Card "${providerCardId}" was not found on provider "${providerName}".`,
      providerName,
      'PROVIDER_CARD_NOT_FOUND',
      404
    );
    this.name = 'ProviderCardNotFoundException';
    Object.setPrototypeOf(this, ProviderCardNotFoundException.prototype);
  }
}

/**
 * Normalizes arbitrary unknown errors or exceptions into a standardized format.
 */
export function normalizeProviderError(
  error: unknown,
  providerName: string
): { code: string; message: string; statusCode: number; details?: unknown } {
  if (error instanceof ProviderException) {
    return {
      code: error.errorCode,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      code: 'PROVIDER_UNEXPECTED_ERROR',
      message: error.message,
      statusCode: 500,
      details: { name: error.name, stack: error.stack },
    };
  }

  return {
    code: 'PROVIDER_UNKNOWN_ERROR',
    message: String(error) || `Unknown error occurred with provider "${providerName}"`,
    statusCode: 500,
    details: error,
  };
}
