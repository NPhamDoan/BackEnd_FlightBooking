import db from '../config/database';

export function up(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      flight_id INTEGER NOT NULL,
      booking_code TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'cancelled', 'completed')),
      total_amount REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (flight_id) REFERENCES flights(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS passengers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      seat_id INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      date_of_birth TEXT NOT NULL,
      id_number TEXT NOT NULL,
      id_type TEXT NOT NULL CHECK(id_type IN ('cmnd', 'cccd', 'passport')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
      FOREIGN KEY (seat_id) REFERENCES seats(id)
    )
  `);

  // Indexes on bookings
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bookings_flight_id ON bookings(flight_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bookings_booking_code ON bookings(booking_code)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`);

  // Indexes on passengers
  db.exec(`CREATE INDEX IF NOT EXISTS idx_passengers_booking_id ON passengers(booking_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_passengers_seat_id ON passengers(seat_id)`);
}

export function down(): void {
  db.exec(`DROP TABLE IF EXISTS passengers`);
  db.exec(`DROP TABLE IF EXISTS bookings`);
}
