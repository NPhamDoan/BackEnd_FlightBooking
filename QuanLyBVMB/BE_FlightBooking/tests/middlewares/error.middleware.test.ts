import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../src/middlewares/error.middleware';
import { AppError } from '../../src/utils/AppError';

function mockRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const req = {} as Request;
const next = jest.fn() as NextFunction;

describe('errorHandler', () => {
  it('should return statusCode and message for AppError', () => {
    const res = mockRes();
    errorHandler(new AppError('Not found', 404), req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Not found' });
  });

  it('should return 500 for unknown errors', () => {
    const res = mockRes();
    errorHandler(new Error('something broke'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Internal server error' });
  });
});
