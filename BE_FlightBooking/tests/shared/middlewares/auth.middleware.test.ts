import { Request, Response, NextFunction } from 'express';

jest.mock('jsonwebtoken', () => ({
  __esModule: true,
  default: {
    verify: jest.fn(),
  },
}));

import jwt from 'jsonwebtoken';
import { authMiddleware } from '../../../src/shared/middlewares/auth.middleware';

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

describe('authMiddleware', () => {
  const decoded = { id: 1, email: 'test@example.com', role: 'customer' };

  it('should set req.user and call next() for a valid token', () => {
    (jwt.verify as jest.Mock).mockReturnValueOnce(decoded);

    const req = mockReq({ headers: { authorization: 'Bearer valid_token' } });
    const res = mockRes();
    const next = mockNext();

    authMiddleware(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('valid_token', expect.any(String));
    expect(req.user).toEqual({ id: 1, email: 'test@example.com', role: 'customer' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 401 when no Authorization header is present', () => {
    const req = mockReq({ headers: {} });
    const res = mockRes();
    const next = mockNext();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header has invalid format (no "Bearer ")', () => {
    const req = mockReq({ headers: { authorization: 'Basic some_token' } });
    const res = mockRes();
    const next = mockNext();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when token is expired or invalid', () => {
    (jwt.verify as jest.Mock).mockImplementationOnce(() => {
      throw new Error('jwt expired');
    });

    const req = mockReq({ headers: { authorization: 'Bearer expired_token' } });
    const res = mockRes();
    const next = mockNext();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });
});
