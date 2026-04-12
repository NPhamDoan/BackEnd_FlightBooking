import { query } from 'express-validator';
export { handleValidationErrors } from '../Auth/auth.validator';

const dateRangeValidation = [
  query('startDate')
    .notEmpty().withMessage('Ngày bắt đầu là bắt buộc')
    .isISO8601().withMessage('Ngày bắt đầu phải đúng định dạng ISO'),

  query('endDate')
    .notEmpty().withMessage('Ngày kết thúc là bắt buộc')
    .isISO8601().withMessage('Ngày kết thúc phải đúng định dạng ISO')
    .custom((value: string, { req }) => {
      if (req.query?.startDate && new Date(value) < new Date(req.query.startDate as string)) {
        throw new Error('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
      }
      return true;
    }),
];

export const reportByAirlineValidation = [...dateRangeValidation];
export const reportByRouteValidation = [...dateRangeValidation];

export const reportByMonthValidation = [
  query('year')
    .notEmpty().withMessage('Năm là bắt buộc')
    .isInt({ min: 2020, max: new Date().getFullYear() + 1 })
    .withMessage(`Năm phải từ 2020 đến ${new Date().getFullYear() + 1}`)
    .toInt(),
];
