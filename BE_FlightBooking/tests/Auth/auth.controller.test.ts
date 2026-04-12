import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../src/shared/utils/AppError';

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

jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: {
    hashSync: jest.fn(() => 'hashed_password'),
    compareSync: jest.fn(() => true),
  },
}));

jest.mock('jsonwebtoken', () => ({
  __esModule: true,
  default: {
    sign: jest.fn(() => 'mock_jwt_token'),
    verify: jest.fn(),
  },
}));

import { register, login, getProfile, changePassword } from '../../src/Auth/auth.controller';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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
// register
// ═══════════════════════════════════════════════════════════════════════════════

describe('register', () => {
  const validBody = {
    email: 'test@example.com',
    password: 'Password1',
    fullName: 'Test User',
    phone: '0123456789',
  };

  it('should return 201 with token and user on success', () => {
    mockGet.mockReturnValueOnce(undefined); // no duplicate
    mockRun.mockReturnValueOnce({ lastInsertRowid: 1 });

    const req = mockReq({ body: validBody });
    const res = mockRes();
    const next = mockNext();

    register(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'mock_jwt_token',
        user: expect.objectContaining({
          id: 1,
          email: 'test@example.com',
          fullName: 'Test User',
          phone: '0123456789',
          role: 'customer',
        }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should call bcrypt.hashSync with salt rounds 12', () => {
    mockGet.mockReturnValueOnce(undefined);
    mockRun.mockReturnValueOnce({ lastInsertRowid: 1 });

    const req = mockReq({ body: validBody });
    const res = mockRes();
    const next = mockNext();

    register(req, res, next);

    expect(bcrypt.hashSync).toHaveBeenCalledWith('Password1', 12);
  });

  it('should return 409 via AppError when email is duplicate', () => {
    mockGet.mockReturnValueOnce({ id: 99 }); // duplicate found

    const req = mockReq({ body: validBody });
    const res = mockRes();
    const next = mockNext();

    register(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should hash the password before storing', () => {
    mockGet.mockReturnValueOnce(undefined);
    mockRun.mockReturnValueOnce({ lastInsertRowid: 1 });

    const req = mockReq({ body: validBody });
    const res = mockRes();
    const next = mockNext();

    register(req, res, next);

    // The hashed value should be passed to the INSERT, not the raw password
    expect(bcrypt.hashSync).toHaveBeenCalled();
    expect(mockRun).toHaveBeenCalledWith(
      'test@example.com',
      'hashed_password',
      'Test User',
      '0123456789',
      'customer',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// login
// ═══════════════════════════════════════════════════════════════════════════════

describe('login', () => {
  const validBody = { email: 'test@example.com', password: 'Password1' };

  const dbRow = {
    id: 1,
    email: 'test@example.com',
    password_hash: 'hashed_password',
    full_name: 'Test User',
    phone: '0123456789',
    role: 'customer',
    created_at: '2024-01-01',
  };

  it('should return 200 with token and user on success', () => {
    mockGet.mockReturnValueOnce(dbRow);
    (bcrypt.compareSync as jest.Mock).mockReturnValueOnce(true);

    const req = mockReq({ body: validBody });
    const res = mockRes();
    const next = mockNext();

    login(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'mock_jwt_token',
        user: expect.objectContaining({
          id: 1,
          email: 'test@example.com',
          fullName: 'Test User',
          role: 'customer',
        }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 via AppError when email not found', () => {
    mockGet.mockReturnValueOnce(undefined);

    const req = mockReq({ body: validBody });
    const res = mockRes();
    const next = mockNext();

    login(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
  });

  it('should return 401 via AppError when password is wrong', () => {
    mockGet.mockReturnValueOnce(dbRow);
    (bcrypt.compareSync as jest.Mock).mockReturnValueOnce(false);

    const req = mockReq({ body: validBody });
    const res = mockRes();
    const next = mockNext();

    login(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
  });

  it('should use the same error message for email-not-found and wrong-password', () => {
    // Email not found
    mockGet.mockReturnValueOnce(undefined);
    const next1 = mockNext();
    login(mockReq({ body: validBody }), mockRes(), next1);
    const err1 = (next1 as jest.Mock).mock.calls[0][0] as AppError;

    // Wrong password
    mockGet.mockReturnValueOnce(dbRow);
    (bcrypt.compareSync as jest.Mock).mockReturnValueOnce(false);
    const next2 = mockNext();
    login(mockReq({ body: validBody }), mockRes(), next2);
    const err2 = (next2 as jest.Mock).mock.calls[0][0] as AppError;

    // Both messages must be identical so the error doesn't reveal which field is wrong
    expect(err1.message).toBe(err2.message);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getProfile
// ═══════════════════════════════════════════════════════════════════════════════

describe('getProfile', () => {
  const dbRow = {
    id: 1,
    email: 'test@example.com',
    full_name: 'Test User',
    phone: '0123456789',
    role: 'customer',
    created_at: '2024-01-01',
  };

  it('should return 200 with user profile on success', () => {
    mockGet.mockReturnValueOnce(dbRow);

    const req = mockReq({ user: { id: 1, email: 'test@example.com', role: 'customer' } });
    const res = mockRes();
    const next = mockNext();

    getProfile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      user: expect.objectContaining({
        id: 1,
        email: 'test@example.com',
        fullName: 'Test User',
        phone: '0123456789',
        role: 'customer',
      }),
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 404 via AppError when user not found', () => {
    mockGet.mockReturnValueOnce(undefined);

    const req = mockReq({ user: { id: 999, email: 'ghost@example.com', role: 'customer' } });
    const res = mockRes();
    const next = mockNext();

    getProfile(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// changePassword
// ═══════════════════════════════════════════════════════════════════════════════

describe('changePassword', () => {
  const body = { currentPassword: 'OldPass1', newPassword: 'NewPass1' };

  it('should return 200 on success', () => {
    mockGet.mockReturnValueOnce({ password_hash: 'old_hash' });
    (bcrypt.compareSync as jest.Mock).mockReturnValueOnce(true);
    mockRun.mockReturnValueOnce({});

    const req = mockReq({
      user: { id: 1, email: 'test@example.com', role: 'customer' },
      body,
    });
    const res = mockRes();
    const next = mockNext();

    changePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Đổi mật khẩu thành công' });
    expect(bcrypt.hashSync).toHaveBeenCalledWith('NewPass1', 12);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 400 via AppError when current password is wrong', () => {
    mockGet.mockReturnValueOnce({ password_hash: 'old_hash' });
    (bcrypt.compareSync as jest.Mock).mockReturnValueOnce(false);

    const req = mockReq({
      user: { id: 1, email: 'test@example.com', role: 'customer' },
      body,
    });
    const res = mockRes();
    const next = mockNext();

    changePassword(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 404 via AppError when user not found', () => {
    mockGet.mockReturnValueOnce(undefined);

    const req = mockReq({
      user: { id: 999, email: 'ghost@example.com', role: 'customer' },
      body,
    });
    const res = mockRes();
    const next = mockNext();

    changePassword(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(res.status).not.toHaveBeenCalled();
  });
});
