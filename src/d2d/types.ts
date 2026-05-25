export type LeadStatus = 'interested' | 'not_home' | 'not_interested' | 'scheduled';
export type PricingTier = 'under2000' | '2001to3500';

export interface D2DLead {
  id: string;
  rep_name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  sqft: string; // 'under2000' | '2001to3500'
  tier: PricingTier;
  status: LeadStatus;
  contact_name: string;
  phone: string;
  notes: string;
  follow_up_date: string;
  created_at: string;
  rep_id?: string;
  assigned_tech_id?: string | null;
}

export const PRICING_TIERS: Record<PricingTier, { label: string; price: number; sqft: string }> = {
  under2000: { label: 'Standard Plan', price: 99, sqft: 'Under 2,000 sq ft' },
  '2001to3500': { label: 'Premium Plan', price: 129, sqft: '2,001–3,500 sq ft' },
};

export const STATUS_LABELS: Record<LeadStatus, string> = {
  interested: 'Interested',
  not_home: 'Not Home',
  not_interested: 'Not Interested',
  scheduled: 'Appointment Set',
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  interested: '#1D9E75',
  not_home: '#EF9F27',
  not_interested: '#EF4444',
  scheduled: '#3B82F6',
};
