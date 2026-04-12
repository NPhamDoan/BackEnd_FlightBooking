export type PaymentMethod = 'credit_card' | 'bank_transfer' | 'e_wallet';
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';

export interface PaymentRequest {
  bookingId: number;
  amount: number;
  method: PaymentMethod;
}

export interface PaymentResult {
  paymentId: number;
  status: 'success' | 'failed';
  transactionCode: string;
  paidAt: string;
}

export interface Payment {
  id: number;
  booking_id: number;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transaction_code: string | null;
  paid_at: string | null;
  created_at: string;
}
