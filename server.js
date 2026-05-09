import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sgMail from '@sendgrid/mail';
import courseRoutes from './src/backend/api/courseRoutes.js';
import authRoutes from './src/backend/api/authRoutes.js';
import emailRoutes from './src/backend/api/emailRoutes.js';
import classTimeSettingsRoutes from './src/backend/api/classTimeSettingsRoutes.js';

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

// Course API routes
app.use('/api/courses', courseRoutes);

// Auth API routes
app.use('/api/auth', authRoutes);

// Email API routes
app.use('/api/email', emailRoutes);

// Class Time Settings API routes
app.use('/api/class-time-settings', classTimeSettingsRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Email server running on http://localhost:${PORT}`);
  console.log(`📧 Using SendGrid for email delivery`);
  console.log('Ready to send emails!');
});
