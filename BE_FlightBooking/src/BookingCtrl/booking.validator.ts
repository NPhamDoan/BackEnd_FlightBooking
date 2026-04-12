import { body } from 'express-validator';
export { handleValidationErrors } from '../Auth/auth.validator';

export const createBookingValidation = [
  body('flightId')
    .notEmpty().withMessage('flightId là bắt buộc')
    .isInt().withMessage('flightId phải là số nguyên'),

  body('passengers')
    .notEmpty().withMessage('Danh sách hành khách là bắt buộc')
    .isArray({ min: 1 }).withMessage('Phải có ít nhất 1 hành khách'),

  body('passengers.*.fullName')
    .notEmpty().withMessage('Họ tên hành khách là bắt buộc')
    .isString().withMessage('Họ tên phải là chuỗi')
    .trim(),

  body('passengers.*.dateOfBirth')
    .notEmpty().withMessage('Ngày sinh là bắt buộc')
    .isISO8601().withMessage('Ngày sinh phải đúng định dạng ISO 8601'),

  body('passengers.*.idNumber')
    .notEmpty().withMessage('Số giấy tờ là bắt buộc')
    .isString().withMessage('Số giấy tờ phải là chuỗi'),

  body('passengers.*.idType')
    .notEmpty().withMessage('Loại giấy tờ là bắt buộc')
    .isIn(['cmnd', 'cccd', 'passport']).withMessage('Loại giấy tờ phải là cmnd, cccd hoặc passport'),

  body('seatIds')
    .notEmpty().withMessage('Danh sách ghế là bắt buộc')
    .isArray({ min: 1 }).withMessage('Phải chọn ít nhất 1 ghế'),

  body('seatIds.*')
    .isInt().withMessage('Mỗi seatId phải là số nguyên'),

  body().custom((_, { req }) => {
    const { passengers, seatIds } = req.body;
    if (Array.isArray(passengers) && Array.isArray(seatIds)) {
      if (passengers.length !== seatIds.length) {
        throw new Error('Số lượng hành khách phải bằng số lượng ghế');
      }
    }
    return true;
  }),
];

export const adminUpdateStatusValidation = [
  body('status')
    .notEmpty().withMessage('Trạng thái là bắt buộc')
    .isIn(['pending', 'confirmed', 'cancelled', 'completed']).withMessage('Trạng thái phải là pending, confirmed, cancelled hoặc completed'),
];
