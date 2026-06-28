import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Supabase Client Configuration
 * 
 * This file initializes the Supabase client with the environment variables
 * from your .env file. All backend services import from this file.
 * 
 * Environment Variables Required:
 * - VITE_SUPABASE_URL: Your Supabase project URL
 * - VITE_SUPABASE_ANON_KEY: Your Supabase anonymous public key
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

// Only use the service role key if it's set AND is a real JWT (not the placeholder example)
const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const isRealServiceKey = rawServiceKey.length > 100 && !rawServiceKey.includes('your-service-role-key');
const supabaseKey = isRealServiceKey ? rawServiceKey : anonKey;

if (!supabaseUrl || !supabaseKey) {
  console.error('⚠️ Missing Supabase credentials. Check your .env file!');
}

if (!isRealServiceKey) {
  console.warn('⚠️ Using anon key for backend DB access. If RLS is enabled on your tables, add SUPABASE_SERVICE_ROLE_KEY to .env (Supabase Dashboard → Project Settings → API → service_role)');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export const createAdminClient = () => createClient(supabaseUrl, supabaseKey);
