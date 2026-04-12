import db from '../config/database';

export function up(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS airlines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      logo_url TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS airports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS flights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      airline_id INTEGER NOT NULL,
      departure_airport_id INTEGER NOT NULL,
      arrival_airport_id INTEGER NOT NULL,
      departure_time TEXT NOT NULL,
      arrival_time TEXT NOT NULL,
      base_price REAL NOT NULL,
      total_seats INTEGER NOT NULL,
      status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'delayed', 'cancelled', 'completed')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (airline_id) REFERENCES airlines(id),
      FOREIGN KEY (departure_airport_id) REFERENCES airports(id),
      FOREIGN KEY (arrival_airport_id) REFERENCES airports(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS seats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_id INTEGER NOT NULL,
      seat_number TEXT NOT NULL,
      class TEXT CHECK(class IN ('economy', 'business', 'first')),
      status TEXT DEFAULT 'available' CHECK(status IN ('available', 'booked', 'blocked')),
      price_modifier REAL DEFAULT 1.0,
      FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
    )
  `);

  // Indexes on flights
  db.exec(`CREATE INDEX IF NOT EXISTS idx_flights_airline_id ON flights(airline_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_flights_departure_airport_id ON flights(departure_airport_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_flights_arrival_airport_id ON flights(arrival_airport_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_flights_status ON flights(status)`);

  // Indexes on seats
  db.exec(`CREATE INDEX IF NOT EXISTS idx_seats_flight_id ON seats(flight_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_seats_status ON seats(status)`);
}

export function down(): void {
  db.exec(`DROP TABLE IF EXISTS seats`);
  db.exec(`DROP TABLE IF EXISTS flights`);
  db.exec(`DROP TABLE IF EXISTS airports`);
  db.exec(`DROP TABLE IF EXISTS airlines`);
}
