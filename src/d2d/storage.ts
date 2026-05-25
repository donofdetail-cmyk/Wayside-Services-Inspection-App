import { supabase } from './supabaseClient';
import { D2DLead } from './types';
import { get, set } from 'idb-keyval';

const LOCAL_LEADS_KEY = 'd2d_leads_cache';

// ─── Supabase ─────────────────────────────────────────────────────────────────

export async function saveLeadToSupabase(lead: Omit<D2DLead, 'id' | 'created_at'>): Promise<D2DLead | null> {
  const { data, error } = await supabase
    .from('d2d_leads')
    .insert([lead])
    .select()
    .single();

  if (error) {
    console.error('Supabase insert error:', error);
    return null;
  }
  return data as D2DLead;
}

export async function updateLeadInSupabase(id: string, updates: Partial<D2DLead>): Promise<void> {
  const { error } = await supabase
    .from('d2d_leads')
    .update(updates)
    .eq('id', id);
  if (error) console.error('Supabase update error:', error);
}

export async function loadTodaysLeads(repName: string): Promise<D2DLead[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('d2d_leads')
    .select('*')
    .eq('rep_name', repName)
    .gte('created_at', `${today}T00:00:00.000Z`)
    .lte('created_at', `${today}T23:59:59.999Z`)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Supabase fetch error:', error);
    // Fall back to local cache
    return loadLocalLeads();
  }
  const leads = (data as D2DLead[]) || [];
  await cacheLeadsLocally(leads);
  return leads;
}

// ─── Local IndexedDB cache ────────────────────────────────────────────────────

export async function cacheLeadsLocally(leads: D2DLead[]): Promise<void> {
  try {
    await set(LOCAL_LEADS_KEY, leads);
  } catch (e) {
    console.error('Local cache error', e);
  }
}

export async function loadLocalLeads(): Promise<D2DLead[]> {
  try {
    return (await get<D2DLead[]>(LOCAL_LEADS_KEY)) || [];
  } catch {
    return [];
  }
}
