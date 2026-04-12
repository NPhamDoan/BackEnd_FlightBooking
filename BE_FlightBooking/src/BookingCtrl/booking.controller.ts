import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { AppError } from '../shared/utils/AppError';
import { CreateBookingRequest, AdminBookingQuery } from './booking.types';
import { PaginatedResult } from '../shared/types/common.types';
import { generateBookingCode } from '../shared/utils/helpers';

// ─── 4.1 createBooking ───────────────────────────────────────────────

export function createBooking(req: Request, res: Response, next: NextFunction): void {
  try {
    const userId = req.user!.id;
    const { flightId, passengers, seatIds } = req.body as CreateBookingRequest;
    console.log('[Booking] createBooking - userId:', userId, 'flightId:', flightId, 'seatIds count:', seatIds.length);

    // Double-check passengers.length === seatIds.length (after validation)
    if (passengers.length !== seatIds.length) {
      console.log('[Booking] createBooking - passengers/seats mismatch:', passengers.length, '!=', seatIds.length);
      throw new AppError('Số lượng hành khách phải bằng số lượng ghế', 400);
    }

    const createBookingTrx = db.transaction(() => {
      // 1. Check flight exists and status = 'scheduled'
      const flight = db.prepare(
        "SELECT id, base_price, status FROM flights WHERE id = ? AND status = 'scheduled'"
      ).get(flightId) as { id: number; base_price: number; status: string } | undefined;

      if (!flight) {
        console.log('[Booking] createBooking - flight not found or cancelled:', flightId);
        throw new AppError('Chuyến bay không tồn tại hoặc đã hủy', 404);
      }

      // 2. Check all seatIds belong to flightId and status = 'available'
      const placeholders = seatIds.map(() => '?').join(',');
      const seats = db.prepare(
        `SELECT id, price_modifier FROM seats WHERE id IN (${placeholders}) AND flight_id = ? AND status = 'available'`
      ).all(...seatIds, flightId) as { id: number; price_modifier: number }[];

      if (seats.length !== seatIds.length) {
        console.log('[Booking] createBooking - seats unavailable, requested:', seatIds.length, 'available:', seats.length);
        throw new AppError('Một hoặc nhiều ghế đã được đặt hoặc không hợp lệ', 409);
      }

      // 3. Calculate totalAmount = SUM(base_price * price_modifier)
      const seatMap = new Map(seats.map(s => [s.id, s.price_modifier]));
      const totalAmount = seatIds.reduce((sum, seatId) => {
        return sum + flight.base_price * (seatMap.get(seatId) ?? 1);
      }, 0);

      // 4. Generate booking code and INSERT booking
      const bookingCode = generateBookingCode();
      const result = db.prepare(
        `INSERT INTO bookings (user_id, flight_id, booking_code, status, total_amount)
         VALUES (?, ?, ?, 'pending', ?)`
      ).run(userId, flightId, bookingCode, totalAmount);
      const bookingId = Number(result.lastInsertRowid);

      // 5. INSERT passengers, each passenger assigned to corresponding seatId
      const insertPassenger = db.prepare(
        `INSERT INTO passengers (booking_id, seat_id, full_name, date_of_birth, id_number, id_type)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (let i = 0; i < passengers.length; i++) {
        const p = passengers[i];
        insertPassenger.run(bookingId, seatIds[i], p.fullName, p.dateOfBirth, p.idNumber, p.idType);
      }

      // 6. UPDATE seats SET status='booked'
      db.prepare(
        `UPDATE seats SET status = 'booked' WHERE id IN (${placeholders})`
      ).run(...seatIds);

      return {
        id: bookingId,
        booking_code: bookingCode,
        status: 'pending',
        total_amount: totalAmount,
      };
    });

    const booking = createBookingTrx.immediate();
    console.log('[Booking] createBooking - success, bookingId:', booking.id, 'bookingCode:', booking.booking_code, 'totalAmount:', booking.total_amount);
    res.status(201).json({ booking });
  } catch (error) {
    next(error);
  }
}

// ─── 4.2 cancelBooking ───────────────────────────────────────────────

export function cancelBooking(req: Request, res: Response, next: NextFunction): void {
  try {
    const userId = req.user!.id;
    const bookingId = Number(req.params.id);
    console.log('[Booking] cancelBooking - userId:', userId, 'bookingId:', bookingId);

    const cancelBookingTrx = db.transaction(() => {
      // Check booking exists AND belongs to user, JOIN flight for departure_time
      const booking = db.prepare(
        `SELECT b.id, b.user_id, b.flight_id, b.booking_code, b.status, b.total_amount,
                b.created_at, b.updated_at, f.departure_time
         FROM bookings b
         JOIN flights f ON b.flight_id = f.id
         WHERE b.id = ? AND b.user_id = ?`
      ).get(bookingId, userId) as any;

      if (!booking) {
        console.log('[Booking] cancelBooking - booking not found, bookingId:', bookingId, 'userId:', userId);
        throw new AppError('Đặt vé không tồn tại', 404);
      }
      if (!['pending', 'confirmed'].includes(booking.status)) {
        console.log('[Booking] cancelBooking - invalid status:', booking.status, 'bookingId:', bookingId);
        throw new AppError('Không thể hủy đặt vé ở trạng thái này', 400);
      }

      // Check flight hasn't departed
      if (new Date(booking.departure_time) <= new Date()) {
        console.log('[Booking] cancelBooking - flight already departed, bookingId:', bookingId);
        throw new AppError('Không thể hủy vé đã khởi hành', 400);
      }

      // UPDATE booking status
      db.prepare(
        "UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(bookingId);

      // Release seats
      db.prepare(
        `UPDATE seats SET status = 'available'
         WHERE id IN (SELECT seat_id FROM passengers WHERE booking_id = ?)`
      ).run(bookingId);

      // Refund payments if any
      db.prepare(
        "UPDATE payments SET status = 'refunded' WHERE booking_id = ? AND status = 'success'"
      ).run(bookingId);

      return {
        id: booking.id,
        user_id: booking.user_id,
        flight_id: booking.flight_id,
        booking_code: booking.booking_code,
        status: 'cancelled',
        total_amount: booking.total_amount,
        created_at: booking.created_at,
        updated_at: booking.updated_at,
      };
    });

    const booking = cancelBookingTrx.immediate();
    console.log('[Booking] cancelBooking - success, bookingId:', bookingId);
    res.status(200).json({ booking });
  } catch (error) {
    next(error);
  }
}

// ─── 4.3 getBookingHistory ───────────────────────────────────────────

export function getBookingHistory(req: Request, res: Response, next: NextFunction): void {
  try {
    const userId = req.user!.id;
    const page = Number(req.query.page) || 1;
    console.log('[Booking] getBookingHistory - userId:', userId, 'page:', page);
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const bookings = db.prepare(`
      SELECT b.*, a.name AS airline_name, a.code AS airline_code,
             dep.code AS departure_airport_code, dep.city AS departure_airport_city,
             arr.code AS arrival_airport_code, arr.city AS arrival_airport_city,
             f.departure_time, f.arrival_time
      FROM bookings b
      JOIN flights f ON b.flight_id = f.id
      JOIN airlines a ON f.airline_id = a.id
      JOIN airports dep ON f.departure_airport_id = dep.id
      JOIN airports arr ON f.arrival_airport_id = arr.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset);

    const countResult = db.prepare(
      'SELECT COUNT(*) AS count FROM bookings WHERE user_id = ?'
    ).get(userId) as { count: number };

    const total = countResult.count;

    console.log('[Booking] getBookingHistory - total found:', total, 'page:', page);

    const result: PaginatedResult<any> = {
      data: bookings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}


// ─── 4.3 getBookingById ──────────────────────────────────────────────

export function getBookingById(req: Request, res: Response, next: NextFunction): void {
  try {
    const userId = req.user!.id;
    const bookingId = Number(req.params.id);
    console.log('[Booking] getBookingById - userId:', userId, 'bookingId:', bookingId);

    // Get booking with flight info
    const booking = db.prepare(`
      SELECT b.*, a.name AS airline_name, a.code AS airline_code,
             dep.code AS departure_airport_code, dep.city AS departure_airport_city,
             arr.code AS arrival_airport_code, arr.city AS arrival_airport_city,
             f.departure_time, f.arrival_time
      FROM bookings b
      JOIN flights f ON b.flight_id = f.id
      JOIN airlines a ON f.airline_id = a.id
      JOIN airports dep ON f.departure_airport_id = dep.id
      JOIN airports arr ON f.arrival_airport_id = arr.id
      WHERE b.id = ? AND b.user_id = ?
    `).get(bookingId, userId) as any;

    if (!booking) {
      console.log('[Booking] getBookingById - not found, bookingId:', bookingId, 'userId:', userId);
      throw new AppError('Đặt vé không tồn tại', 404);
    }

    // Get passengers with seat info
    const passengers = db.prepare(`
      SELECT p.full_name, p.date_of_birth, p.id_number, p.id_type,
             s.seat_number, s.class AS seat_class
      FROM passengers p
      JOIN seats s ON p.seat_id = s.id
      WHERE p.booking_id = ?
    `).all(bookingId);

    // Get payment info (LEFT JOIN — pending bookings may not have payment)
    const payment = db.prepare(`
      SELECT status AS payment_status, method AS payment_method,
             transaction_code, paid_at
      FROM payments
      WHERE booking_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(bookingId) as any;

    const detail = {
      ...booking,
      passengers,
      payment_status: payment?.payment_status ?? null,
      payment_method: payment?.payment_method ?? null,
      transaction_code: payment?.transaction_code ?? null,
      paid_at: payment?.paid_at ?? null,
    };

    console.log('[Booking] getBookingById - success, bookingId:', bookingId);
    res.status(200).json({ booking: detail });
  } catch (error) {
    next(error);
  }
}

// ─── 4.4 getAllBookings (admin) ──────────────────────────────────────

export function getAllBookings(req: Request, res: Response, next: NextFunction): void {
  try {
    const query = req.query as unknown as AdminBookingQuery;
    console.log('[Booking] getAllBookings - filters: status:', query.status || 'none', 'flightId:', query.flightId || 'none');
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (query.status) {
      conditions.push('b.status = ?');
      params.push(query.status);
    }
    if (query.flightId) {
      conditions.push('b.flight_id = ?');
      params.push(Number(query.flightId));
    }

    const sqlWhere = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const bookings = db.prepare(`
      SELECT b.*, f.departure_time, f.arrival_time,
             a.name AS airline_name, a.code AS airline_code,
             u.email AS user_email, u.full_name AS user_full_name
      FROM bookings b
      JOIN flights f ON b.flight_id = f.id
      JOIN airlines a ON f.airline_id = a.id
      JOIN users u ON b.user_id = u.id
      ${sqlWhere}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const countResult = db.prepare(`
      SELECT COUNT(*) AS count
      FROM bookings b
      ${sqlWhere}
    `).get(...params) as { count: number };

    const total = countResult.count;

    console.log('[Booking] getAllBookings - total found:', total, 'page:', page);

    const result: PaginatedResult<any> = {
      data: bookings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

// ─── 4.4 adminUpdateBookingStatus (admin) ────────────────────────────

export function adminUpdateBookingStatus(req: Request, res: Response, next: NextFunction): void {
  try {
    const bookingId = Number(req.params.id);
    const { status } = req.body as { status: string };
    console.log('[Booking] adminUpdateBookingStatus - bookingId:', bookingId, 'newStatus:', status);

    const result = db.prepare(
      "UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(status, bookingId);

    if (result.changes === 0) {
      console.log('[Booking] adminUpdateBookingStatus - booking not found:', bookingId);
      throw new AppError('Đặt vé không tồn tại', 404);
    }

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);

    console.log('[Booking] adminUpdateBookingStatus - success, bookingId:', bookingId, 'newStatus:', status);
    res.status(200).json({ booking });
  } catch (error) {
    next(error);
  }
}

// ─── 4.4 adminCancelFlight (admin) ──────────────────────────────────

export function adminCancelFlight(req: Request, res: Response, next: NextFunction): void {
  try {
    const flightId = Number(req.params.id);
    console.log('[Booking] adminCancelFlight - flightId:', flightId);

    const cancelFlightTrx = db.transaction(() => {
      // Check flight exists
      const flight = db.prepare('SELECT id FROM flights WHERE id = ?').get(flightId);
      if (!flight) {
        console.log('[Booking] adminCancelFlight - flight not found:', flightId);
        throw new AppError('Chuyến bay không tồn tại', 404);
      }

      // Cancel the flight
      db.prepare(
        "UPDATE flights SET status = 'cancelled' WHERE id = ?"
      ).run(flightId);

      // Find all active bookings for this flight
      const activeBookings = db.prepare(
        "SELECT id FROM bookings WHERE flight_id = ? AND status IN ('pending', 'confirmed')"
      ).all(flightId) as { id: number }[];

      const cancelledCount = activeBookings.length;

      if (cancelledCount > 0) {
        const bookingIds = activeBookings.map(b => b.id);
        const bookingPlaceholders = bookingIds.map(() => '?').join(',');

        // Cancel all active bookings
        db.prepare(
          `UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
           WHERE id IN (${bookingPlaceholders})`
        ).run(...bookingIds);

        // Refund payments for these bookings
        db.prepare(
          `UPDATE payments SET status = 'refunded'
           WHERE booking_id IN (${bookingPlaceholders}) AND status = 'success'`
        ).run(...bookingIds);
      }

      // Release all seats for this flight
      db.prepare(
        "UPDATE seats SET status = 'available' WHERE flight_id = ?"
      ).run(flightId);

      return { cancelledCount };
    });

    const { cancelledCount } = cancelFlightTrx.immediate();

    console.log('[Booking] adminCancelFlight - success, flightId:', flightId, 'cancelledBookings:', cancelledCount);
    res.status(200).json({
      message: 'Hủy chuyến bay thành công',
      cancelledBookings: cancelledCount,
    });
  } catch (error) {
    next(error);
  }
}
