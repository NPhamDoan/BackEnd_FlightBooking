import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { AppError } from '../shared/utils/AppError';
import {
  FlightSearchQuery,
  FlightDetail,
  Seat,
  CreateFlightRequest,
  UpdateFlightRequest,
} from './flight.types';
import { PaginatedResult } from '../shared/types/common.types';

const SORT_BY_MAP: Record<string, string> = {
  price: 'f.base_price',
  departure_time: 'f.departure_time',
  duration: "julianday(f.arrival_time) - julianday(f.departure_time)",
};

const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function searchFlights(req: Request, res: Response, next: NextFunction): void {
  try {
    const query = req.query as unknown as FlightSearchQuery;
    console.log('[Flight] searchFlights - departure:', query.departure, 'arrival:', query.arrival, 'date:', query.departureDate);
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = [
      "f.status = 'scheduled'",
      'dep.code = ?',
      'arr.code = ?',
      'DATE(f.departure_time) = ?',
    ];
    const params: (string | number)[] = [query.departure, query.arrival, query.departureDate];

    if (query.airline) {
      conditions.push('a.code = ?');
      params.push(query.airline);
    }
    if (query.minPrice !== undefined && query.minPrice !== null) {
      conditions.push('f.base_price >= ?');
      params.push(Number(query.minPrice));
    }
    if (query.maxPrice !== undefined && query.maxPrice !== null) {
      conditions.push('f.base_price <= ?');
      params.push(Number(query.maxPrice));
    }

    const sqlWhere = conditions.join(' AND ');
    const orderBy = SORT_BY_MAP[query.sortBy ?? 'departure_time'] ?? SORT_BY_MAP['departure_time'];

    const flights = db.prepare(`
      SELECT f.*, a.name AS airline_name, a.code AS airline_code,
             dep.name AS departure_airport_name, dep.code AS departure_airport_code, dep.city AS departure_airport_city,
             arr.name AS arrival_airport_name, arr.code AS arrival_airport_code, arr.city AS arrival_airport_city,
             (SELECT COUNT(*) FROM seats s WHERE s.flight_id = f.id AND s.status = 'available') AS available_seats
      FROM flights f
      JOIN airlines a ON f.airline_id = a.id
      JOIN airports dep ON f.departure_airport_id = dep.id
      JOIN airports arr ON f.arrival_airport_id = arr.id
      WHERE ${sqlWhere}
      ORDER BY ${orderBy} ASC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as FlightDetail[];

    const countResult = db.prepare(`
      SELECT COUNT(*) AS count
      FROM flights f
      JOIN airlines a ON f.airline_id = a.id
      JOIN airports dep ON f.departure_airport_id = dep.id
      JOIN airports arr ON f.arrival_airport_id = arr.id
      WHERE ${sqlWhere}
    `).get(...params) as { count: number };

    const total = countResult.count;

    const result: PaginatedResult<FlightDetail> = {
      data: flights,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    console.log('[Flight] searchFlights - found:', total, 'flights, page:', page);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export function getFlightById(req: Request, res: Response, next: NextFunction): void {
  try {
    const { id } = req.params;
    console.log('[Flight] getFlightById - id:', id);

    const flight = db.prepare(`
      SELECT f.*, a.name AS airline_name, a.code AS airline_code,
             dep.name AS departure_airport_name, dep.code AS departure_airport_code, dep.city AS departure_airport_city,
             arr.name AS arrival_airport_name, arr.code AS arrival_airport_code, arr.city AS arrival_airport_city,
             (SELECT COUNT(*) FROM seats s WHERE s.flight_id = f.id AND s.status = 'available') AS available_seats
      FROM flights f
      JOIN airlines a ON f.airline_id = a.id
      JOIN airports dep ON f.departure_airport_id = dep.id
      JOIN airports arr ON f.arrival_airport_id = arr.id
      WHERE f.id = ?
    `).get(id) as FlightDetail | undefined;

    if (!flight) {
      console.log('[Flight] getFlightById - not found:', id);
      throw new AppError('Chuyến bay không tồn tại', 404);
    }

    console.log('[Flight] getFlightById - found, available_seats:', flight.available_seats);
    res.status(200).json({ flight });
  } catch (error) {
    next(error);
  }
}

export function getFlightSeats(req: Request, res: Response, next: NextFunction): void {
  try {
    const { id } = req.params;
    console.log('[Flight] getFlightSeats - flightId:', id);

    const flight = db.prepare('SELECT id FROM flights WHERE id = ?').get(id);
    if (!flight) {
      console.log('[Flight] getFlightSeats - flight not found:', id);
      throw new AppError('Chuyến bay không tồn tại', 404);
    }

    const seats = db.prepare('SELECT * FROM seats WHERE flight_id = ?').all(id) as Seat[];

    console.log('[Flight] getFlightSeats - total seats:', seats.length, 'available:', seats.filter(s => s.status === 'available').length);
    res.status(200).json({ seats });
  } catch (error) {
    next(error);
  }
}

export function createFlight(req: Request, res: Response, next: NextFunction): void {
  try {
    const data = req.body as CreateFlightRequest;
    console.log('[Flight] createFlight - airline:', data.airline_id, 'seats:', data.total_seats);

    if (new Date(data.departure_time) >= new Date(data.arrival_time)) {
      console.log('[Flight] createFlight - invalid time: departure >= arrival');
      throw new AppError('Giờ khởi hành phải trước giờ đến', 400);
    }

    const createFlightTrx = db.transaction(() => {
      const result = db.prepare(
        `INSERT INTO flights (airline_id, departure_airport_id, arrival_airport_id, departure_time, arrival_time, base_price, total_seats)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        data.airline_id,
        data.departure_airport_id,
        data.arrival_airport_id,
        data.departure_time,
        data.arrival_time,
        data.base_price,
        data.total_seats,
      );

      const flightId = Number(result.lastInsertRowid);

      // Generate seats: 20% first, 20% business, 60% economy
      const totalSeats = data.total_seats;
      const firstCount = Math.floor(totalSeats * 0.2);
      const businessCount = Math.floor(totalSeats * 0.2);
      const economyCount = totalSeats - firstCount - businessCount;

      const seatClasses: { class: string; count: number; priceModifier: number }[] = [
        { class: 'first', count: firstCount, priceModifier: 3.0 },
        { class: 'business', count: businessCount, priceModifier: 2.0 },
        { class: 'economy', count: economyCount, priceModifier: 1.0 },
      ];

      const insertSeat = db.prepare(
        `INSERT INTO seats (flight_id, seat_number, class, status, price_modifier)
         VALUES (?, ?, ?, 'available', ?)`
      );

      const seats: any[] = [];
      let seatIndex = 0;

      for (const sc of seatClasses) {
        for (let i = 0; i < sc.count; i++) {
          const row = Math.floor(seatIndex / COLUMNS.length) + 1;
          const col = COLUMNS[seatIndex % COLUMNS.length];
          const seatNumber = `${row}${col}`;

          insertSeat.run(flightId, seatNumber, sc.class, sc.priceModifier);
          seats.push({
            flight_id: flightId,
            seat_number: seatNumber,
            class: sc.class,
            status: 'available',
            price_modifier: sc.priceModifier,
          });
          seatIndex++;
        }
      }

      const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(flightId);

      return { flight, seats };
    });

    const created = createFlightTrx();

    console.log('[Flight] createFlight - success, flightId:', (created.flight as any)?.id, 'seats:', created.seats.length);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

export function updateFlight(req: Request, res: Response, next: NextFunction): void {
  try {
    const { id } = req.params;
    const data = req.body as UpdateFlightRequest;
    console.log('[Flight] updateFlight - id:', id, 'fields:', Object.keys(data));

    // Validate time constraints
    if (data.departure_time && data.arrival_time) {
      if (new Date(data.departure_time) >= new Date(data.arrival_time)) {
        throw new AppError('Giờ khởi hành phải trước giờ đến', 400);
      }
    } else if (data.departure_time || data.arrival_time) {
      const existing = db.prepare('SELECT departure_time, arrival_time FROM flights WHERE id = ?').get(id) as
        | { departure_time: string; arrival_time: string }
        | undefined;

      if (!existing) {
        throw new AppError('Chuyến bay không tồn tại', 404);
      }

      const depTime = data.departure_time ?? existing.departure_time;
      const arrTime = data.arrival_time ?? existing.arrival_time;

      if (new Date(depTime) >= new Date(arrTime)) {
        throw new AppError('Giờ khởi hành phải trước giờ đến', 400);
      }
    }

    // Build dynamic SET clause
    const allowedFields: (keyof UpdateFlightRequest)[] = [
      'airline_id',
      'departure_airport_id',
      'arrival_airport_id',
      'departure_time',
      'arrival_time',
      'base_price',
      'total_seats',
    ];

    const setClauses: string[] = [];
    const setParams: (string | number)[] = [];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        setParams.push(data[field] as string | number);
      }
    }

    if (setClauses.length === 0) {
      throw new AppError('Không có trường nào để cập nhật', 400);
    }

    const result = db.prepare(
      `UPDATE flights SET ${setClauses.join(', ')} WHERE id = ?`
    ).run(...setParams, id);

    if (result.changes === 0) {
      throw new AppError('Chuyến bay không tồn tại', 404);
    }

    const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(id);

    console.log('[Flight] updateFlight - success, id:', id);
    res.status(200).json({ flight });
  } catch (error) {
    next(error);
  }
}

export function deleteFlight(req: Request, res: Response, next: NextFunction): void {
  try {
    const { id } = req.params;
    console.log('[Flight] deleteFlight - id:', id);

    const result = db.prepare('DELETE FROM flights WHERE id = ?').run(id);

    if (result.changes === 0) {
      console.log('[Flight] deleteFlight - not found:', id);
      throw new AppError('Chuyến bay không tồn tại', 404);
    }

    console.log('[Flight] deleteFlight - success, id:', id);
    res.status(200).json({ message: 'Xóa chuyến bay thành công' });
  } catch (error) {
    next(error);
  }
}
