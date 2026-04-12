import db from '../config/database';

export function up(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      method TEXT NOT NULL CHECK(method IN ('credit_card', 'bank_transfer', 'e_wallet')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'success', 'failed', 'refunded')),
      transaction_code TEXT UNIQUE,
      paid_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_transaction_code ON payments(transaction_code)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`);
}

export function down(): void {
  db.exec(`DROP TABLE IF EXISTS payments`);
}
