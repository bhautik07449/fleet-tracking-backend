import pool from '../db';
import crypto from 'crypto';
import { hashPassword, comparePassword } from '../utils/hash';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';

export const registerCompanyAndOwner = async (data: any) => {
  const existingUserRes = await pool.query('SELECT id FROM "User" WHERE email = $1', [data.email]);
  if (existingUserRes.rows.length > 0) {
    throw new Error('Email is already registered');
  }

  const hashedPassword = await hashPassword(data.password);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = crypto.randomUUID();
    await client.query(
      'INSERT INTO "Company" (id, name, email, "updatedAt") VALUES ($1, $2, $3, NOW())',
      [companyId, data.companyName, data.email]
    );

    const userId = crypto.randomUUID();
    await client.query(
      'INSERT INTO "User" (id, "companyId", name, email, password, role, "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
      [userId, companyId, data.name, data.email, hashedPassword, 'COMPANY_OWNER']
    );

    await client.query('COMMIT');

    const tokens = generateTokens(userId, 'COMPANY_OWNER', companyId);

    return {
      user: { id: userId, name: data.name, email: data.email, role: 'COMPANY_OWNER' },
      company: { id: companyId, name: data.companyName },
      tokens,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const loginUser = async (data: any) => {
  const userRes = await pool.query('SELECT * FROM "User" WHERE email = $1', [data.email]);
  const user = userRes.rows[0];

  if (!user || !user.isActive) {
    throw new Error('Invalid credentials or inactive account');
  }

  const isValidPassword = await comparePassword(data.password, user.password);
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }

  const tokens = generateTokens(user.id, user.role, user.companyId);

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId },
    tokens,
  };
};

export const refreshToken = async (token: string) => {
  const decoded: any = verifyRefreshToken(token);
  if (!decoded) {
    throw new Error('Invalid refresh token');
  }

  const userRes = await pool.query('SELECT * FROM "User" WHERE id = $1', [decoded.userId]);
  const user = userRes.rows[0];

  if (!user || !user.isActive) {
    throw new Error('User not found or inactive');
  }

  return generateTokens(user.id, user.role, user.companyId);
};
