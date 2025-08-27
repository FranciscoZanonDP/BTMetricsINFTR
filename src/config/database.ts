import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Primary database configuration
const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos en las variables de entorno');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Second database configuration (optional)
const supabaseUrl2 = process.env['SUPABASE_URL_2'];
const supabaseServiceKey2 = process.env['SUPABASE_SERVICE_ROLE_KEY_2'];

export const supabase2 = supabaseUrl2 && supabaseServiceKey2 
  ? createClient(supabaseUrl2, supabaseServiceKey2, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

export default supabase; 