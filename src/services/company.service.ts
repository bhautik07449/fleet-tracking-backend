import pool from '../db';

export const getCompanyInfo = async (companyId: string) => {
  const res = await pool.query('SELECT * FROM "Company" WHERE id = $1', [companyId]);
  if (res.rows.length === 0) {
    throw new Error('Company not found');
  }
  return res.rows[0];
};

export const updateCompanyInfo = async (companyId: string, data: any) => {
  const updates = [];
  const values = [];
  let paramIdx = 1;

  if (data.name !== undefined) { updates.push(`name = $${paramIdx++}`); values.push(data.name); }
  if (data.address !== undefined) { updates.push(`address = $${paramIdx++}`); values.push(data.address); }
  if (data.phone !== undefined) { updates.push(`phone = $${paramIdx++}`); values.push(data.phone); }
  if (data.settings !== undefined) { updates.push(`settings = $${paramIdx++}`); values.push(data.settings); }

  if (updates.length === 0) return getCompanyInfo(companyId);

  updates.push(`"updatedAt" = NOW()`);
  values.push(companyId);

  const res = await pool.query(
    `UPDATE "Company" SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    values
  );

  return res.rows[0];
};
