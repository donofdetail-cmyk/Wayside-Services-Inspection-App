export const CHECKLIST_ITEMS = [
  "HVAC air filter inspection & replacement",
  "Visual plumbing inspection",
  "Faucet & fixture performance check",
  "Light switch & receptacle safety check",
  "Smoke & carbon monoxide detector status check",
  "Door & window operation check",
  "Garage door seal & functionality check",
  "Exterior visual walk-around",
  "Weather seal inspection",
  "+ One rotating seasonal preventative task"
];

export type InspectionStatus = 'Pass' | 'Needs Attention' | 'Fail' | '';

export interface ChecklistItemData {
  status: InspectionStatus;
  notes: string;
  photoUrl?: string; // base64
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
