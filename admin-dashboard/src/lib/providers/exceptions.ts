/**
 * exceptions.ts
 *
 * Custom exceptions thrown by the provider-agnostic financial infrastructure.
 */

export class ProviderNotConfiguredException extends Error {
  constructor(providerName: string, missingField?: string) {
    const message = missingField
      ? `Provider "${providerName}" is not configured: missing required credential variable "${missingField}" in .env.`
      : `Provider "${providerName}" is not configured: missing API credentials in .env.`;
    super(message);
    this.name = 'ProviderNotConfiguredException';
    Object.setPrototypeOf(this, ProviderNotConfiguredException.prototype);
  }
}

export class ProviderNotImplementedException extends Error {
  constructor(providerName: string, methodName: string) {
    super(`Method "${methodName}" is not implemented by the provider adapter "${providerName}".`);
    this.name = 'ProviderNotImplementedException';
    Object.setPrototypeOf(this, ProviderNotImplementedException.prototype);
  }
}
