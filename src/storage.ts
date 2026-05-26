import { get, set, del } from 'idb-keyval';
import { InspectionDraft, CompletedInspection, ClientData, ChecklistItemData, InspectionReport, DEFAULT_CHECKLIST_ITEMS } from './types';
import { supabase } from './d2d/supabaseClient';

import { encryptData, decryptData } from './encryption';

const DRAFT_KEY = 'wayside_draft_enc';
const HISTORY_KEY = 'wayside_history';
const TEMPLATE_KEY = 'wayside_template';
const OFFLINE_INSPECTIONS_KEY = 'wayside_offline_inspections_enc';

// ─── Draft ────────────────────────────────────────────────────────────────────

export async function saveDraft(draft: InspectionDraft): Promise<void> {
  try {
    const encrypted = await encryptData(draft);
    await set(DRAFT_KEY, encrypted);
  } catch (e) {
    console.error('Failed to save draft', e);
  }
}

export async function loadDraft(): Promise<InspectionDraft | null> {
  try {
    const encrypted = await get<string>(DRAFT_KEY);
    if (!encrypted) return null;
    return await decryptData(encrypted);
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await del(DRAFT_KEY);
  } catch (e) {
    console.error('Failed to clear draft', e);
  }
}

// ─── History ──────────────────────────────────────────────────────────────────

export async function loadHistory(): Promise<CompletedInspection[]> {
  try {
    const history = await get<CompletedInspection[]>(HISTORY_KEY);
    return history || [];
  } catch {
    return [];
  }
}

export async function saveCompletedInspection(
  report: InspectionReport,
  durationSeconds: number,
  technicianId: string,
  pdfBlob?: Blob
): Promise<CompletedInspection> {
  const record: CompletedInspection = {
    id: crypto.randomUUID(),
    clientInfo: report.clientInfo,
    checklist: report.checklist,
    completedAt: new Date().toISOString(),
    durationSeconds,
  };

  const existing = await loadHistory();
  existing.unshift(record); // newest first
  try {
    await set(HISTORY_KEY, existing);
  } catch (e) {
    console.error('Failed to save history', e);
  }

  // Attempt Supabase Sync
  if (technicianId) {
    let pdfUrl = null;

    // Upload PDF to Supabase Storage if provided
    if (pdfBlob) {
      const fileName = `${record.id}.pdf`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('reports')
        .upload(fileName, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        });
      
      if (!uploadError && uploadData) {
        // We only store the filename; Signed URLs are generated on the fly at read-time
        pdfUrl = fileName;
      } else {
        console.error('Failed to upload PDF:', uploadError);
      }
    }

    let customerId = null;
    if (record.clientInfo.clientEmail) {
      const { data: existingCustomer } = await supabase.from('customers')
        .select('id').eq('email', record.clientInfo.clientEmail).maybeSingle();
      if (existingCustomer) customerId = existingCustomer.id;
    }
    if (!customerId) {
      const { data: newCustomer, error: custErr } = await supabase.from('customers').insert([{
        full_name: record.clientInfo.clientName,
        email: record.clientInfo.clientEmail || null,
        phone: (record.clientInfo as any).clientPhone || null,
        agreed_to_tos: record.clientInfo.agreedToTos || false,
        tos_agreed_at: record.clientInfo.agreedToTos ? new Date().toISOString() : null,
        sms_consent_granted: record.clientInfo.smsConsentGranted || false,
        sms_consent_at: record.clientInfo.smsConsentGranted ? new Date().toISOString() : null,
        opted_out_of_sale: record.clientInfo.optedOutOfSale || false
      }]).select('id').single();
      if (newCustomer) customerId = newCustomer.id;
      else console.error('Failed to create customer', custErr);
    }

    let propertyId = null;
    const { data: existingProp } = await supabase.from('properties')
      .select('id').eq('address', record.clientInfo.propertyAddress).maybeSingle();
    if (existingProp) propertyId = existingProp.id;
    else {
      const { data: newProp } = await supabase.from('properties').insert([{
        address: record.clientInfo.propertyAddress
      }]).select('id').single();
      if (newProp) propertyId = newProp.id;
    }

    const supabaseRecord = {
      id: record.id,
      technician_id: technicianId,
      customer_id: customerId,
      property_id: propertyId,
      checklist_data: record.checklist as any,
      created_at: record.completedAt,
      pdf_url: pdfUrl,
      duration_seconds: durationSeconds
    };

    const { error } = await supabase.from('inspections').insert([supabaseRecord]);
    
    if (!error) {
      const sixMonths = new Date();
      sixMonths.setMonth(sixMonths.getMonth() + 6);
      if (customerId) {
        await supabase.from('client_touchpoints').insert([{
          client_id: customerId,
          type: '6_month_seasonal',
          scheduled_for: sixMonths.toISOString()
        }]);
      }
    } else {
      console.error('Supabase sync failed, queuing offline:', error);
      const encryptedStr = await get<string>(OFFLINE_INSPECTIONS_KEY);
      const queue = encryptedStr ? (await decryptData(encryptedStr) || []) : [];
      queue.push(supabaseRecord);
      await set(OFFLINE_INSPECTIONS_KEY, await encryptData(queue));
    }
  }

  return record;
}

export async function syncOfflineInspections(): Promise<void> {
  const encryptedStr = await get<string>(OFFLINE_INSPECTIONS_KEY);
  if (!encryptedStr) return;
  const queue = await decryptData(encryptedStr) || [];
  if (queue.length === 0) return;
  
  const remaining = [];
  for (const record of queue) {
    const { error } = await supabase.from('inspections').insert([record]);
    if (error) {
      console.error('Failed to sync offline record:', record.id, error);
      remaining.push(record);
    } else {
      // Create the touchpoint upon successful sync
      const sixMonths = new Date();
      sixMonths.setMonth(sixMonths.getMonth() + 6);
      if (record.customer_id) {
        await supabase.from('client_touchpoints').insert([{
          client_id: record.customer_id,
          type: '6_month_seasonal',
          scheduled_for: sixMonths.toISOString()
        }]);
      }
    }
  }
  await set(OFFLINE_INSPECTIONS_KEY, await encryptData(remaining));
}

export async function deleteHistoryRecord(id: string): Promise<void> {
  const updated = (await loadHistory()).filter((r) => r.id !== id);
  try {
    await set(HISTORY_KEY, updated);
  } catch (e) {
    console.error('Failed to delete history record', e);
  }
}

// ─── Template ─────────────────────────────────────────────────────────────────

export async function loadTemplate(): Promise<string[]> {
  try {
    const { data, error } = await supabase.from('inspection_templates').select('question_text').order('order_index', { ascending: true });
    if (!error && data && data.length > 0) {
      const template = data.map(d => d.question_text);
      await set(TEMPLATE_KEY, template); // cache it for offline
      return template;
    }
  } catch (e) {
    console.error('Failed to fetch templates from Supabase', e);
  }

  // Fallback to offline cache
  try {
    const template = await get<string[]>(TEMPLATE_KEY);
    return template && template.length > 0 ? template : DEFAULT_CHECKLIST_ITEMS;
  } catch {
    return DEFAULT_CHECKLIST_ITEMS;
  }
}

export async function saveTemplate(template: string[]): Promise<void> {
  // Admin controls templates globally now. This prevents technicians from overwriting local templates.
  console.warn('Template saving is now restricted to the Admin Portal.');
}
