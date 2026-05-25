export const DEFAULT_CHECKLIST_ITEMS = [
  "HVAC Air Filter Inspection & Replacement",
  "Visual Plumbing Inspection",
  "Faucet & Fixture Performance Check",
  "Light Switch & Receptacle Safety Check",
  "Smoke & Carbon Monoxide Detector Status Check",
  "Door & Window Operation Check",
  "Garage Door Seal & Functionality Check",
  "Exterior Visual Walk-Around",
  "Weather Seal Inspection",
  "+ One Rotating Seasonal Preventative Task"
];

export type InspectionStatus = 'Pass' | 'Needs Attention' | 'Fail' | '';

export interface Room {
  name: string;
  notes: string;
}

export interface ChecklistItemData {
  status: InspectionStatus;
  notes: string;
  photoUrls?: string[]; // base64 array — stays in memory, never downloaded
  rooms?: Room[]; // per-room breakdown
  seasonalTaskName?: string; // Only used for the 10th item
}

export interface ClientData {
  clientName: string;
  clientEmail: string;
  propertyAddress: string;
  date: string;
  technicianName: string;
  technicianId?: string;
}

export interface InspectionReport {
  clientInfo: ClientData;
  checklist: Record<number, ChecklistItemData>;
  clientSignature?: string; // base64 image
  technicianSignature?: string; // base64 image
}

// In-progress inspection auto-saved to localStorage
export interface InspectionDraft {
  id: string;
  clientInfo: ClientData;
  checklistData: Record<number, ChecklistItemData>;
  clientSignature?: string;
  technicianSignature?: string;
  startedAt: string;       // ISO timestamp
  lastSavedAt: string;     // ISO timestamp
  elapsedSeconds: number;  // accumulated stopwatch time
}

// Completed inspection stored in history
export interface CompletedInspection {
  id: string;
  clientInfo: ClientData;
  checklist: Record<number, ChecklistItemData>;
  completedAt: string;     // ISO timestamp
  durationSeconds: number; // total time on-site
}

// --- D2D Route Optimization OS Types ---

export interface TerritoryZone {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  created_at: string;
}

export interface Property {
  id: string;
  address: string;
  lat?: number;
  lng?: number;
  territory_zone_id?: string;
  created_at: string;
}

export interface ServiceAgreement {
  id: string;
  property_id: string;
  customer_id: string;
  originated_by_rep_id?: string;
  recurring_price: number;
  frequency: string;
  status: 'active' | 'paused' | 'cancelled';
  created_at: string;
}

export interface ServiceTicket {
  id: string;
  agreement_id: string;
  scheduled_start?: string;
  scheduled_end?: string;
  completed_at?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assigned_tech_id?: string;
  type: 'initial' | 'recurring' | 'seasonal' | 'repair';
  notes?: string;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  clock_in_time: string;
  clock_out_time?: string;
  duration_minutes?: number;
  location_in?: string;
  location_out?: string;
  status: 'clocked_in' | 'clocked_out';
  created_at: string;
}
