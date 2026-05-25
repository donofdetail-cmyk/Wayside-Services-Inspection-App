import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://trbschedomzvdvnrgeab.supabase.co') as string;
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_oUZyXn82AJSKKLjc4UW_ag_HStSODuo') as string;

export const supabase = createClient(supabaseUrl, supabaseKey);
