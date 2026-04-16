import 'dotenv/config';
import supabase from '../config/database';
import bcrypt from 'bcryptjs';

/**
 * Insert dữ liệu mẫu vào Supabase PostgreSQL.
 * Schema đã được tạo qua SQL migration files.
 * Chạy: npx ts-node src/seeds/seed.ts
 */

async function seed() {
  const passwordHash = bcrypt.hashSync('Admin@123', 12);
  const customerHash = bcrypt.hashSync('Customer@123', 12);

  // --- Users (4) ---
  const { error: usersError } = await supabase.from('users').upsert([
    { id: 1, email: 'admin@flightbooking.local', password_hash: passwordHash, full_name: 'Admin Hệ Thống', phone: '0901000001', role: 'admin' },
    { id: 2, email: 'nguyenvana@example.local', password_hash: customerHash, full_name: 'Nguyễn Văn A', phone: '0912345678', role: 'customer' },
    { id: 3, email: 'tranthib@example.local', password_hash: customerHash, full_name: 'Trần Thị B', phone: '0987654321', role: 'customer' },
    { id: 4, email: 'levanc@example.local', password_hash: customerHash, full_name: 'Lê Văn C', phone: '0933456789', role: 'customer' },
  ], { onConflict: 'email' });
  if (usersError) {
    console.error('Error seeding users:', usersError.message);
    throw usersError;
  }

  // --- Airlines (3) ---
  const { error: airlinesError } = await supabase.from('airlines').upsert([
    { id: 1, name: 'Vietnam Airlines', code: 'VNA', logo_url: '/logos/vna.png' },
    { id: 2, name: 'VietJet Air', code: 'VJA', logo_url: '/logos/vja.png' },
    { id: 3, name: 'Bamboo Airways', code: 'BAV', logo_url: '/logos/bav.png' },
  ], { onConflict: 'code' });
  if (airlinesError) {
    console.error('Error seeding airlines:', airlinesError.message);
    throw airlinesError;
  }

  // --- Airports (5) ---
  const { error: airportsError } = await supabase.from('airports').upsert([
    { id: 1, name: 'Tân Sơn Nhất', code: 'SGN', city: 'Hồ Chí Minh', country: 'Việt Nam' },
    { id: 2, name: 'Nội Bài', code: 'HAN', city: 'Hà Nội', country: 'Việt Nam' },
    { id: 3, name: 'Đà Nẵng', code: 'DAD', city: 'Đà Nẵng', country: 'Việt Nam' },
    { id: 4, name: 'Cam Ranh', code: 'CXR', city: 'Nha Trang', country: 'Việt Nam' },
    { id: 5, name: 'Phú Quốc', code: 'PQC', city: 'Phú Quốc', country: 'Việt Nam' },
  ], { onConflict: 'code' });
  if (airportsError) {
    console.error('Error seeding airports:', airportsError.message);
    throw airportsError;
  }

  // --- Flights (6) ---
  const { error: flightsError } = await supabase.from('flights').upsert([
    { id: 1, airline_id: 1, departure_airport_id: 1, arrival_airport_id: 2, departure_time: '2026-05-01T06:00:00Z', arrival_time: '2026-05-01T08:10:00Z', base_price: 1500000, total_seats: 30, status: 'scheduled' },
    { id: 2, airline_id: 1, departure_airport_id: 2, arrival_airport_id: 1, departure_time: '2026-05-01T10:00:00Z', arrival_time: '2026-05-01T12:10:00Z', base_price: 1600000, total_seats: 30, status: 'scheduled' },
    { id: 3, airline_id: 2, departure_airport_id: 1, arrival_airport_id: 3, departure_time: '2026-05-02T07:30:00Z', arrival_time: '2026-05-02T08:50:00Z', base_price: 900000, total_seats: 30, status: 'scheduled' },
    { id: 4, airline_id: 3, departure_airport_id: 2, arrival_airport_id: 3, departure_time: '2026-05-02T14:00:00Z', arrival_time: '2026-05-02T15:20:00Z', base_price: 850000, total_seats: 30, status: 'scheduled' },
    { id: 5, airline_id: 2, departure_airport_id: 1, arrival_airport_id: 4, departure_time: '2026-05-03T08:00:00Z', arrival_time: '2026-05-03T09:00:00Z', base_price: 750000, total_seats: 30, status: 'scheduled' },
    { id: 6, airline_id: 1, departure_airport_id: 1, arrival_airport_id: 5, departure_time: '2026-05-03T11:00:00Z', arrival_time: '2026-05-03T12:00:00Z', base_price: 1100000, total_seats: 30, status: 'scheduled' },
  ], { onConflict: 'id' });
  if (flightsError) {
    console.error('Error seeding flights:', flightsError.message);
    throw flightsError;
  }

  // --- Seats (180 = 30 per flight × 6 flights) ---
  // 6 first, 6 business, 18 economy per flight
  const seatColumns = ['A', 'B', 'C', 'D', 'E', 'F'];
  const seats: Array<{
    id: number;
    flight_id: number;
    seat_number: string;
    class: string;
    status: string;
    price_modifier: number;
  }> = [];
  let seatId = 1;

  for (let flightId = 1; flightId <= 6; flightId++) {
    // Row 1: First class (6 seats)
    for (const col of seatColumns) {
      seats.push({ id: seatId++, flight_id: flightId, seat_number: `1${col}`, class: 'first', status: 'available', price_modifier: 3.0 });
    }
    // Row 2: Business class (6 seats)
    for (const col of seatColumns) {
      seats.push({ id: seatId++, flight_id: flightId, seat_number: `2${col}`, class: 'business', status: 'available', price_modifier: 2.0 });
    }
    // Rows 3-5: Economy class (18 seats)
    for (let row = 3; row <= 5; row++) {
      for (const col of seatColumns) {
        seats.push({ id: seatId++, flight_id: flightId, seat_number: `${row}${col}`, class: 'economy', status: 'available', price_modifier: 1.0 });
      }
    }
  }

  // Upsert seats in batches (Supabase has payload limits)
  const BATCH_SIZE = 50;
  for (let i = 0; i < seats.length; i += BATCH_SIZE) {
    const batch = seats.slice(i, i + BATCH_SIZE);
    const { error: seatsError } = await supabase.from('seats').upsert(batch, { onConflict: 'id' });
    if (seatsError) {
      console.error(`Error seeding seats (batch ${i / BATCH_SIZE + 1}):`, seatsError.message);
      throw seatsError;
    }
  }

  // --- Update booked seats ---
  // Booking 1: seats 3A, 3B of flight 1 (seat ids 13, 14)
  const { error: seatUpdate1Error } = await supabase
    .from('seats')
    .update({ status: 'booked' })
    .eq('flight_id', 1)
    .in('seat_number', ['3A', '3B']);
  if (seatUpdate1Error) {
    console.error('Error updating seats for booking 1:', seatUpdate1Error.message);
    throw seatUpdate1Error;
  }

  // Booking 2: seat 2A of flight 3 (seat id 67)
  const { error: seatUpdate2Error } = await supabase
    .from('seats')
    .update({ status: 'booked' })
    .eq('flight_id', 3)
    .eq('seat_number', '2A');
  if (seatUpdate2Error) {
    console.error('Error updating seats for booking 2:', seatUpdate2Error.message);
    throw seatUpdate2Error;
  }

  // --- Bookings (2) ---
  const { error: bookingsError } = await supabase.from('bookings').upsert([
    { id: 1, user_id: 2, flight_id: 1, booking_code: 'BOOK0001', status: 'confirmed', total_amount: 3000000 },
    { id: 2, user_id: 3, flight_id: 3, booking_code: 'BOOK0002', status: 'pending', total_amount: 1800000 },
  ], { onConflict: 'booking_code' });
  if (bookingsError) {
    console.error('Error seeding bookings:', bookingsError.message);
    throw bookingsError;
  }

  // --- Passengers (3) ---
  const { error: passengersError } = await supabase.from('passengers').upsert([
    { id: 1, booking_id: 1, seat_id: 13, full_name: 'Nguyễn Văn A', date_of_birth: '1990-05-15', id_number: '012345678901', id_type: 'cccd' },
    { id: 2, booking_id: 1, seat_id: 14, full_name: 'Phạm Thị D', date_of_birth: '1992-08-20', id_number: '098765432109', id_type: 'cccd' },
    { id: 3, booking_id: 2, seat_id: 67, full_name: 'Trần Thị B', date_of_birth: '1988-03-10', id_number: 'P12345678', id_type: 'passport' },
  ], { onConflict: 'id' });
  if (passengersError) {
    console.error('Error seeding passengers:', passengersError.message);
    throw passengersError;
  }

  // --- Payments (1) ---
  const { error: paymentsError } = await supabase.from('payments').upsert([
    { id: 1, booking_id: 1, amount: 3000000, method: 'credit_card', status: 'success', transaction_code: 'TXN20260501001', paid_at: '2026-04-28T10:30:00Z' },
  ], { onConflict: 'transaction_code' });
  if (paymentsError) {
    console.error('Error seeding payments:', paymentsError.message);
    throw paymentsError;
  }

  // --- Reset sequences to avoid duplicate key errors on new inserts ---
  const tables = ['users', 'airlines', 'airports', 'flights', 'seats', 'bookings', 'passengers', 'payments'];
  for (const table of tables) {
    const { error: seqError } = await supabase.rpc('reset_sequence', { p_table: table });
    if (seqError) {
      // Fallback: ignore if RPC doesn't exist, user can reset manually
      console.warn(`Warning: Could not reset sequence for ${table}:`, seqError.message);
    }
  }

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
}

seed().catch(console.error);
