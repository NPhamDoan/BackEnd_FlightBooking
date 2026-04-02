import crypto from 'crypto';

const ALPHANUMERIC_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generates an 8-character uppercase alphanumeric booking code.
 */
export function generateBookingCode(): string {
  let code = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += ALPHANUMERIC_UPPER[bytes[i] % ALPHANUMERIC_UPPER.length];
  }
  return code;
}

/**
 * Generates a unique transaction code using timestamp + random suffix.
 */
export function generateTransactionCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `TXN${timestamp}${random}`;
}
