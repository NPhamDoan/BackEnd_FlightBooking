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
  generateBookingCode: jest.fn(() => 'TESTCODE'),
}));

import {
  createBooking,
  cancelBooking,
  getBookingHistory,
  getBookingById,
  getAllBookings,
  adminUpdateBookingStatus,
  adminCancelFlight,
} from '../../src/BookingCtrl/booking.controller';

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
// createBooking
// ═══════════════════════════════════════════════════════════════════════════════

describe('createBooking', () => {
  const validBody = {
    flightId: 1,
    passengers: [
      { fullName: 'Nguyen Van A', dateOfBirth: '1990-01-01', idNumber: '123456789', idType: 'cccd' },
    ],
    seatIds: [10],
  };

  it('should return 201 with booking on success', () => {
    // 1. mockGet: flight check
    mockGet.mockReturnValueOnce({ id: 1, base_price: 1000000, status: 'scheduled' });
    // 2. mockAll: seats check
    mockAll.mockReturnValueOnce([{ id: 10, price_modifier: 1.5 }]);
    // 3. mockRun: INSERT booking
    mockRun.mockReturnValueOnce({ lastInsertRowid: 100, changes: 1 });
    // 4. mockRun: INSERT passenger
    mockRun.mockReturnValueOnce({ lastInsertRowid: 1, changes: 1 });
    // 5. mockRun: UPDATE seats
    mockRun.mockReturnValueOnce({ changes: 1 });

    const req = mockReq({ body: validBody, user: { id: 1, email: 'test@test.com', role: 'customer' } as any });
    const res = mockRes();
    const next = mockNext();

    createBooking(req, res, next);

    expect(mockTransaction).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      booking: expect.objectContaining({
        id: 100,
        booking_code: 'TESTCODE',
        status: 'pending',
        total_amount: 1500000,
      }),
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with AppError 404 when flight not found or not scheduled', () => {
    // mockGet: flight check returns undefined
    mockGet.mockReturnValueOnce(undefined);

    const req = mockReq({ body: validBody, user: { id: 1, email: 'test@test.com', role: 'customer' } as any });
    const res = mockRes();
    const next = mockNext();

    createBooking(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next with AppError 409 when seats already booked (seats.length !== seatIds.length)', () => {
    // mockGet: flight exists
    mockGet.mockReturnValueOnce({ id: 1, base_price: 1000000, status: 'scheduled' });
    // mockAll: only 0 seats returned (all booked)
    mockAll.mockReturnValueOnce([]);

    const req = mockReq({ body: validBody, user: { id: 1, email: 'test@test.com', role: 'customer' } as any });
    const res = mockRes();
    const next = mockNext();

    createBooking(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next with AppError 400 when passengers count !== seatIds count', () => {
    const badBody = {
      flightId: 1,
      passengers: [
        { fullName: 'Nguyen Van A', dateOfBirth: '1990-01-01', idNumber: '123456789', idType: 'cccd' },
        { fullName: 'Nguyen Van B', dateOfBirth: '1991-02-02', idNumber: '987654321', idType: 'cccd' },
      ],
      seatIds: [10], // 2 passengers but only 1 seat
    };

    const req = mockReq({ body: badBody, user: { id: 1, email: 'test@test.com', role: 'customer' } as any });
    const res = mockRes();
    const next = mockNext();

    createBooking(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should calculate totalAmount correctly: base_price * price_modifier for each seat', () => {
    const multiBody = {
      flightId: 1,
      passengers: [
        { fullName: 'Nguyen Van A', dateOfBirth: '1990-01-01', idNumber: '111', idType: 'cccd' },
        { fullName: 'Nguyen Van B', dateOfBirth: '1991-02-02', idNumber: '222', idType: 'cccd' },
        { fullName: 'Nguyen Van C', dateOfBirth: '1992-03-03', idNumber: '333', idType: 'passport' },
      ],
      seatIds: [10, 20, 30],
    };

    // base_price = 1000000
    // seat 10: modifier 3.0 (first) → 3,000,000
    // seat 20: modifier 2.0 (business) → 2,000,000
    // seat 30: modifier 1.0 (economy) → 1,000,000
    // total = 6,000,000

    // 1. mockGet: flight
    mockGet.mockReturnValueOnce({ id: 1, base_price: 1000000, status: 'scheduled' });
    // 2. mockAll: seats
    mockAll.mockReturnValueOnce([
      { id: 10, price_modifier: 3.0 },
      { id: 20, price_modifier: 2.0 },
      { id: 30, price_modifier: 1.0 },
    ]);
    // 3. mockRun: INSERT booking
    mockRun.mockReturnValueOnce({ lastInsertRowid: 200, changes: 1 });
    // 4. mockRun: INSERT passenger x3
    mockRun.mockReturnValueOnce({ lastInsertRowid: 1, changes: 1 });
    mockRun.mockReturnValueOnce({ lastInsertRowid: 2, changes: 1 });
    mockRun.mockReturnValueOnce({ lastInsertRowid: 3, changes: 1 });
    // 5. mockRun: UPDATE seats
    mockRun.mockReturnValueOnce({ changes: 3 });

    const req = mockReq({ body: multiBody, user: { id: 1, email: 'test@test.com', role: 'customer' } as any });
    const res = mockRes();
    const next = mockNext();

    createBooking(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonCall.booking.total_amount).toBe(6000000);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// cancelBooking
// ═══════════════════════════════════════════════════════════════════════════════

describe('cancelBooking', () => {
  const futureDate = new Date(Date.now() + 86400000).toISOString(); // tomorrow

  it('should return 200 with booking status=cancelled on success', () => {
    // 1. mockGet: booking+flight check
    mockGet.mockReturnValueOnce({
      id: 1, user_id: 1, flight_id: 1, booking_code: 'ABC12345',
      status: 'pending', total_amount: 1500000,
      created_at: '2025-01-01', updated_at: '2025-01-01',
      departure_time: futureDate,
    });
    // 2. mockRun: UPDATE booking
    mockRun.mockReturnValueOnce({ changes: 1 });
    // 3. mockRun: UPDATE seats
    mockRun.mockReturnValueOnce({ changes: 1 });
    // 4. mockRun: UPDATE payments
    mockRun.mockReturnValueOnce({ changes: 0 });

    const req = mockReq({ params: { id: '1' }, user: { id: 1, email: 'test@test.com', role: 'customer' } as any });
    const res = mockRes();
    const next = mockNext();

    cancelBooking(req, res, next);

    expect(mockTransaction).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      booking: expect.objectContaining({
        id: 1,
        status: 'cancelled',
      }),
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with AppError 404 when booking not found or not owned by user', () => {
    mockGet.mockReturnValueOnce(undefined);

    const req = mockReq({ params: { id: '999' }, user: { id: 1, email: 'test@test.com', role: 'customer' } as any });
    const res = mockRes();
    const next = mockNext();

    cancelBooking(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next with AppError 400 when booking already cancelled or completed', () => {
    mockGet.mockReturnValueOnce({
      id: 1, user_id: 1, flight_id: 1, booking_code: 'ABC12345',
      status: 'cancelled', total_amount: 1500000,
      created_at: '2025-01-01', updated_at: '2025-01-01',
      departure_time: futureDate,
    });

    const req = mockReq({ params: { id: '1' }, user: { id: 1, email: 'test@test.com', role: 'customer' } as any });
    const res = mockRes();
    const next = mockNext();

    cancelBooking(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next with AppError 400 when flight already departed', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString(); // yesterday

    mockGet.mockReturnValueOnce({
      id: 1, user_id: 1, flight_id: 1, booking_code: 'ABC12345',
      status: 'confirmed', total_amount: 1500000,
      created_at: '2025-01-01', updated_at: '2025-01-01',
      departure_time: pastDate,
    });

    const req = mockReq({ params: { id: '1' }, user: { id: 1, email: 'test@test.com', role: 'customer' } as any });
    const res = mockRes();
    const next = mockNext();

    cancelBooking(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(res.status).not.toHaveBeenCalled();
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// getBookingHistory
// ═══════════════════════════════════════════════════════════════════════════════

describe('getBookingHistory', () => {
  const sampleBooking = {
    id: 1, user_id: 1, flight_id: 1, booking_code: 'ABC12345',
    status: 'pending', total_amount: 1500000,
    airline_name: 'Vietnam Airlines', airline_code: 'VNA',
    departure_airport_code: 'SGN', departure_airport_city: 'Ho Chi Minh',
    arrival_airport_code: 'HAN', arrival_airport_city: 'Ha Noi',
    departure_time: '2025-06-15T08:00:00Z', arrival_time: '2025-06-15T10:00:00Z',
  };

  it('should return 200 with paginated result', () => {
    mockAll.mockReturnValueOnce([sampleBooking]);
    mockGet.mockReturnValueOnce({ count: 1 });

    const req = mockReq({ query: {}, user: { id: 1, email: 'test@test.com', role: 'customer' } as any });
    const res = mockRes();
    const next = mockNext();

    getBookingHistory(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.any(Array),
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should use default pagination page=1, limit=20', () => {
    mockAll.mockReturnValueOnce([]);
    mockGet.mockReturnValueOnce({ count: 0 });

    const req = mockReq({ query: {}, user: { id: 1, email: 'test@test.com', role: 'customer' } as any });
    const res = mockRes();
    const next = mockNext();

    getBookingHistory(req, res, next);

    const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonCall.page).toBe(1);
    expect(jsonCall.limit).toBe(20);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getBookingById
// ═══════════════════════════════════════════════════════════════════════════════

describe('getBookingById', () => {
  const bookingDetail = {
    id: 1, user_id: 1, flight_id: 1, booking_code: 'ABC12345',
    status: 'confirmed', total_amount: 1500000,
    airline_name: 'Vietnam Airlines', airline_code: 'VNA',
    departure_airport_code: 'SGN', departure_airport_city: 'Ho Chi Minh',
    arrival_airport_code: 'HAN', arrival_airport_city: 'Ha Noi',
    departure_time: '2025-06-15T08:00:00Z', arrival_time: '2025-06-15T10:00:00Z',
  };

  const passengers = [
    { full_name: 'Nguyen Van A', date_of_birth: '1990-01-01', id_number: '123456789', id_type: 'cccd', seat_number: '1A', seat_class: 'first' },
  ];

  const payment = {
    payment_status: 'success', payment_method: 'credit_card',
    transaction_code: 'TXN123', paid_at: '2025-01-01T12:00:00Z',
  };

  it('should return 200 with booking detail including passengers and payment info', () => {
    // 1. mockGet: booking with flight info
    mockGet.mockReturnValueOnce(bookingDetail);
    // 2. mockAll: passengers
    mockAll.mockReturnValueOnce(passengers);
    // 3. mockGet: payment
    mockGet.mockReturnValueOnce(payment);

    const req = mockReq({ params: { id: '1' }, user: { id: 1, email: 'test@test.com', role: 'customer' } as any });
    const res = mockRes();
    const next = mockNext();

    getBookingById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonCall.booking).toEqual(expect.objectContaining({
      id: 1,
      booking_code: 'ABC12345',
      passengers,
      payment_status: 'success',
      payment_method: 'credit_card',
      transaction_code: 'TXN123',
      paid_at: '2025-01-01T12:00:00Z',
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with AppError 404 when not found or not owned by user', () => {
    mockGet.mockReturnValueOnce(undefined);

    const req = mockReq({ params: { id: '999' }, user: { id: 1, email: 'test@test.com', role: 'customer' } as any });
    const res = mockRes();
    const next = mockNext();

    getBookingById(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(res.status).not.toHaveBeenCalled();
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// getAllBookings (admin)
// ═══════════════════════════════════════════════════════════════════════════════

describe('getAllBookings', () => {
  const sampleBooking = {
    id: 1, user_id: 1, flight_id: 1, booking_code: 'ABC12345',
    status: 'confirmed', total_amount: 1500000,
    departure_time: '2025-06-15T08:00:00Z', arrival_time: '2025-06-15T10:00:00Z',
    airline_name: 'Vietnam Airlines', airline_code: 'VNA',
    user_email: 'test@test.com', user_full_name: 'Nguyen Van A',
  };

  it('should return 200 with paginated result', () => {
    mockAll.mockReturnValueOnce([sampleBooking]);
    mockGet.mockReturnValueOnce({ count: 1 });

    const req = mockReq({ query: {}, user: { id: 1, email: 'admin@test.com', role: 'admin' } as any });
    const res = mockRes();
    const next = mockNext();

    getAllBookings(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.any(Array),
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// adminUpdateBookingStatus
// ═══════════════════════════════════════════════════════════════════════════════

describe('adminUpdateBookingStatus', () => {
  it('should return 200 with updated booking on success', () => {
    const updatedBooking = {
      id: 1, user_id: 1, flight_id: 1, booking_code: 'ABC12345',
      status: 'confirmed', total_amount: 1500000,
    };

    mockRun.mockReturnValueOnce({ changes: 1 });
    mockGet.mockReturnValueOnce(updatedBooking);

    const req = mockReq({
      params: { id: '1' },
      body: { status: 'confirmed' },
      user: { id: 1, email: 'admin@test.com', role: 'admin' } as any,
    });
    const res = mockRes();
    const next = mockNext();

    adminUpdateBookingStatus(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ booking: updatedBooking });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with AppError 404 when not found (changes === 0)', () => {
    mockRun.mockReturnValueOnce({ changes: 0 });

    const req = mockReq({
      params: { id: '999' },
      body: { status: 'confirmed' },
      user: { id: 1, email: 'admin@test.com', role: 'admin' } as any,
    });
    const res = mockRes();
    const next = mockNext();

    adminUpdateBookingStatus(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// adminCancelFlight
// ═══════════════════════════════════════════════════════════════════════════════

describe('adminCancelFlight', () => {
  it('should return 200 with message and cancelledBookings count on success', () => {
    // 1. mockGet: flight check
    mockGet.mockReturnValueOnce({ id: 1 });
    // 2. mockRun: UPDATE flight
    mockRun.mockReturnValueOnce({ changes: 1 });
    // 3. mockAll: active bookings
    mockAll.mockReturnValueOnce([{ id: 10 }, { id: 20 }]);
    // 4. mockRun: UPDATE bookings
    mockRun.mockReturnValueOnce({ changes: 2 });
    // 5. mockRun: UPDATE payments
    mockRun.mockReturnValueOnce({ changes: 1 });
    // 6. mockRun: UPDATE seats
    mockRun.mockReturnValueOnce({ changes: 5 });

    const req = mockReq({ params: { id: '1' }, user: { id: 1, email: 'admin@test.com', role: 'admin' } as any });
    const res = mockRes();
    const next = mockNext();

    adminCancelFlight(req, res, next);

    expect(mockTransaction).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Hủy chuyến bay thành công',
      cancelledBookings: 2,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with AppError 404 when flight not found', () => {
    mockGet.mockReturnValueOnce(undefined);

    const req = mockReq({ params: { id: '999' }, user: { id: 1, email: 'admin@test.com', role: 'admin' } as any });
    const res = mockRes();
    const next = mockNext();

    adminCancelFlight(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(res.status).not.toHaveBeenCalled();
  });
});
