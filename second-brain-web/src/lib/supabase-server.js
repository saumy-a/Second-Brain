import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client using the secret/service role key
// This bypasses Row Level Security — use only in server-side code (API routes, Server Components)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

export const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);
