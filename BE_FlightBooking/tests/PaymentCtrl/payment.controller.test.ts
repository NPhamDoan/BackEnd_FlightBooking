import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../src/shared/utils/AppError';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGet = jest.fn();
const mockRun = jest.fn();
const mockAll = jest.fn();

const mockTransaction = jest.fn((fn: Function) => {
  const trxFn = (...args: any[]) => fn(...args);
  trxFn.immediate = () => fn();
  return trxFn;
});

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: {
    prepare: jest.fn(() => ({
      get: mockGet,
      run: mockRun,
      all: mockAll,
    })),
    transaction: mockTransaction,
  },
}));

jest.mock('../../src/shared/utils/helpers', () => ({
  generateTransactionCode: jest.fn(() => 'TXN_TEST_123'),
}));

import {
  processPayment,
  getPaymentByBookingId,
} from '../../src/PaymentCtrl/payment.controller';

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    headers: {},
    user: undefined,
    params: {},
    query: {},
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn();
  return res as Response;
}

function mockNext(): NextFunction {
  return jest.fn() as unknown as NextFunction;
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});


// ═══════════════════════════════════════════════════════════════════════════════
// processPayment
// ═══════════════════════════════════════════════════════════════════════════════

describe('processPayment', () => {
  const validBody = {
    bookingId: 1,
    amount: 1500000,
    method: 'credit_card',
  };

  it('should return 200 with payment on success', () => {
    // 1. mockGet: booking check (exists, owned, pending)
    mockGet.mockReturnValueOnce({ id: 1, total_amount: 1500000 });
    // 2. mockRun: INSERT payment
    mockRun.mockReturnValueOnce({ lastInsertRowid: 10, changes: 1 });
    // 3. mockRun: UPDATE booking status to confirmed
    mockRun.mockReturnValueOnce({ changes: 1 });

    const req = mockReq({ body: validBody, user: { id: 1, email: 'test@test.com', role: 'customer' } as any });
    const res = mockRes();
    const next = mockNext();

    processPayment(req, res, next);

    expect(mockTransaction).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      payment: expect.objectContaining({
        paymentId: 10,
        status: 'success',
        transactionCode: 'TXN_TEST_123',
        paidAt: expect.any(String),
      }),
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with AppError 404 when booking not found or not owned or not pending', () => {
    // mockGet: booking check returns undefined
    mockGet.mockReturnValueOnce(undefined);

    const req = mockReq({ body: validBody, user: { id: 1, email: 'test@test.com', role: 'customer' } as any });
    const res = mockRes();
    const next = mockNext();

    processPayment(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next with AppError 400 when amount does not match booking total_amount', () => {
    // mockGet: booking exists but total_amount differs
    mockGet.mockReturnValueOnce({ id: 1, total_amount: 1500000 });

    const req = mockReq({
      body: { bookingId: 1, amount: 999, method: 'credit_card' },
      user: { id: 1, email: 'test@test.com', role: 'customer' } as any,
    });
    const res = mockRes();
    const next = mockNext();

    processPayment(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next with AppError 404 when booking already paid (status != pending)', () => {
    // Query filters status='pending', so already-paid booking returns undefined
    mockGet.mockReturnValueOnce(undefined);

    const req = mockReq({ body: validBody, user: { id: 1, email: 'test@test.com', role: 'customer' } as any });
    const res = mockRes();
    const next = mockNext();

    processPayment(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getPaymentByBookingId
// ═══════════════════════════════════════════════════════════════════════════════

describe('getPaymentByBookingId', () => {
  it('should return 200 with payment info on success', () => {
    const bookingRow = { id: 1 };
    const paymentRow = {
      id: 10, booking_id: 1, amount: 1500000, method: 'credit_card',
      status: 'success', transaction_code: 'TXN_TEST_123',
      paid_at: '2025-01-15T12:00:00Z', created_at: '2025-01-15T12:00:00Z',
    };

    // 1. mockGet: booking ownership check
    mockGet.mockReturnValueOnce(bookingRow);
    // 2. mockGet: payment lookup
    mockGet.mockReturnValueOnce(paymentRow);

    const req = mockReq({ params: { bookingId: '1' }, user: { id: 1, email: 'test@test.com', role: 'customer' } as any });
    const res = mockRes();
    const next = mockNext();

    getPaymentByBookingId(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ payment: paymentRow });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with AppError 404 when booking not found or not owned', () => {
    // First mockGet: booking check returns undefined
    mockGet.mockReturnValueOnce(undefined);

    const req = mockReq({ params: { bookingId: '999' }, user: { id: 1, email: 'test@test.com', role: 'customer' } as any });
    const res = mockRes();
    const next = mockNext();

    getPaymentByBookingId(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next with AppError 404 when no payment exists for booking', () => {
    // First mockGet: booking exists
    mockGet.mockReturnValueOnce({ id: 1 });
    // Second mockGet: no payment found
    mockGet.mockReturnValueOnce(undefined);

    const req = mockReq({ params: { bookingId: '1' }, user: { id: 1, email: 'test@test.com', role: 'customer' } as any });
    const res = mockRes();
    const next = mockNext();

    getPaymentByBookingId(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(res.status).not.toHaveBeenCalled();
  });
});
