import db from '../config/database';
import bcrypt from 'bcryptjs';

/**
 * Tạo tất cả bảng và insert dữ liệu mẫu.
 * Chạy: npx ts-node src/seeds/seed.ts
 */

// --- Tạo bảng ---
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer', 'admin')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS airlines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    logo_url TEXT
  );

  CREATE TABLE IF NOT EXISTS airports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    city TEXT NOT NULL,
    country TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS flights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    airline_id INTEGER NOT NULL,
    departure_airport_id INTEGER NOT NULL,
    arrival_airport_id INTEGER NOT NULL,
    departure_time TEXT NOT NULL,
    arrival_time TEXT NOT NULL,
    base_price REAL NOT NULL,
    total_seats INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','delayed','cancelled','completed')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (airline_id) REFERENCES airlines(id),
    FOREIGN KEY (departure_airport_id) REFERENCES airports(id),
    FOREIGN KEY (arrival_airport_id) REFERENCES airports(id)
  );

  CREATE TABLE IF NOT EXISTS seats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flight_id INTEGER NOT NULL,
    seat_number TEXT NOT NULL,
    class TEXT NOT NULL CHECK(class IN ('economy','business','first')),
    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','booked','blocked')),
    price_modifier REAL NOT NULL DEFAULT 1.0,
    FOREIGN KEY (flight_id) REFERENCES flights(id)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    flight_id INTEGER NOT NULL,
    booking_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled','completed')),
    total_amount REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (flight_id) REFERENCES flights(id)
  );

  CREATE TABLE IF NOT EXISTS passengers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL,
    seat_id INTEGER NOT NULL,
    full_name TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    id_number TEXT NOT NULL,
    id_type TEXT NOT NULL CHECK(id_type IN ('cmnd','cccd','passport')),
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    FOREIGN KEY (seat_id) REFERENCES seats(id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    method TEXT NOT NULL CHECK(method IN ('credit_card','bank_transfer','e_wallet')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','success','failed','refunded')),
    transaction_code TEXT UNIQUE,
    paid_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
  );
`);

// --- Insert dữ liệu mẫu ---

const passwordHash = bcrypt.hashSync('Admin@123', 12);
const customerHash = bcrypt.hashSync('Customer@123', 12);

// Users
const insertUser = db.prepare(
  'INSERT OR IGNORE INTO users (email, password_hash, full_name, phone, role) VALUES (?, ?, ?, ?, ?)'
);
insertUser.run('admin@flightbooking.local', passwordHash, 'Admin Hệ Thống', '0901000001', 'admin');
insertUser.run('nguyenvana@example.local', customerHash, 'Nguyễn Văn A', '0912345678', 'customer');
insertUser.run('tranthib@example.local', customerHash, 'Trần Thị B', '0987654321', 'customer');
insertUser.run('levanc@example.local', customerHash, 'Lê Văn C', '0933456789', 'customer');

// Airlines
const insertAirline = db.prepare(
  'INSERT OR IGNORE INTO airlines (name, code, logo_url) VALUES (?, ?, ?)'
);
insertAirline.run('Vietnam Airlines', 'VNA', '/logos/vna.png');
insertAirline.run('VietJet Air', 'VJA', '/logos/vja.png');
insertAirline.run('Bamboo Airways', 'BAV', '/logos/bav.png');

// Airports
const insertAirport = db.prepare(
  'INSERT OR IGNORE INTO airports (name, code, city, country) VALUES (?, ?, ?, ?)'
);
insertAirport.run('Tân Sơn Nhất', 'SGN', 'Hồ Chí Minh', 'Việt Nam');
insertAirport.run('Nội Bài', 'HAN', 'Hà Nội', 'Việt Nam');
insertAirport.run('Đà Nẵng', 'DAD', 'Đà Nẵng', 'Việt Nam');
insertAirport.run('Cam Ranh', 'CXR', 'Nha Trang', 'Việt Nam');
insertAirport.run('Phú Quốc', 'PQC', 'Phú Quốc', 'Việt Nam');

// Flights
const insertFlight = db.prepare(
  `INSERT INTO flights (airline_id, departure_airport_id, arrival_airport_id, departure_time, arrival_time, base_price, total_seats, status)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
// VNA: SGN -> HAN
insertFlight.run(1, 1, 2, '2026-05-01 06:00:00', '2026-05-01 08:10:00', 1500000, 30, 'scheduled');
// VNA: HAN -> SGN
insertFlight.run(1, 2, 1, '2026-05-01 10:00:00', '2026-05-01 12:10:00', 1600000, 30, 'scheduled');
// VJA: SGN -> DAD
insertFlight.run(2, 1, 3, '2026-05-02 07:30:00', '2026-05-02 08:50:00', 900000, 30, 'scheduled');
// BAV: HAN -> DAD
insertFlight.run(3, 2, 3, '2026-05-02 14:00:00', '2026-05-02 15:20:00', 850000, 30, 'scheduled');
// VJA: SGN -> CXR
insertFlight.run(2, 1, 4, '2026-05-03 08:00:00', '2026-05-03 09:00:00', 750000, 30, 'scheduled');
// VNA: SGN -> PQC
insertFlight.run(1, 1, 5, '2026-05-03 11:00:00', '2026-05-03 12:00:00', 1100000, 30, 'scheduled');

// Seats — tạo 30 ghế cho mỗi chuyến bay (6 first, 6 business, 18 economy)
const insertSeat = db.prepare(
  'INSERT INTO seats (flight_id, seat_number, class, status, price_modifier) VALUES (?, ?, ?, ?, ?)'
);

const seatRows = ['A', 'B', 'C', 'D', 'E', 'F'];
for (let flightId = 1; flightId <= 6; flightId++) {
  let seatIndex = 0;
  // Row 1: First class
  for (const col of seatRows) {
    insertSeat.run(flightId, `1${col}`, 'first', 'available', 3.0);
    seatIndex++;
  }
  // Row 2: Business class
  for (const col of seatRows) {
    insertSeat.run(flightId, `2${col}`, 'business', 'available', 2.0);
    seatIndex++;
  }
  // Rows 3-5: Economy class
  for (let row = 3; row <= 5; row++) {
    for (const col of seatRows) {
      insertSeat.run(flightId, `${row}${col}`, 'economy', 'available', 1.0);
      seatIndex++;
    }
  }
}

// Bookings mẫu
const insertBooking = db.prepare(
  `INSERT INTO bookings (user_id, flight_id, booking_code, status, total_amount) VALUES (?, ?, ?, ?, ?)`
);
// Customer 1 đặt vé chuyến SGN->HAN (flight 1), 2 ghế economy = 1500000 * 1.0 * 2
insertBooking.run(2, 1, 'BOOK0001', 'confirmed', 3000000);
// Customer 2 đặt vé chuyến SGN->DAD (flight 3), 1 ghế business = 900000 * 2.0
insertBooking.run(3, 3, 'BOOK0002', 'pending', 1800000);

// Cập nhật ghế đã đặt
db.prepare("UPDATE seats SET status = 'booked' WHERE flight_id = 1 AND seat_number IN ('3A', '3B')").run();
db.prepare("UPDATE seats SET status = 'booked' WHERE flight_id = 3 AND seat_number = '2A'").run();

// Passengers
const insertPassenger = db.prepare(
  'INSERT INTO passengers (booking_id, seat_id, full_name, date_of_birth, id_number, id_type) VALUES (?, ?, ?, ?, ?, ?)'
);
// Booking 1: 2 hành khách — ghế 3A (seat id = flight1 offset + 13), 3B (offset + 14)
// Flight 1 seats start at id 1, row 3A = index 13, 3B = index 14
insertPassenger.run(1, 13, 'Nguyễn Văn A', '1990-05-15', '012345678901', 'cccd');
insertPassenger.run(1, 14, 'Phạm Thị D', '1992-08-20', '098765432109', 'cccd');
// Booking 2: 1 hành khách — ghế 2A (flight 3 seats start at id 61, row 2A = index 7 → id 67)
insertPassenger.run(2, 67, 'Trần Thị B', '1988-03-10', 'P12345678', 'passport');

// Payment cho booking 1 (confirmed)
db.prepare(
  `INSERT INTO payments (booking_id, amount, method, status, transaction_code, paid_at)
   VALUES (?, ?, ?, ?, ?, ?)`
).run(1, 3000000, 'credit_card', 'success', 'TXN20260501001', '2026-04-28 10:30:00');

console.log('Seed data inserted successfully!');
console.log('Users: 4 (1 admin, 3 customers)');
console.log('Airlines: 3');
console.log('Airports: 5');
console.log('Flights: 6');
console.log('Seats: 180 (30 per flight)');
console.log('Bookings: 2');
console.log('Passengers: 3');
console.log('Payments: 1');
console.log('\nLogin credentials:');
console.log('  Admin:    admin@flightbooking.local / Admin@123');
console.log('  Customer: nguyenvana@example.local / Customer@123');
