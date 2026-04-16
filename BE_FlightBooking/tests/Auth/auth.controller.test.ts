import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../src/shared/utils/AppError';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSingle = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();

const mockSupabase = {
  from: jest.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  })),
};

// Chain: .select().eq().single()
mockSelect.mockReturnValue({ eq: mockEq });
mockEq.mockReturnValue({ single: mockSingle });

// Chain: .insert().select().single()
const mockInsertSelectSingle = jest.fn();
const mockInsertSelect = jest.fn(() => ({ single: mockInsertSelectSingle }));
mockInsert.mockReturnValue({ select: mockInsertSelect });

// Chain: .update().eq()
const mockUpdateEq = jest.fn();
mockUpdate.mockReturnValue({ eq: mockUpdateEq });

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: mockSupabase,
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
  // Reset default chain returns
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ single: mockSingle });
  mockInsert.mockReturnValue({ select: mockInsertSelect });
  mockInsertSelect.mockReturnValue({ single: mockInsertSelectSingle });
  mockUpdate.mockReturnValue({ eq: mockUpdateEq });
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

  it('should return 201 with token and user on success', async () => {
    mockInsertSelectSingle.mockResolvedValueOnce({
      data: {
        id: 1,
        email: 'test@example.com',
        full_name: 'Test User',
        phone: '0123456789',
        role: 'customer',
        created_at: '2024-01-01T00:00:00Z',
      },
      error: null,
    });

    const req = mockReq({ body: validBody });
    const res = mockRes();
    const next = mockNext();

    await register(req, res, next);

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

  it('should call bcrypt.hashSync with salt rounds 12', async () => {
    mockInsertSelectSingle.mockResolvedValueOnce({
      data: {
        id: 1, email: 'test@example.com', full_name: 'Test User',
        phone: '0123456789', role: 'customer', created_at: '2024-01-01T00:00:00Z',
      },
      error: null,
    });

    const req = mockReq({ body: validBody });
    await register(req, mockRes(), mockNext());

    expect(bcrypt.hashSync).toHaveBeenCalledWith('Password1', 12);
  });

  it('should return 409 via AppError when email is duplicate (23505)', async () => {
    mockInsertSelectSingle.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });

    const req = mockReq({ body: validBody });
    const res = mockRes();
    const next = mockNext();

    await register(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 500 via AppError on unknown Supabase error', async () => {
    mockInsertSelectSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'UNKNOWN', message: 'something went wrong' },
    });

    const req = mockReq({ body: validBody });
    const next = mockNext();

    await register(req, mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(500);
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
    created_at: '2024-01-01T00:00:00Z',
  };

  it('should return 200 with token and user on success', async () => {
    mockSingle.mockResolvedValueOnce({ data: dbRow, error: null });
    (bcrypt.compareSync as jest.Mock).mockReturnValueOnce(true);

    const req = mockReq({ body: validBody });
    const res = mockRes();
    const next = mockNext();

    await login(req, res, next);

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

  it('should return 401 via AppError when email not found', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });

    const req = mockReq({ body: validBody });
    const res = mockRes();
    const next = mockNext();

    await login(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
  });

  it('should return 401 via AppError when password is wrong', async () => {
    mockSingle.mockResolvedValueOnce({ data: dbRow, error: null });
    (bcrypt.compareSync as jest.Mock).mockReturnValueOnce(false);

    const req = mockReq({ body: validBody });
    const res = mockRes();
    const next = mockNext();

    await login(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
  });

  it('should use the same error message for email-not-found and wrong-password', async () => {
    // Email not found
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });
    const next1 = mockNext();
    await login(mockReq({ body: validBody }), mockRes(), next1);
    const err1 = (next1 as jest.Mock).mock.calls[0][0] as AppError;

    // Wrong password
    mockSingle.mockResolvedValueOnce({ data: dbRow, error: null });
    (bcrypt.compareSync as jest.Mock).mockReturnValueOnce(false);
    const next2 = mockNext();
    await login(mockReq({ body: validBody }), mockRes(), next2);
    const err2 = (next2 as jest.Mock).mock.calls[0][0] as AppError;

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
    created_at: '2024-01-01T00:00:00Z',
  };

  it('should return 200 with user profile on success', async () => {
    mockSingle.mockResolvedValueOnce({ data: dbRow, error: null });

    const req = mockReq({ user: { id: 1, email: 'test@example.com', role: 'customer' } });
    const res = mockRes();
    const next = mockNext();

    await getProfile(req, res, next);

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

  it('should return 404 via AppError when user not found', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });

    const req = mockReq({ user: { id: 999, email: 'ghost@example.com', role: 'customer' } });
    const res = mockRes();
    const next = mockNext();

    await getProfile(req, res, next);

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

  it('should return 200 on success', async () => {
    mockSingle.mockResolvedValueOnce({ data: { password_hash: 'old_hash' }, error: null });
    (bcrypt.compareSync as jest.Mock).mockReturnValueOnce(true);
    mockUpdateEq.mockResolvedValueOnce({ error: null });

    const req = mockReq({
      user: { id: 1, email: 'test@example.com', role: 'customer' },
      body,
    });
    const res = mockRes();
    const next = mockNext();

    await changePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Đổi mật khẩu thành công' });
    expect(bcrypt.hashSync).toHaveBeenCalledWith('NewPass1', 12);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 400 via AppError when current password is wrong', async () => {
    mockSingle.mockResolvedValueOnce({ data: { password_hash: 'old_hash' }, error: null });
    (bcrypt.compareSync as jest.Mock).mockReturnValueOnce(false);

    const req = mockReq({
      user: { id: 1, email: 'test@example.com', role: 'customer' },
      body,
    });
    const res = mockRes();
    const next = mockNext();

    await changePassword(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 404 via AppError when user not found', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });

    const req = mockReq({
      user: { id: 999, email: 'ghost@example.com', role: 'customer' },
      body,
    });
    const res = mockRes();
    const next = mockNext();

    await changePassword(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 500 via AppError when update fails', async () => {
    mockSingle.mockResolvedValueOnce({ data: { password_hash: 'old_hash' }, error: null });
    (bcrypt.compareSync as jest.Mock).mockReturnValueOnce(true);
    mockUpdateEq.mockResolvedValueOnce({ error: { message: 'update failed' } });

    const req = mockReq({
      user: { id: 1, email: 'test@example.com', role: 'customer' },
      body,
    });
    const next = mockNext();

    await changePassword(req, mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(500);
  });
});
