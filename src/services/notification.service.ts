import pool from '../db';

export const getUserNotifications = async (userId: string, companyId: string) => {
  // Ensure user belongs to the requesting company (basic auth check)
  const userCheck = await pool.query('SELECT id FROM "User" WHERE id = $1 AND "companyId" = $2', [userId, companyId]);
  if (userCheck.rows.length === 0) {
    throw new Error('User not found in this company');
  }

  const res = await pool.query('SELECT * FROM "Notification" WHERE "userId" = $1 ORDER BY "createdAt" DESC', [userId]);
  return res.rows;
};

export const markNotificationAsRead = async (notificationId: string, userId: string) => {
  const check = await pool.query('SELECT id FROM "Notification" WHERE id = $1 AND "userId" = $2', [notificationId, userId]);
  if (check.rows.length === 0) {
    throw new Error('Notification not found');
  }

  const res = await pool.query('UPDATE "Notification" SET "isRead" = true WHERE id = $1 RETURNING *', [notificationId]);
  return res.rows[0];
};
