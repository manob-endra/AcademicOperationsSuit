/**
 * Example API Routes Structure
 * 
 * This file shows how to structure API routes using Express.js or Supabase Functions
 * Copy patterns from here to create actual route files in the api/ directory
 * 
 * Options:
 * 1. Use Supabase Functions (easier, no separate backend server needed)
 * 2. Use Express.js (more control, scalable)
 */

// ============================================
// OPTION 1: SUPABASE FUNCTIONS (RECOMMENDED)
// ============================================

/**
 * File: src/backend/api/auth.js
 * Deploy as Supabase Function
 * 
 * Usage from frontend:
 * const { data, error } = await supabase.functions.invoke('auth', {
 *   body: { action: 'signup', email, password, fullName }
 * })
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { authService } from '../services/authService.js';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'signup':
        const signupResult = await authService.signUp(
          body.email,
          body.password,
          body.fullName,
          body.department
        );
        return new Response(
          JSON.stringify(signupResult),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'signin':
        const signinResult = await authService.signIn(body.email, body.password);
        return new Response(
          JSON.stringify(signinResult),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'resetPassword':
        const resetResult = await authService.resetPassword(body.email);
        return new Response(
          JSON.stringify(resetResult),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ============================================
// OPTION 2: EXPRESS.JS BACKEND
// ============================================

/**
 * File: backend/server.js
 * Run: npm install express cors dotenv
 * Start: npm start or nodemon server.js
 */

/*
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import teacherRoutes from './routes/teachers.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/teachers', teacherRoutes);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

*/

// ============================================
// ROUTE EXAMPLES
// ============================================

/**
 * Authentication Routes
 * Path: src/backend/api/auth.js
 * 
 * POST /api/auth/signup
 * POST /api/auth/signin
 * POST /api/auth/logout
 * POST /api/auth/refresh-token
 * POST /api/auth/reset-password
 * PUT /api/auth/profile
 */

/*
import express from 'express';
import { authService } from '../services/authService.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, fullName, department } = req.body;
    const result = await authService.signUp(email, password, fullName, department);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/signin', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.signIn(email, password);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.resetPassword(email);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Protected routes
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await authService.updateProfile(userId, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
*/

/**
 * Course Routes
 * Path: src/backend/api/courses.js
 * 
 * GET /api/courses
 * GET /api/courses/:id
 * POST /api/courses
 * PUT /api/courses/:id
 * DELETE /api/courses/:id
 * POST /api/courses/:id/assign-teacher
 */

/*
import express from 'express';
import { courseService } from '../services/courseService.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', async (req, res, next) => {
  try {
    const { semester } = req.query;
    const courses = await courseService.getCourses(semester);
    res.json(courses);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const course = await courseService.getCourseById(req.params.id);
    res.json(course);
  } catch (error) {
    next(error);
  }
});

// Protected routes - admin only
router.post('/', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const result = await courseService.createCourse(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const result = await courseService.updateCourse(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const result = await courseService.deleteCourse(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/assign-teacher', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const result = await courseService.assignTeacher(req.params.id, req.body.teacherId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
*/

/**
 * Teacher Routes
 * Path: src/backend/api/teachers.js
 * 
 * GET /api/teachers
 * GET /api/teachers/:id
 * POST /api/teachers
 * PUT /api/teachers/:id
 * DELETE /api/teachers/:id
 * POST /api/teachers/:id/preferences
 * GET /api/teachers/:id/load
 */

/*
import express from 'express';
import { teacherService } from '../services/teacherService.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', async (req, res, next) => {
  try {
    const teachers = await teacherService.getTeachers();
    res.json(teachers);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const teacher = await teacherService.getTeacherById(req.params.id);
    res.json(teacher);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/load', async (req, res, next) => {
  try {
    const load = await teacherService.getTeacherLoad(req.params.id);
    res.json(load);
  } catch (error) {
    next(error);
  }
});

// Protected routes - admin only
router.post('/', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const result = await teacherService.createTeacher(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const result = await teacherService.updateTeacher(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const result = await teacherService.deleteTeacher(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/preferences', authenticate, async (req, res, next) => {
  try {
    const result = await teacherService.setPreferences(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
*/

// ============================================
// MIDDLEWARE EXAMPLES
// ============================================

/**
 * Authentication Middleware
 * File: src/backend/middleware/auth.js
 */

/*
import jwt from 'jsonwebtoken';

export const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const authorize = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
*/

/**
 * Error Handling Middleware
 * File: src/backend/middleware/errorHandler.js
 */

/*
export const errorHandler = (error, req, res, next) => {
  console.error('Error:', error);

  const status = error.status || 500;
  const message = error.message || 'Internal server error';

  res.status(status).json({
    error: message,
    timestamp: new Date().toISOString(),
    path: req.path
  });
};
*/

// ============================================
// FRONTEND USAGE EXAMPLES
// ============================================

/**
 * Using Supabase Functions from Frontend
 * 
 * In your React components:
 */

/*
import { supabase } from '@/backend';

// Example 1: Sign up
async function handleSignUp(email, password, fullName) {
  try {
    const { data, error } = await supabase.functions.invoke('auth', {
      body: {
        action: 'signup',
        email,
        password,
        fullName,
        department: 'Computer Science'
      }
    });

    if (error) throw error;
    console.log('User created:', data);
  } catch (error) {
    console.error('Signup failed:', error);
  }
}

// Example 2: Using Express backend
async function handleGetCourses() {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/courses`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const courses = await response.json();
    console.log('Courses:', courses);
  } catch (error) {
    console.error('Failed to fetch courses:', error);
  }
}
*/

export const apiRouteExamples = {
  message: 'See comments above for route examples'
};
