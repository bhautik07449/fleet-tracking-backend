import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const info = await transporter.sendMail({
      from: `"Fleet Tracker" <${process.env.SMTP_FROM || 'no-reply@fleettracker.com'}>`,
      to,
      subject,
      html,
    });
    console.log(`[Mailer] Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`[Mailer] Error sending email to ${to}:`, error);
    throw error;
  }
};
