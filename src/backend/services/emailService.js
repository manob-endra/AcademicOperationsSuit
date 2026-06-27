import nodemailer from 'nodemailer';

const createTransporter = () =>
  nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

export const emailService = {
  async sendVerificationEmail(toEmail, toName, code) {
    // Dev fallback: if SMTP not configured, just print the code to server console
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log(`\n📧  [DEV EMAIL] Verification code for ${toEmail}: ${code}\n`);
      return { success: true, dev: true };
    }

    try {
      const transporter = createTransporter();
      const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER;
      const fromName  = process.env.FROM_NAME  || 'Academic Portal';

      await transporter.sendMail({
        from:    `"${fromName}" <${fromEmail}>`,
        to:      toEmail,
        subject: 'Verify Your Email — Academic Operation Suite',
        html: `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#f5f7fa;padding:40px 20px;">
  <div style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1);">
    <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2c5f8a 100%);padding:32px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:20px;font-weight:700;">Academic Operation Suite</h1>
      <p style="color:rgba(255,255,255,.72);margin:8px 0 0;font-size:13px;">Department of CSE, University of Dhaka</p>
    </div>
    <div style="padding:36px 32px;">
      <h2 style="color:#1a2a4a;margin:0 0 10px;font-size:20px;font-weight:700;">Verify your email address</h2>
      <p style="color:#6b7280;font-size:14px;line-height:1.65;margin:0 0 28px;">
        Hi ${toName || 'there'}, enter the 6-digit code below to complete your registration.<br>
        The code expires in <strong>15 minutes</strong>.
      </p>
      <div style="background:#f0f7ff;border:2px solid #bae6fd;border-radius:12px;padding:26px 20px;text-align:center;margin:0 0 28px;">
        <span style="font-size:42px;font-weight:800;letter-spacing:14px;color:#1e3a5f;font-family:monospace;">${code}</span>
      </div>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;line-height:1.5;">
        If you didn't sign up for Academic Operation Suite, you can safely ignore this email.
      </p>
    </div>
  </div>
</div>
        `,
      });

      return { success: true };
    } catch (err) {
      console.error('Email send error:', err.message);
      return { success: false, error: err.message };
    }
  },
};
