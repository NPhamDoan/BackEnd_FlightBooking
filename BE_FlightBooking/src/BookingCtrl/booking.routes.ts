import { Router } from 'express';
import {
  createBookingValidation,
  adminUpdateStatusValidation,
  handleValidationErrors,
} from './booking.validator';
import {
  createBooking,
  cancelBooking,
  getBookingHistory,
  getBookingById,
  getAllBookings,
  adminUpdateBookingStatus,
  adminCancelFlight,
} from './booking.controller';
import { authMiddleware } from '../shared/middlewares/auth.middleware';
import { authorize } from '../shared/middlewares/authorize.middleware';

// Customer routes — mounted at /api/bookings
const bookingRoutes = Router();

// POST /api/bookings
bookingRoutes.post('/', authMiddleware, createBookingValidation, handleValidationErrors, createBooking);

// GET /api/bookings
bookingRoutes.get('/', authMiddleware, getBookingHistory);

// GET /api/bookings/:id
bookingRoutes.get('/:id', authMiddleware, getBookingById);

// POST /api/bookings/:id/cancel
bookingRoutes.post('/:id/cancel', authMiddleware, cancelBooking);

// Admin routes — mounted at /api/admin
const adminBookingRoutes = Router();

// GET /api/admin/bookings
adminBookingRoutes.get('/bookings', authMiddleware, authorize('admin'), getAllBookings);

// PUT /api/admin/bookings/:id/status
adminBookingRoutes.put('/bookings/:id/status', authMiddleware, authorize('admin'), adminUpdateStatusValidation, handleValidationErrors, adminUpdateBookingStatus);

// POST /api/admin/bookings/flight/:id/cancel
adminBookingRoutes.post('/bookings/flight/:id/cancel', authMiddleware, authorize('admin'), adminCancelFlight);

export { adminBookingRoutes };
export default bookingRoutes;
