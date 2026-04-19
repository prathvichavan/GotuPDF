import nodemailer from 'nodemailer';
import { CONTACT_EMAIL, SITE_NAME } from './constants';

// Lazy initialization of transporter
let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (!transporter) {
    // Log configuration (without password) for debugging
    console.log('Initializing Email Transporter with:', {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER || CONTACT_EMAIL,
    });

    transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || CONTACT_EMAIL,
        pass: process.env.SMTP_PASSWORD || '',
      },
    });
  }
  return transporter;
};

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const t = getTransporter();

    // Skip email if no SMTP password configured (development mode)
    if (!process.env.SMTP_PASSWORD) {
      console.log('⚠️ Email not sent (SMTP not configured):', options.subject);
      return true;
    }

    await t.sendMail({
      from: `"${SITE_NAME}" <${process.env.SMTP_USER || CONTACT_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    console.log('✅ Email sent successfully to:', options.to);
    return true;
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    return false;
  }
}

export async function sendContactNotification(data: {
  name: string;
  email: string;
  subject: string;
  message: string;
  ip_address?: string;
}): Promise<boolean> {
  // ... (Template simplified for brevity, logic remains same)
  const html = `<h2>New Message from ${data.name}</h2><p>${data.message}</p>`;

  return sendEmail({
    to: CONTACT_EMAIL,
    subject: `[${SITE_NAME}] New Contact: ${data.subject}`,
    html,
    text: `New contact from ${data.name}: ${data.message}`,
  });
}

export async function sendConfirmationEmail(data: {
  name: string;
  email: string;
  subject: string;
}): Promise<boolean> {
  const html = `<h2>Hi ${data.name}</h2><p>We received your message: ${data.subject}.</p>`;
  return sendEmail({
    to: data.email,
    subject: `Thank you for contacting ${SITE_NAME}`,
    html,
    text: `Hi ${data.name}, we received your message.`,
  });
}
