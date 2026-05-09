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
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('⚠️ Missing Supabase credentials. Check your .env file!');
  console.error('Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Optional: Create an admin client for server-side operations (if using Supabase Functions)
export const createAdminClient = () => {
  const adminKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
  if (!adminKey) {
    console.warn('Service key not available. Use this only in secure backend environments.');
  }
  return createClient(supabaseUrl, adminKey);
};
