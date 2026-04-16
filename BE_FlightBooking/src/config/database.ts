import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL environment variable');
if (!supabaseKey) throw new Error('Missing SUPABASE_SECRET_KEY or SUPABASE_PUBLISHABLE_KEY environment variable');

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

export default supabase;
