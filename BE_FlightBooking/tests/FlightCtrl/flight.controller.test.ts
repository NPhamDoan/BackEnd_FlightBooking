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

import {
  searchFlights,
  getFlightById,
  getFlightSeats,
  createFlight,
  updateFlight,
  deleteFlight,
} from '../../src/FlightCtrl/flight.controller';

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
// searchFlights
// ═══════════════════════════════════════════════════════════════════════════════

describe('searchFlights', () => {
  const baseQuery = {
    departure: 'SGN',
    arrival: 'HAN',
    departureDate: '2025-06-15',
  };

  const sampleFlight = {
    id: 1,
    airline_id: 1,
    departure_airport_id: 1,
    arrival_airport_id: 2,
    departure_time: '2025-06-15T08:00:00Z',
    arrival_time: '2025-06-15T10:00:00Z',
    base_price: 1500000,
    total_seats: 180,
    status: 'scheduled',
    airline_name: 'Vietnam Airlines',
    airline_code: 'VNA',
    departure_airport_code: 'SGN',
    arrival_airport_code: 'HAN',
    departure_airport_name: 'Tan Son Nhat',
    departure_airport_city: 'Ho Chi Minh',
    arrival_airport_name: 'Noi Bai',
    arrival_airport_city: 'Ha Noi',
    available_seats: 150,
  };

  it('should return 200 with paginated result', () => {
    mockAll.mockReturnValueOnce([sampleFlight]);
    mockGet.mockReturnValueOnce({ count: 1 });

    const req = mockReq({ query: baseQuery as any });
    const res = mockRes();
    const next = mockNext();

    searchFlights(req, res, next);

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

  it('should return flights with correct structure', () => {
    mockAll.mockReturnValueOnce([sampleFlight]);
    mockGet.mockReturnValueOnce({ count: 1 });

    const req = mockReq({ query: baseQuery as any });
    const res = mockRes();
    const next = mockNext();

    searchFlights(req, res, next);

    const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
    const flight = jsonCall.data[0];
    expect(flight).toHaveProperty('airline_name');
    expect(flight).toHaveProperty('departure_airport_code');
    expect(flight).toHaveProperty('available_seats');
  });

  it('should use default pagination page=1, limit=20', () => {
    mockAll.mockReturnValueOnce([]);
    mockGet.mockReturnValueOnce({ count: 0 });

    const req = mockReq({ query: baseQuery as any });
    const res = mockRes();
    const next = mockNext();

    searchFlights(req, res, next);

    const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonCall.page).toBe(1);
    expect(jsonCall.limit).toBe(20);
  });

  it('should add airline filter to query when present', () => {
    mockAll.mockReturnValueOnce([]);
    mockGet.mockReturnValueOnce({ count: 0 });

    const req = mockReq({
      query: { ...baseQuery, airline: 'VNA' } as any,
    });
    const res = mockRes();
    const next = mockNext();

    searchFlights(req, res, next);

    // The all() call should include the airline param
    expect(mockAll).toHaveBeenCalled();
    const allArgs = mockAll.mock.calls[0];
    expect(allArgs).toContain('VNA');
  });

  it('should add minPrice and maxPrice filters when present', () => {
    mockAll.mockReturnValueOnce([]);
    mockGet.mockReturnValueOnce({ count: 0 });

    const req = mockReq({
      query: { ...baseQuery, minPrice: 100000, maxPrice: 500000 } as any,
    });
    const res = mockRes();
    const next = mockNext();

    searchFlights(req, res, next);

    expect(mockAll).toHaveBeenCalled();
    const allArgs = mockAll.mock.calls[0];
    expect(allArgs).toContain(100000);
    expect(allArgs).toContain(500000);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// getFlightById
// ═══════════════════════════════════════════════════════════════════════════════

describe('getFlightById', () => {
  const flightDetail = {
    id: 1,
    airline_id: 1,
    departure_airport_id: 1,
    arrival_airport_id: 2,
    departure_time: '2025-06-15T08:00:00Z',
    arrival_time: '2025-06-15T10:00:00Z',
    base_price: 1500000,
    total_seats: 180,
    status: 'scheduled',
    airline_name: 'Vietnam Airlines',
    airline_code: 'VNA',
    departure_airport_code: 'SGN',
    arrival_airport_code: 'HAN',
    departure_airport_name: 'Tan Son Nhat',
    departure_airport_city: 'Ho Chi Minh',
    arrival_airport_name: 'Noi Bai',
    arrival_airport_city: 'Ha Noi',
    available_seats: 150,
  };

  it('should return 200 with flight detail', () => {
    mockGet.mockReturnValueOnce(flightDetail);

    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    const next = mockNext();

    getFlightById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ flight: flightDetail });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with AppError 404 when flight not found', () => {
    mockGet.mockReturnValueOnce(undefined);

    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();
    const next = mockNext();

    getFlightById(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getFlightSeats
// ═══════════════════════════════════════════════════════════════════════════════

describe('getFlightSeats', () => {
  const sampleSeats = [
    { id: 1, flight_id: 1, seat_number: '1A', class: 'first', status: 'available', price_modifier: 3.0 },
    { id: 2, flight_id: 1, seat_number: '1B', class: 'first', status: 'available', price_modifier: 3.0 },
    { id: 3, flight_id: 1, seat_number: '2A', class: 'business', status: 'available', price_modifier: 2.0 },
  ];

  it('should return 200 with seats array', () => {
    mockGet.mockReturnValueOnce({ id: 1 }); // flight exists
    mockAll.mockReturnValueOnce(sampleSeats);

    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    const next = mockNext();

    getFlightSeats(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ seats: sampleSeats });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with AppError 404 when flight not found', () => {
    mockGet.mockReturnValueOnce(undefined); // flight not found

    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();
    const next = mockNext();

    getFlightSeats(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(res.status).not.toHaveBeenCalled();
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// createFlight
// ═══════════════════════════════════════════════════════════════════════════════

describe('createFlight', () => {
  const validBody = {
    airline_id: 1,
    departure_airport_id: 1,
    arrival_airport_id: 2,
    departure_time: '2025-06-15T08:00:00Z',
    arrival_time: '2025-06-15T10:00:00Z',
    base_price: 1500000,
    total_seats: 10,
  };

  it('should return 201 with flight and seats on success', () => {
    const createdFlight = { id: 1, ...validBody, status: 'scheduled', created_at: '2025-01-01' };

    // Inside the transaction: INSERT flight → run, then INSERT seats → run (multiple), then SELECT → get
    mockRun.mockReturnValue({ lastInsertRowid: 1, changes: 1 });
    mockGet.mockReturnValue(createdFlight);

    const req = mockReq({ body: validBody });
    const res = mockRes();
    const next = mockNext();

    createFlight(req, res, next);

    expect(mockTransaction).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        flight: expect.any(Object),
        seats: expect.any(Array),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with AppError 400 when departure >= arrival', () => {
    const invalidBody = {
      ...validBody,
      departure_time: '2025-06-15T12:00:00Z',
      arrival_time: '2025-06-15T08:00:00Z',
    };

    const req = mockReq({ body: invalidBody });
    const res = mockRes();
    const next = mockNext();

    createFlight(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should generate correct seat distribution: 20% first (3.0), 20% business (2.0), 60% economy (1.0)', () => {
    const body = { ...validBody, total_seats: 10 };
    const createdFlight = { id: 1, ...body, status: 'scheduled', created_at: '2025-01-01' };

    mockRun.mockReturnValue({ lastInsertRowid: 1, changes: 1 });
    mockGet.mockReturnValue(createdFlight);

    const req = mockReq({ body });
    const res = mockRes();
    const next = mockNext();

    createFlight(req, res, next);

    const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
    const seats = jsonCall.seats;

    // 10 seats: 2 first (20%), 2 business (20%), 6 economy (60%)
    const firstSeats = seats.filter((s: any) => s.class === 'first');
    const businessSeats = seats.filter((s: any) => s.class === 'business');
    const economySeats = seats.filter((s: any) => s.class === 'economy');

    expect(firstSeats.length).toBe(2);
    expect(businessSeats.length).toBe(2);
    expect(economySeats.length).toBe(6);

    expect(firstSeats[0].price_modifier).toBe(3.0);
    expect(businessSeats[0].price_modifier).toBe(2.0);
    expect(economySeats[0].price_modifier).toBe(1.0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// updateFlight
// ═══════════════════════════════════════════════════════════════════════════════

describe('updateFlight', () => {
  it('should return 200 with updated flight on success', () => {
    const updatedFlight = {
      id: 1,
      airline_id: 1,
      departure_airport_id: 1,
      arrival_airport_id: 2,
      departure_time: '2025-06-15T08:00:00Z',
      arrival_time: '2025-06-15T10:00:00Z',
      base_price: 2000000,
      total_seats: 180,
      status: 'scheduled',
    };

    mockRun.mockReturnValueOnce({ changes: 1 });
    mockGet.mockReturnValueOnce(updatedFlight);

    const req = mockReq({
      params: { id: '1' },
      body: { base_price: 2000000 },
    });
    const res = mockRes();
    const next = mockNext();

    updateFlight(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ flight: updatedFlight });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with AppError 404 when changes === 0', () => {
    mockRun.mockReturnValueOnce({ changes: 0 });

    const req = mockReq({
      params: { id: '999' },
      body: { base_price: 2000000 },
    });
    const res = mockRes();
    const next = mockNext();

    updateFlight(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next with AppError 400 when no fields to update', () => {
    const req = mockReq({
      params: { id: '1' },
      body: {},
    });
    const res = mockRes();
    const next = mockNext();

    updateFlight(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should validate time when both departure_time and arrival_time provided', () => {
    const req = mockReq({
      params: { id: '1' },
      body: {
        departure_time: '2025-06-15T12:00:00Z',
        arrival_time: '2025-06-15T08:00:00Z',
      },
    });
    const res = mockRes();
    const next = mockNext();

    updateFlight(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// deleteFlight
// ═══════════════════════════════════════════════════════════════════════════════

describe('deleteFlight', () => {
  it('should return 200 with success message', () => {
    mockRun.mockReturnValueOnce({ changes: 1 });

    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    const next = mockNext();

    deleteFlight(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Xóa chuyến bay thành công' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with AppError 404 when changes === 0', () => {
    mockRun.mockReturnValueOnce({ changes: 0 });

    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();
    const next = mockNext();

    deleteFlight(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(res.status).not.toHaveBeenCalled();
  });
});
