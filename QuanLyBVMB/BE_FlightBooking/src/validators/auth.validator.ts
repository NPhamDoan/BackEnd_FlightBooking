import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export const registerValidation = [
  body('email')
    .notEmpty().withMessage('Email là bắt buộc')
    .isEmail().withMessage('Email không đúng định dạng'),

  body('password')
    .notEmpty().withMessage('Mật khẩu là bắt buộc')
    .isLength({ min: 8 }).withMessage('Mật khẩu phải có ít nhất 8 ký tự')
    .matches(/[A-Z]/).withMessage('Mật khẩu phải chứa ít nhất 1 chữ hoa')
    .matches(/[a-z]/).withMessage('Mật khẩu phải chứa ít nhất 1 chữ thường')
    .matches(/[0-9]/).withMessage('Mật khẩu phải chứa ít nhất 1 số'),

  body('phone')
    .notEmpty().withMessage('Số điện thoại là bắt buộc')
    .matches(/^0\d{9}$/).withMessage('Số điện thoại phải gồm 10 số và bắt đầu bằng 0'),

  body('fullName')
    .notEmpty().withMessage('Họ tên là bắt buộc')
    .trim(),
];

export const loginValidation = [
  body('email')
    .notEmpty().withMessage('Email là bắt buộc')
    .isEmail().withMessage('Email không đúng định dạng'),

  body('password')
    .notEmpty().withMessage('Mật khẩu là bắt buộc'),
];

export function handleValidationErrors(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: (err as any).path,
      message: err.msg,
    }));

    res.status(400).json({
      status: 'error',
      errors: formattedErrors,
    });
    return;
  }

  next();
}

export const changePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Mật khẩu hiện tại là bắt buộc'),

  body('newPassword')
    .notEmpty().withMessage('Mật khẩu mới là bắt buộc')
    .isLength({ min: 8 }).withMessage('Mật khẩu mới phải có ít nhất 8 ký tự')
    .matches(/[A-Z]/).withMessage('Mật khẩu mới phải chứa ít nhất 1 chữ hoa')
    .matches(/[a-z]/).withMessage('Mật khẩu mới phải chứa ít nhất 1 chữ thường')
    .matches(/[0-9]/).withMessage('Mật khẩu mới phải chứa ít nhất 1 số'),
];
