import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sgMail from '@sendgrid/mail';

dotenv.config();

const app = express();
const PORT = 3001;

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Send verification email
app.post('/api/send-email', async (req, res) => {
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
      message: 'Email sent successfully via SendGrid',
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

app.listen(PORT, () => {
  console.log(`🚀 Email server running on http://localhost:${PORT}`);
  console.log(`📧 Using SendGrid for email delivery`);
  console.log('Ready to send emails!');
});
