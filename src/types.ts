export const CHECKLIST_ITEMS = [
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
}

export interface InspectionReport {
  clientInfo: ClientData;
  checklist: Record<number, ChecklistItemData>;
}
