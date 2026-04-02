import { Router } from 'express';
import { registerValidation, loginValidation, changePasswordValidation, handleValidationErrors } from './auth.validator';
import { register, login, getProfile, changePassword } from './auth.controller';
import { authMiddleware } from '../shared/middlewares/auth.middleware';

const router = Router();

// POST /api/auth/register
router.post('/register', registerValidation, handleValidationErrors, register);

// POST /api/auth/login
router.post('/login', loginValidation, handleValidationErrors, login);

// GET /api/auth/profile
router.get('/profile', authMiddleware, getProfile);

// PUT /api/auth/change-password
router.put('/change-password', authMiddleware, changePasswordValidation, handleValidationErrors, changePassword);

export default router;
