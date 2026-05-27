import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const queries = {
    inspections: supabase.from('inspections').select('*, customer:customers(full_name, email, phone), property:properties(address)').order('created_at', { ascending: false }),
    leads: supabase.from('d2d_leads').select('*').order('created_at', { ascending: false }),
    profiles: supabase.from('profiles').select('*').order('created_at', { ascending: true }),
    templates: supabase.from('inspection_templates').select('*').order('order_index', { ascending: true }),
    touchpoints: supabase.from('client_touchpoints').select('*, customer:customers(full_name, email, phone)').order('scheduled_for', { ascending: true }),
    notes: supabase.from('client_notes').select('*, property:properties(address)').order('created_at', { ascending: false }),
    comms: supabase.from('communication_logs').select('*').order('created_at', { ascending: false }),
    zones: supabase.from('territory_zones').select('*').order('created_at', { ascending: true }),
    tickets: supabase.from('service_tickets').select('*').order('created_at', { ascending: false }),
    agreements: supabase.from('service_agreements').select('*'),
    properties: supabase.from('properties').select('*'),
    customers: supabase.from('customers').select('*'),
    time: supabase.from('time_entries').select('*').order('created_at', { ascending: false }),
    audit: supabase.from('audit_logs').select('*').eq('table_name', 'time_entries').order('timestamp', { ascending: false })
  };

  for (const [name, query] of Object.entries(queries)) {
    const { error } = await query;
    if (error) {
      console.error(`ERROR IN ${name}:`, error.message);
    } else {
      console.log(`SUCCESS: ${name}`);
    }
  }
}

test();
