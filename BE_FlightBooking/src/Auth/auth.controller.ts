import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import supabase from '../config/database';
import { AppError } from '../shared/utils/AppError';
import { debugLog } from '../shared/utils/debug';
import { RegisterRequest, LoginRequest, ChangePasswordRequest, UserProfile, JwtPayload } from './auth.types';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, fullName, phone } = req.body as RegisterRequest;
    debugLog('Auth', 'register - email:', email);

    // Hash password with bcrypt salt rounds 12
    const passwordHash = bcrypt.hashSync(password, 12);

    // Insert user with role='customer', select back the created row
    const { data, error } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        full_name: fullName,
        phone,
        role: 'customer',
      })
      .select('id, email, full_name, phone, role, created_at')
      .single();

    if (error) {
      // Unique violation → 409 (duplicate email)
      if (error.code === '23505') {
        debugLog('Auth', 'register - duplicate email:', email);
        throw new AppError('Email đã được sử dụng', 409);
      }
      throw new AppError(error.message, 500);
    }

    debugLog('Auth', 'register - success, userId:', data.id);

    // Build user profile
    const user: UserProfile = {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      phone: data.phone,
      role: data.role,
      createdAt: data.created_at,
    };

    // Create JWT token 24h
    const payload: JwtPayload = { id: data.id, email: data.email, role: data.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({ token, user });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as LoginRequest;
    debugLog('Auth', 'login - email:', email);

    // Select user by email
    const { data: row, error } = await supabase
      .from('users')
      .select('id, email, password_hash, full_name, phone, role, created_at')
      .eq('email', email)
      .single();

    if (error || !row) {
      debugLog('Auth', 'login - email not found:', email);
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }

    // Compare password
    const isMatch = bcrypt.compareSync(password, row.password_hash);
    if (!isMatch) {
      debugLog('Auth', 'login - wrong password for:', email);
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }

    debugLog('Auth', 'login - success, userId:', row.id, 'role:', row.role);

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

export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    debugLog('Auth', 'getProfile - userId:', userId);

    const { data: row, error } = await supabase
      .from('users')
      .select('id, email, full_name, phone, role, created_at')
      .eq('id', userId)
      .single();

    if (error || !row) {
      debugLog('Auth', 'getProfile - user not found:', userId);
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

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body as ChangePasswordRequest;
    debugLog('Auth', 'changePassword - userId:', userId);

    // Get current user
    const { data: row, error } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (error || !row) {
      debugLog('Auth', 'changePassword - user not found:', userId);
      throw new AppError('Người dùng không tồn tại', 404);
    }

    // Verify current password
    const isMatch = bcrypt.compareSync(currentPassword, row.password_hash);
    if (!isMatch) {
      debugLog('Auth', 'changePassword - wrong current password, userId:', userId);
      throw new AppError('Mật khẩu hiện tại không đúng', 400);
    }

    // Hash and update new password
    const newHash = bcrypt.hashSync(newPassword, 12);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newHash })
      .eq('id', userId);

    if (updateError) {
      throw new AppError(updateError.message, 500);
    }

    debugLog('Auth', 'changePassword - success, userId:', userId);
    res.status(200).json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    next(error);
  }
}
