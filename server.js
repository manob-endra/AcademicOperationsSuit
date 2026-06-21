import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sgMail from '@sendgrid/mail';
import courseRoutes from './src/backend/api/courseRoutes.js';
import authRoutes from './src/backend/api/authRoutes.js';
import emailRoutes from './src/backend/api/emailRoutes.js';
import classTimeSettingsRoutes from './src/backend/api/classTimeSettingsRoutes.js';
import classroomClustersRoutes from './src/backend/api/classroomClustersRoutes.js';
import courseTimeRoutes from './src/backend/api/courseTimeRoutes.js';
import teacherTimeRoutes from './src/backend/api/teacherTimeRoutes.js';
import semesterSelectionRoutes from './src/backend/api/semesterSelectionRoutes.js';
import roomAllocationRoutes from './src/backend/api/roomAllocationRoutes.js';
import courseTeacherRoutes from './src/backend/api/courseTeacherRoutes.js';
import teacherPrefRoutes from './src/backend/api/teacherPrefRoutes.js';
import routineRoutes from './src/backend/api/routineRoutes.js';
import noticeRoutes from './src/backend/api/noticeRoutes.js';
import notificationRoutes from './src/backend/api/notificationRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' });
});
app.get('/api/health', (req, res) => {
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

// Classroom Clusters API routes
app.use('/api/classroom-clusters', classroomClustersRoutes);

// Course Time (duration settings) API routes
app.use('/api/course-time', courseTimeRoutes);

// Teacher Time (availability settings) API routes
app.use('/api/teachers', teacherTimeRoutes);

// Semester selection API routes
app.use('/api/semester-selection', semesterSelectionRoutes);

// Room allocation API routes
app.use('/api/room-allocation', roomAllocationRoutes);

// Course teacher choices API routes
app.use('/api/course-teacher-choices', courseTeacherRoutes);

// Teacher course preferences API routes
app.use('/api/teacher-preferences', teacherPrefRoutes);

// Routine generation API routes
app.use('/api/routine', routineRoutes);

// Notices API routes
app.use('/api/notices', noticeRoutes);

// Notifications API routes (admin bell feed)
app.use('/api/notifications', notificationRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Email server running on http://localhost:${PORT}`);
  console.log(`📧 Using SendGrid for email delivery`);
  console.log('Ready to send emails!');
});
