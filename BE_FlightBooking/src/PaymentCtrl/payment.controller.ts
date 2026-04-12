import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { AppError } from '../shared/utils/AppError';
import { PaymentRequest } from './payment.types';
import { generateTransactionCode } from '../shared/utils/helpers';

export function processPayment(req: Request, res: Response, next: NextFunction): void {
  try {
    const userId = req.user!.id;
    const { bookingId, amount, method } = req.body as PaymentRequest;

    const processPaymentTrx = db.transaction(() => {
      // Check booking exists, belongs to user, status = 'pending'
      const booking = db.prepare(
        "SELECT id, total_amount FROM bookings WHERE id = ? AND user_id = ? AND status = 'pending'"
      ).get(bookingId, userId) as { id: number; total_amount: number } | undefined;

      if (!booking) {
        throw new AppError('Đặt vé không tồn tại hoặc đã thanh toán', 404);
      }

      // Check amount matches
      if (amount !== booking.total_amount) {
        throw new AppError('Số tiền không khớp với tổng tiền đặt vé', 400);
      }

      // Simulate payment (always success)
      const transactionCode = generateTransactionCode();
      const paidAt = new Date().toISOString();

      const result = db.prepare(
        `INSERT INTO payments (booking_id, amount, method, status, transaction_code, paid_at)
         VALUES (?, ?, ?, 'success', ?, ?)`
      ).run(bookingId, amount, method, transactionCode, paidAt);

      // Update booking status to confirmed
      db.prepare(
        "UPDATE bookings SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(bookingId);

      return {
        paymentId: Number(result.lastInsertRowid),
        status: 'success' as const,
        transactionCode,
        paidAt,
      };
    });

    const payment = processPaymentTrx.immediate();
    res.status(200).json({ payment });
  } catch (error) {
    next(error);
  }
}

export function getPaymentByBookingId(req: Request, res: Response, next: NextFunction): void {
  try {
    const userId = req.user!.id;
    const bookingId = Number(req.params.bookingId);

    // Verify booking belongs to user
    const booking = db.prepare(
      'SELECT id FROM bookings WHERE id = ? AND user_id = ?'
    ).get(bookingId, userId);

    if (!booking) {
      throw new AppError('Đặt vé không tồn tại', 404);
    }

    const payment = db.prepare(
      'SELECT * FROM payments WHERE booking_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(bookingId);

    if (!payment) {
      throw new AppError('Chưa có thanh toán cho đặt vé này', 404);
    }

    res.status(200).json({ payment });
  } catch (error) {
    next(error);
  }
}
