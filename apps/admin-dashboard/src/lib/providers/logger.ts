/**
 * logger.ts
 *
 * Structured logging and automatic data redaction for the Provider Abstraction Layer.
 * Ensures that sensitive cardholder data (PAN, CVV, API keys, KYC secrets) is NEVER
 * written to plain logs, console output, or database records.
 */

const SENSITIVE_KEYS = new Set([
  'api_key',
  'apikey',
  'key',
  'secret',
  'client_secret',
  'token',
  'authorization',
  'cvv',
  'cvc',
  'security_code',
  'card_number',
  'cardnumber',
  'number',
  'pan',
  'ssn',
  'nationalid',
  'national_id',
  'password',
]);

/**
 * Recursively sanitizes object structures to scrub sensitive data.
 */
export function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') {
    if (typeof data === 'string') {
      // Mask standalone credit card numbers (13-19 digits)
      const cleanString = data.replace(/\b(?:\d[ -]*?){13,19}\b/g, (match) => {
        const digitsOnly = match.replace(/[^0-9]/g, '');
        if (digitsOnly.length >= 13 && digitsOnly.length <= 19) {
          return `•••• •••• •••• ${digitsOnly.slice(-4)}`;
        }
        return match;
      });
      return cleanString;
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      if (lowerKey === 'card_number' || lowerKey === 'cardnumber' || lowerKey === 'number' || lowerKey === 'pan') {
        const strVal = String(val || '');
        const last4 = strVal.replace(/[^0-9]/g, '').slice(-4);
        sanitized[key] = last4 ? `•••• •••• •••• ${last4}` : '[REDACTED]';
      } else {
        sanitized[key] = '[REDACTED]';
      }
    } else {
      sanitized[key] = sanitizeLogData(val);
    }
  }

  return sanitized;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  provider: string;
  operation: string;
  durationMs?: number;
  message: string;
  data?: unknown;
}

class StructuredProviderLogger {
  private formatLog(entry: LogEntry): string {
    const payload = {
      ...entry,
      data: sanitizeLogData(entry.data),
    };
    return JSON.stringify(payload);
  }

  public info(provider: string, operation: string, message: string, data?: unknown): void {
    const logStr = this.formatLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      provider,
      operation,
      message,
      data,
    });
    console.log(`[ProviderLogger:INFO] ${logStr}`);
  }

  public warn(provider: string, operation: string, message: string, data?: unknown): void {
    const logStr = this.formatLog({
      timestamp: new Date().toISOString(),
      level: 'warn',
      provider,
      operation,
      message,
      data,
    });
    console.warn(`[ProviderLogger:WARN] ${logStr}`);
  }

  public error(provider: string, operation: string, message: string, data?: unknown): void {
    const logStr = this.formatLog({
      timestamp: new Date().toISOString(),
      level: 'error',
      provider,
      operation,
      message,
      data,
    });
    console.error(`[ProviderLogger:ERROR] ${logStr}`);
  }

  public debug(provider: string, operation: string, message: string, data?: unknown): void {
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
      const logStr = this.formatLog({
        timestamp: new Date().toISOString(),
        level: 'debug',
        provider,
        operation,
        message,
        data,
      });
      console.debug(`[ProviderLogger:DEBUG] ${logStr}`);
    }
  }

  /**
   * Helper to execute a provider API call with execution time tracking,
   * automatic redaction, and standardized error logging.
   */
  public async logProviderCall<T>(
    providerName: string,
    operation: string,
    fn: () => Promise<T>,
    meta?: Record<string, unknown>
  ): Promise<T> {
    const start = Date.now();
    this.debug(providerName, operation, `Initiating provider call "${operation}"`, meta);

    try {
      const result = await fn();
      const durationMs = Date.now() - start;
      this.info(
        providerName,
        operation,
        `Provider call "${operation}" completed successfully`,
        { durationMs, ...meta }
      );
      return result;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      this.error(
        providerName,
        operation,
        `Provider call "${operation}" failed after ${durationMs}ms: ${err?.message || err}`,
        { durationMs, error: err?.message || err, ...meta }
      );
      throw err;
    }
  }
}

export const ProviderLogger = new StructuredProviderLogger();
