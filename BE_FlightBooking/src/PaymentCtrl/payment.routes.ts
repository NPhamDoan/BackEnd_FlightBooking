import { Router } from 'express';
import { processPaymentValidation, handleValidationErrors } from '../PaymentCtrl/payment.validator';
import { processPayment, getPaymentByBookingId } from '../PaymentCtrl/payment.controller';
import { authMiddleware } from '../shared/middlewares/auth.middleware';

const paymentRoutes = Router();

// POST /api/payments
paymentRoutes.post('/', authMiddleware, processPaymentValidation, handleValidationErrors, processPayment);

// GET /api/payments/booking/:bookingId
paymentRoutes.get('/booking/:bookingId', authMiddleware, getPaymentByBookingId);

export default paymentRoutes;
