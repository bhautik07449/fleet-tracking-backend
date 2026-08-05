import pool from '../db';
import crypto from 'crypto';
import { getIO } from '../socket';
import { sendEmail } from '../utils/mailer';

export const getAlerts = async (companyId: string, skip?: number, limit?: number, isResolved?: boolean) => {
  const res = await pool.query(`
    SELECT a.*, 
      json_build_object('id', v.id, 'vehicleNumber', v."vehicleNumber") as vehicle
    FROM "Alert" a
    JOIN "Vehicle" v ON a."vehicleId" = v.id
    WHERE v."companyId" = $1 ORDER BY a."createdAt" DESC
  `, [companyId]);

  // Map isRead to isResolved to match frontend expectations
  return res.rows.map(row => ({
    ...row,
    isResolved: row.isRead
  }));
};

export const resolveAlert = async (alertId: string, companyId: string) => {
  const check = await pool.query(`
    SELECT a.id FROM "Alert" a
    JOIN "Vehicle" v ON a."vehicleId" = v.id
    WHERE a.id = $1 AND v."companyId" = $2
  `, [alertId, companyId]);

  if (check.rows.length === 0) {
    throw new Error('Alert not found');
  }

  const res = await pool.query('UPDATE "Alert" SET "isRead" = true WHERE id = $1 RETURNING *', [alertId]);
  return res.rows[0];
};

export const createSystemAlert = async (vehicleId: string, companyId: string, type: string, message: string) => {
  const id = crypto.randomUUID();
  const res = await pool.query(
    'INSERT INTO "Alert" (id, "vehicleId", type, message) VALUES ($1, $2, $3, $4) RETURNING *',
    [id, vehicleId, type, message]
  );
  const alertRow = res.rows[0];

  // Fetch vehicle details so real-time socket payloads match the frontend format
  const vRes = await pool.query('SELECT id, "vehicleNumber" FROM "Vehicle" WHERE id = $1', [vehicleId]);
  const vehicle = vRes.rows[0] || { id: vehicleId, vehicleNumber: 'Unknown Vehicle' };

  const fullAlert = {
    ...alertRow,
    isResolved: false,
    vehicle
  };

  // 1. Broadcast Real-time Socket Event to Connected Company Clients
  try {
    const io = getIO();
    io.to(companyId).emit('new-alert', fullAlert);
    console.log(`[Alert Socket] Emitted real-time 'new-alert' (${type}) for vehicle ${vehicle.vehicleNumber} to room: ${companyId}`);
  } catch (e) {
    console.log(`[Alert Socket] Note: Socket server not active or ready yet.`);
  }

  // 2. Dispatch Automated Email Notification via SMTP (if valid credentials exist in .env)
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER && 
    process.env.SMTP_USER !== 'your_smtp_user' &&
    process.env.SMTP_PASS && 
    process.env.SMTP_PASS !== 'your_smtp_pass'
  ) {
    try {
      const userRes = await pool.query('SELECT email, name FROM "User" WHERE "companyId" = $1', [companyId]);
      console.log(`[Alert Email] Found ${userRes.rows.length} recipient(s) for company ${companyId}`);
      const subject = `🚨 [Fleet Alert: ${type}] Vehicle ${vehicle.vehicleNumber} Incident Notification`;
      const html = `
        <div style="font-family: Arial, sans-serif; padding: 25px; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #334155; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
          <div style="border-bottom: 2px solid #ef4444; padding-bottom: 15px; margin-bottom: 20px;">
            <h2 style="color: #ef4444; margin: 0; font-size: 22px; display: flex; align-items: center; gap: 8px;">
              🚨 Fleet Security & Incident Alert
            </h2>
          </div>
          <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6;">
            An automated safety alarm has been triggered in your live tracking portal for vehicle <b>${vehicle.vehicleNumber}</b>.
          </p>
          
          <div style="background-color: #1e293b; border-left: 5px solid #ef4444; padding: 18px; border-radius: 8px; margin: 20px 0;">
            <div style="margin-bottom: 12px;">
              <span style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: bold;">Vehicle Registration</span><br/>
              <span style="font-size: 16px; color: #60a5fa; font-weight: bold;">${vehicle.vehicleNumber}</span>
            </div>
            <div style="margin-bottom: 12px;">
              <span style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: bold;">Incident Type</span><br/>
              <span style="background: #ef4444; color: #fff; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: bold; display: inline-block; margin-top: 4px;">${type}</span>
            </div>
            <div>
              <span style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: bold;">Alert Details</span><br/>
              <span style="font-size: 14px; color: #f8fafc; font-weight: 500;">${message}</span>
            </div>
          </div>
          
          <p style="font-size: 13px; color: #94a3b8; line-height: 1.5;">
            Log into your live fleet monitoring console immediately to view real-time location, check driver status, or mark this incident resolved.
          </p>
          <hr style="border: none; border-top: 1px solid #334155; margin: 25px 0;" />
          <p style="font-size: 11px; color: #64748b; margin: 0; text-align: center;">
            Powered by AI Fleet Security & Live Telemetry Engine
          </p>
        </div>
      `;
      for (const u of userRes.rows) {
        if (u.email) {
          sendEmail(u.email, subject, html).catch(err => console.error(`[Alert Email] Failed to send email to ${u.email}:`, err.message));
        }
      }
    } catch (err: any) {
      console.error('[Alert Email] Error retrieving user email recipients:', err.message);
    }
  } else {
    console.log('[Alert Email] SMTP credentials not fully configured in .env (or using default placeholders). Email alert skipped.');
  }

  return fullAlert;
};

export const deleteAlert = async (alertId: string, companyId: string) => {
  const check = await pool.query(`
    SELECT a.id FROM "Alert" a
    JOIN "Vehicle" v ON a."vehicleId" = v.id
    WHERE a.id = $1 AND v."companyId" = $2
  `, [alertId, companyId]);

  if (check.rows.length === 0) {
    throw new Error('Alert not found');
  }
  await pool.query('DELETE FROM "Alert" WHERE id = $1', [alertId]);
  return { message: 'Alert deleted successfully' };
};

