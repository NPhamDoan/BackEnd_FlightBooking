import { AppError } from '../../src/utils/AppError';

describe('AppError', () => {
  it('should create an error with statusCode and message', () => {
    const error = new AppError('Not found', 404);
    expect(error.message).toBe('Not found');
    expect(error.statusCode).toBe(404);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('should work with different status codes', () => {
    const bad = new AppError('Bad request', 400);
    expect(bad.statusCode).toBe(400);

    const forbidden = new AppError('Forbidden', 403);
    expect(forbidden.statusCode).toBe(403);

    const server = new AppError('Server error', 500);
    expect(server.statusCode).toBe(500);
  });
});
