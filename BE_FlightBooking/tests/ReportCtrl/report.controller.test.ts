import { Request, Response, NextFunction } from 'express';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRpc = jest.fn();

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: {
    rpc: mockRpc,
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
  it('should return 200 with data array of RevenueByAirline', async () => {
    const sampleData = [
      { airline_name: 'Vietnam Airlines', airline_code: 'VNA', totalBookings: 5, totalRevenue: 7500000 },
    ];
    mockRpc.mockResolvedValueOnce({ data: sampleData, error: null });

    const req = mockReq({ query: { startDate: '2026-01-01', endDate: '2026-12-31' } });
    const res = mockRes();
    const next = mockNext();

    await getRevenueByAirline(req, res, next);

    expect(mockRpc).toHaveBeenCalledWith('get_revenue_by_airline', {
      p_start_date: '2026-01-01',
      p_end_date: '2026-12-31',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: sampleData });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 200 with empty data array when no results', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const req = mockReq({ query: { startDate: '2026-01-01', endDate: '2026-12-31' } });
    const res = mockRes();
    const next = mockNext();

    await getRevenueByAirline(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: [] });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with AppError when rpc returns error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const req = mockReq({ query: { startDate: '2026-01-01', endDate: '2026-12-31' } });
    const res = mockRes();
    const next = mockNext();

    await getRevenueByAirline(req, res, next);

    expect(next).toHaveBeenCalled();
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err.statusCode).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getRevenueByRoute
// ═══════════════════════════════════════════════════════════════════════════════

describe('getRevenueByRoute', () => {
  it('should return 200 with data array of RevenueByRoute', async () => {
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
    mockRpc.mockResolvedValueOnce({ data: sampleData, error: null });

    const req = mockReq({ query: { startDate: '2026-01-01', endDate: '2026-12-31' } });
    const res = mockRes();
    const next = mockNext();

    await getRevenueByRoute(req, res, next);

    expect(mockRpc).toHaveBeenCalledWith('get_revenue_by_route', {
      p_start_date: '2026-01-01',
      p_end_date: '2026-12-31',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: sampleData });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 200 with empty data array when no results', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const req = mockReq({ query: { startDate: '2026-01-01', endDate: '2026-12-31' } });
    const res = mockRes();
    const next = mockNext();

    await getRevenueByRoute(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: [] });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with AppError when rpc returns error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const req = mockReq({ query: { startDate: '2026-01-01', endDate: '2026-12-31' } });
    const res = mockRes();
    const next = mockNext();

    await getRevenueByRoute(req, res, next);

    expect(next).toHaveBeenCalled();
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err.statusCode).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getRevenueByMonth
// ═══════════════════════════════════════════════════════════════════════════════

describe('getRevenueByMonth', () => {
  it('should return 200 with 12 MonthlyRevenue items, filling missing months with zeros', async () => {
    const rpcRows = [
      { month: 1, totalBookings: 2, totalRevenue: 3000000 },
      { month: 5, totalBookings: 1, totalRevenue: 1500000 },
    ];
    mockRpc.mockResolvedValueOnce({ data: rpcRows, error: null });

    const req = mockReq({ query: { year: '2026' } });
    const res = mockRes();
    const next = mockNext();

    await getRevenueByMonth(req, res, next);

    expect(mockRpc).toHaveBeenCalledWith('get_revenue_by_month', { p_year: 2026 });
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

  it('should return 200 with 12 months all zeros when no data', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const req = mockReq({ query: { year: '2026' } });
    const res = mockRes();
    const next = mockNext();

    await getRevenueByMonth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();

    const responseData = (res.json as jest.Mock).mock.calls[0][0].data;

    expect(responseData).toHaveLength(12);

    for (const item of responseData) {
      expect(item.totalRevenue).toBe(0);
      expect(item.totalBookings).toBe(0);
    }
  });

  it('should handle null data from rpc gracefully', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const req = mockReq({ query: { year: '2026' } });
    const res = mockRes();
    const next = mockNext();

    await getRevenueByMonth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = (res.json as jest.Mock).mock.calls[0][0].data;
    expect(responseData).toHaveLength(12);
    for (const item of responseData) {
      expect(item.totalRevenue).toBe(0);
      expect(item.totalBookings).toBe(0);
    }
  });

  it('should call next with AppError when rpc returns error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const req = mockReq({ query: { year: '2026' } });
    const res = mockRes();
    const next = mockNext();

    await getRevenueByMonth(req, res, next);

    expect(next).toHaveBeenCalled();
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err.statusCode).toBe(500);
  });
});
