import { generateBookingCode, generateTransactionCode } from '../../src/utils/helpers';

describe('generateBookingCode', () => {
  it('should return an 8-character string', () => {
    const code = generateBookingCode();
    expect(code).toHaveLength(8);
  });

  it('should contain only uppercase letters and digits', () => {
    const code = generateBookingCode();
    expect(code).toMatch(/^[A-Z0-9]{8}$/);
  });

  it('should generate different codes on successive calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateBookingCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('generateTransactionCode', () => {
  it('should start with TXN prefix', () => {
    const code = generateTransactionCode();
    expect(code.startsWith('TXN')).toBe(true);
  });

  it('should generate unique codes', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateTransactionCode()));
    expect(codes.size).toBe(20);
  });
});
