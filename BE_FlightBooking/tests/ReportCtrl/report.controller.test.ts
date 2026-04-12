import { Request, Response, NextFunction } from 'express';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGet = jest.fn();
const mockRun = jest.fn();
const mockAll = jest.fn();

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: {
    prepare: jest.fn(() => ({
      get: mockGet,
      run: mockRun,
      all: mockAll,
    })),
  },
}));

import {
  getRevenueByAirline,
  getRevenueByRoute,
  getRevenueByMonth,
} from '../../src/ReportCtrl/report.controller';

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
// getRevenueByAirline
// ═══════════════════════════════════════════════════════════════════════════════

describe('getRevenueByAirline', () => {
  it('should return 200 with data array of RevenueByAirline', () => {
    const sampleData = [
      { airline_name: 'Vietnam Airlines', airline_code: 'VNA', totalBookings: 5, totalRevenue: 7500000 },
    ];
    mockAll.mockReturnValueOnce(sampleData);

    const req = mockReq({ query: { startDate: '2026-01-01', endDate: '2026-12-31' } });
    const res = mockRes();
    const next = mockNext();

    getRevenueByAirline(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: sampleData });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 200 with empty data array when no results', () => {
    mockAll.mockReturnValueOnce([]);

    const req = mockReq({ query: { startDate: '2026-01-01', endDate: '2026-12-31' } });
    const res = mockRes();
    const next = mockNext();

    getRevenueByAirline(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: [] });
    expect(next).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getRevenueByRoute
// ═══════════════════════════════════════════════════════════════════════════════

describe('getRevenueByRoute', () => {
  it('should return 200 with data array of RevenueByRoute', () => {
    const sampleData = [
      {
        departure_city: 'Ho Chi Minh',
        departure_code: 'SGN',
        arrival_city: 'Ha Noi',
        arrival_code: 'HAN',
        totalBookings: 3,
        totalRevenue: 4500000,
      },
    ];
    mockAll.mockReturnValueOnce(sampleData);

    const req = mockReq({ query: { startDate: '2026-01-01', endDate: '2026-12-31' } });
    const res = mockRes();
    const next = mockNext();

    getRevenueByRoute(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: sampleData });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 200 with empty data array when no results', () => {
    mockAll.mockReturnValueOnce([]);

    const req = mockReq({ query: { startDate: '2026-01-01', endDate: '2026-12-31' } });
    const res = mockRes();
    const next = mockNext();

    getRevenueByRoute(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: [] });
    expect(next).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getRevenueByMonth
// ═══════════════════════════════════════════════════════════════════════════════

describe('getRevenueByMonth', () => {
  it('should return 200 with 12 MonthlyRevenue items, filling missing months with zeros', () => {
    const dbRows = [
      { month: 1, totalBookings: 2, totalRevenue: 3000000 },
      { month: 5, totalBookings: 1, totalRevenue: 1500000 },
    ];
    mockAll.mockReturnValueOnce(dbRows);

    const req = mockReq({ query: { year: '2026' } });
    const res = mockRes();
    const next = mockNext();

    getRevenueByMonth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();

    const responseData = (res.json as jest.Mock).mock.calls[0][0].data;

    // Exactly 12 items
    expect(responseData).toHaveLength(12);

    // Each item has correct year
    for (const item of responseData) {
      expect(item.year).toBe(2026);
    }

    // Month 1 has data
    expect(responseData[0]).toEqual({ month: 1, year: 2026, totalRevenue: 3000000, totalBookings: 2 });

    // Month 5 has data
    expect(responseData[4]).toEqual({ month: 5, year: 2026, totalRevenue: 1500000, totalBookings: 1 });

    // Months without data have zeros
    expect(responseData[1]).toEqual({ month: 2, year: 2026, totalRevenue: 0, totalBookings: 0 });
    expect(responseData[11]).toEqual({ month: 12, year: 2026, totalRevenue: 0, totalBookings: 0 });
  });

  it('should return 200 with 12 months all zeros when no data', () => {
    mockAll.mockReturnValueOnce([]);

    const req = mockReq({ query: { year: '2026' } });
    const res = mockRes();
    const next = mockNext();

    getRevenueByMonth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();

    const responseData = (res.json as jest.Mock).mock.calls[0][0].data;

    expect(responseData).toHaveLength(12);

    for (const item of responseData) {
      expect(item.totalRevenue).toBe(0);
      expect(item.totalBookings).toBe(0);
    }
  });
});
