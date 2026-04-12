import { body } from 'express-validator';
export { handleValidationErrors } from '../Auth/auth.validator';

export const processPaymentValidation = [
  body('bookingId')
    .notEmpty().withMessage('bookingId là bắt buộc')
    .isInt().withMessage('bookingId phải là số nguyên'),

  body('amount')
    .notEmpty().withMessage('Số tiền là bắt buộc')
    .isFloat({ gt: 0 }).withMessage('Số tiền phải lớn hơn 0'),

  body('method')
    .notEmpty().withMessage('Phương thức thanh toán là bắt buộc')
    .isIn(['credit_card', 'bank_transfer', 'e_wallet']).withMessage('Phương thức phải là credit_card, bank_transfer hoặc e_wallet'),
];
