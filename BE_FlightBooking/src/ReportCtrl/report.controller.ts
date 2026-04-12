import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { RevenueByAirline, RevenueByRoute, MonthlyRevenue } from './report.types';

export function getRevenueByAirline(req: Request, res: Response, next: NextFunction): void {
  try {
    const { startDate, endDate } = req.query as { startDate: string; endDate: string };

    const data = db.prepare(`
      SELECT
        a.name AS airline_name,
        a.code AS airline_code,
        COUNT(DISTINCT b.id) AS totalBookings,
        COALESCE(SUM(p.amount), 0) AS totalRevenue
      FROM bookings b
      JOIN flights f ON b.flight_id = f.id
      JOIN airlines a ON f.airline_id = a.id
      JOIN payments p ON b.id = p.booking_id AND p.status = 'success'
      WHERE b.status IN ('confirmed', 'completed')
        AND p.paid_at BETWEEN ? AND ?
      GROUP BY a.id, a.name, a.code
      ORDER BY totalRevenue DESC
    `).all(startDate, endDate) as RevenueByAirline[];

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export function getRevenueByRoute(req: Request, res: Response, next: NextFunction): void {
  try {
    const { startDate, endDate } = req.query as { startDate: string; endDate: string };

    const data = db.prepare(`
      SELECT
        dep.city AS departure_city,
        dep.code AS departure_code,
        arr.city AS arrival_city,
        arr.code AS arrival_code,
        COUNT(DISTINCT b.id) AS totalBookings,
        COALESCE(SUM(p.amount), 0) AS totalRevenue
      FROM bookings b
      JOIN flights f ON b.flight_id = f.id
      JOIN airports dep ON f.departure_airport_id = dep.id
      JOIN airports arr ON f.arrival_airport_id = arr.id
      JOIN payments p ON b.id = p.booking_id AND p.status = 'success'
      WHERE b.status IN ('confirmed', 'completed')
        AND p.paid_at BETWEEN ? AND ?
      GROUP BY f.departure_airport_id, f.arrival_airport_id
      ORDER BY totalRevenue DESC
    `).all(startDate, endDate) as RevenueByRoute[];

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export function getRevenueByMonth(req: Request, res: Response, next: NextFunction): void {
  try {
    const year = Number(req.query.year);

    const rows = db.prepare(`
      SELECT
        CAST(strftime('%m', p.paid_at) AS INTEGER) AS month,
        COUNT(DISTINCT b.id) AS totalBookings,
        COALESCE(SUM(p.amount), 0) AS totalRevenue
      FROM bookings b
      JOIN payments p ON b.id = p.booking_id AND p.status = 'success'
      WHERE b.status IN ('confirmed', 'completed')
        AND strftime('%Y', p.paid_at) = ?
      GROUP BY month
      ORDER BY month
    `).all(String(year)) as { month: number; totalBookings: number; totalRevenue: number }[];

    // Build full 12-month result, filling missing months with 0
    const monthMap = new Map(rows.map(r => [r.month, r]));
    const data: MonthlyRevenue[] = [];
    for (let m = 1; m <= 12; m++) {
      const row = monthMap.get(m);
      data.push({
        month: m,
        year,
        totalRevenue: row?.totalRevenue ?? 0,
        totalBookings: row?.totalBookings ?? 0,
      });
    }

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}
