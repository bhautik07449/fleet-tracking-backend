import prisma from '../prisma';
import { sendEmail } from '../utils/mailer';

export const sendCriticalAlertEmail = async (companyId: string, alertData: any) => {
  try {
    // 1. Get the company owner email (or whoever handles alerts for the company)
    const owner = await prisma.user.findFirst({
      where: { companyId, role: 'COMPANY_OWNER', isActive: true },
    });

    if (!owner) {
      console.warn(`[Notification Service] No active COMPANY_OWNER found for company ${companyId}`);
      return;
    }

    // 2. Prepare the email content
    const subject = `CRITICAL ALERT: ${alertData.type} - Vehicle ${alertData.vehicleNumber || alertData.vehicleId}`;
    const html = `
      <h3>Critical Fleet Alert</h3>
      <p><strong>Alert Type:</strong> ${alertData.type}</p>
      <p><strong>Vehicle ID:</strong> ${alertData.vehicleId}</p>
      <p><strong>Message:</strong> ${alertData.message}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      <br />
      <p>Please log in to the Fleet Management Dashboard to resolve this alert.</p>
    `;

    // 3. Send email
    await sendEmail(owner.email, subject, html);
    
    console.log(`[Notification Service] Critical alert email sent to ${owner.email}`);
  } catch (error) {
    console.error('[Notification Service] Failed to send alert email:', error);
  }
};
