import pool from '../db';
import crypto from 'crypto';

export const getUsers = async (companyId: string, skip?: number, limit?: number) => {
  const res = await pool.query(
    'SELECT id, "companyId", name, email, role, "isActive", "createdAt" FROM "User" WHERE "companyId" = $1 ORDER BY "createdAt" DESC',
    [companyId]
  );
  return res.rows;
};

export const getUserById = async (userId: string, companyId: string) => {
  const res = await pool.query(
    'SELECT id, "companyId", name, email, role, "isActive", "createdAt" FROM "User" WHERE id = $1 AND "companyId" = $2',
    [userId, companyId]
  );
  if (res.rows.length === 0) {
    throw new Error('User not found');
  }
  return res.rows[0];
};

export const createUser = async (companyId: string, data: any) => {
  const existingRes = await pool.query('SELECT id FROM "User" WHERE email = $1', [data.email]);
  if (existingRes.rows.length > 0) {
    throw new Error('Email is already registered');
  }

  const id = crypto.randomUUID();
  const res = await pool.query(
    'INSERT INTO "User" (id, "companyId", name, email, password, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, "companyId", name, email, role, "isActive", "createdAt"',
    [id, companyId, data.name, data.email, data.password, data.role]
  );
  return res.rows[0];
};

export const updateUser = async (userId: string, companyId: string, data: any) => {
  const userRes = await pool.query('SELECT id FROM "User" WHERE id = $1 AND "companyId" = $2', [userId, companyId]);
  if (userRes.rows.length === 0) {
    throw new Error('User not found');
  }

  if (data.email) {
    const existingRes = await pool.query('SELECT id FROM "User" WHERE email = $1 AND id != $2', [data.email, userId]);
    if (existingRes.rows.length > 0) {
      throw new Error('Email is already in use');
    }
  }

  const updates = [];
  const values = [];
  let paramIdx = 1;

  if (data.name !== undefined) { updates.push(`name = $${paramIdx++}`); values.push(data.name); }
  if (data.email !== undefined) { updates.push(`email = $${paramIdx++}`); values.push(data.email); }
  if (data.role !== undefined) { updates.push(`role = $${paramIdx++}`); values.push(data.role); }
  if (data.isActive !== undefined) { updates.push(`"isActive" = $${paramIdx++}`); values.push(data.isActive); }

  if (updates.length === 0) return userRes.rows[0];

  updates.push(`"updatedAt" = NOW()`);
  values.push(userId);
  values.push(companyId);

  const res = await pool.query(
    `UPDATE "User" SET ${updates.join(', ')} WHERE id = $${paramIdx} AND "companyId" = $${paramIdx + 1} RETURNING id, "companyId", name, email, role, "isActive", "createdAt"`,
    values
  );

  return res.rows[0];
};

export const deleteUser = async (userId: string, companyId: string) => {
  const userRes = await pool.query('SELECT id FROM "User" WHERE id = $1 AND "companyId" = $2', [userId, companyId]);
  if (userRes.rows.length === 0) {
    throw new Error('User not found');
  }

  await pool.query('DELETE FROM "User" WHERE id = $1', [userId]);
  return { message: 'User deleted successfully' };
};
