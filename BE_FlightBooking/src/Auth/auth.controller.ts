import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/database';
import { AppError } from '../shared/utils/AppError';
import { RegisterRequest, LoginRequest, ChangePasswordRequest, UserProfile, JwtPayload } from './auth.types';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

export function register(req: Request, res: Response, next: NextFunction): void {
  try {
    const { email, password, fullName, phone } = req.body as RegisterRequest;

    // Check duplicate email
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      throw new AppError('Email đã được sử dụng', 409);
    }

    // Hash password with bcrypt salt rounds 12
    const passwordHash = bcrypt.hashSync(password, 12);

    // Insert user with role='customer'
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, full_name, phone, role) VALUES (?, ?, ?, ?, ?)'
    ).run(email, passwordHash, fullName, phone, 'customer');

    const insertId = Number(result.lastInsertRowid);

    // Build user profile
    const user: UserProfile = {
      id: insertId,
      email,
      fullName,
      phone,
      role: 'customer',
      createdAt: new Date(),
    };

    // Create JWT token 24h
    const payload: JwtPayload = { id: insertId, email, role: 'customer' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({ token, user });
  } catch (error) {
    next(error);
  }
}

export function login(req: Request, res: Response, next: NextFunction): void {
  try {
    const { email, password } = req.body as LoginRequest;

    // Select user by email
    const row = db.prepare(
      'SELECT id, email, password_hash, full_name, phone, role, created_at FROM users WHERE email = ?'
    ).get(email) as any;

    if (!row) {
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }

    // Compare password
    const isMatch = bcrypt.compareSync(password, row.password_hash);
    if (!isMatch) {
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }

    // Build user profile
    const user: UserProfile = {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      phone: row.phone,
      role: row.role,
      createdAt: row.created_at,
    };

    // Create JWT token 24h
    const payload: JwtPayload = { id: row.id, email: row.email, role: row.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    res.status(200).json({ token, user });
  } catch (error) {
    next(error);
  }
}

export function getProfile(req: Request, res: Response, next: NextFunction): void {
  try {
    const userId = req.user!.id;

    const row = db.prepare(
      'SELECT id, email, full_name, phone, role, created_at FROM users WHERE id = ?'
    ).get(userId) as any;

    if (!row) {
      throw new AppError('Người dùng không tồn tại', 404);
    }

    const user: UserProfile = {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      phone: row.phone,
      role: row.role,
      createdAt: row.created_at,
    };

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

export function changePassword(req: Request, res: Response, next: NextFunction): void {
  try {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body as ChangePasswordRequest;

    // Get current user
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as any;
    if (!row) {
      throw new AppError('Người dùng không tồn tại', 404);
    }

    // Verify current password
    const isMatch = bcrypt.compareSync(currentPassword, row.password_hash);
    if (!isMatch) {
      throw new AppError('Mật khẩu hiện tại không đúng', 400);
    }

    // Hash and update new password
    const newHash = bcrypt.hashSync(newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, userId);

    res.status(200).json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    next(error);
  }
}
