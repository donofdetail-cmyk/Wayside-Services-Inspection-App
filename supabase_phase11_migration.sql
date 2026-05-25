-- ==============================================================================
-- WAYSIDE PHASE 11: ENTERPRISE CRM CAPABILITIES
-- ==============================================================================

-- 1. Client Notes Table
CREATE TABLE IF NOT EXISTS public.client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_address TEXT NOT NULL,
  content TEXT NOT NULL,
  author_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Communication Logs Table (Omnichannel Mock)
CREATE TABLE IF NOT EXISTS public.communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_address TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sms', 'email', 'call')),
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Automation Rules Engine
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL, -- e.g. 'lead_status_changed', 'inspection_completed'
  trigger_condition TEXT, -- e.g. 'not_home', 'null'
  action_type TEXT NOT NULL CHECK (action_type IN ('queue_touchpoint', 'send_sms', 'send_email')),
  delay_days INTEGER NOT NULL DEFAULT 0,
  template_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Setup RLS
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to client_notes" ON public.client_notes FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access to communication_logs" ON public.communication_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access to automation_rules" ON public.automation_rules FOR ALL TO authenticated USING (true);

-- Insert Default Automation Rules (Migrating our hardcoded logic to DB rules)
INSERT INTO public.automation_rules (name, trigger_event, trigger_condition, action_type, delay_days, template_text)
VALUES
  ('30-Day D2D Nurture', 'lead_status_changed', 'not_interested', 'queue_touchpoint', 30, '30_day_nurture'),
  ('6-Month Seasonal Follow-up', 'inspection_completed', 'all', 'queue_touchpoint', 180, '6_month_seasonal')
ON CONFLICT DO NOTHING;
