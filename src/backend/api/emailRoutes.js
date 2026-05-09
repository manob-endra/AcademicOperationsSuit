import express from 'express';
import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * POST /api/email/send
 * Send a custom email
 */
router.post('/send', async (req, res) => {
  try {
    const { to, subject, htmlBody } = req.body;

    // Validate required fields
    if (!to || !subject || !htmlBody) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, subject, htmlBody' 
      });
    }

    // Validate SendGrid API key is configured
    if (!process.env.SENDGRID_API_KEY) {
      return res.status(500).json({ 
        error: 'SendGrid API key not configured in .env file' 
      });
    }

    const msg = {
      to: to,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@academicportal.com',
      subject: subject,
      html: htmlBody
    };

    // Send email via SendGrid
    const result = await sgMail.send(msg);

    console.log('✅ Email sent successfully via SendGrid!');
    console.log(`📧 To: ${to}`);
    console.log(`📨 Message ID: ${result[0].headers['x-message-id']}`);

    res.json({ 
      success: true, 
      message: 'Email sent successfully',
      messageId: result[0].headers['x-message-id']
    });
  } catch (error) {
    console.error('❌ SendGrid Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to send email',
      details: error.message 
    });
  }
});

/**
 * POST /api/email/send-verification
 * Send a verification email
 */
router.post('/send-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // TODO: Generate verification code and send email
    // This would:
    // 1. Generate a random 6-digit code
    // 2. Store it temporarily (in cache or database)
    // 3. Send email with the code
    // 4. Return success

    res.json({ 
      success: true, 
      message: 'Verification email sent',
      note: 'TODO: Implement verification code generation and storage'
    });
  } catch (error) {
    console.error('Send verification email error:', error);
    res.status(500).json({ 
      error: 'Failed to send verification email'
    });
  }
});

export default router;
