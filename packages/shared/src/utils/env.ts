/**
 * Get required environment variable
 * Throws if variable is not set
 */
export function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

/**
 * Get optional environment variable
 * Returns undefined if not set
 */
export function getEnvOptional(key: string): string | undefined {
  return process.env[key];
}

/**
 * Get environment variable as number
 * Throws if variable is not set or not a valid number
 */
export function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (!value) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return parsed;
}

/**
 * Get environment variable as boolean
 */
export function getEnvBoolean(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (!value) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Get environment variable as array (comma-separated)
 */
export function getEnvArray(key: string, defaultValue: string[] = []): string[] {
  const value = process.env[key];
  if (!value) {
    return defaultValue;
  }
  return value.split(',').map(v => v.trim()).filter(Boolean);
}
