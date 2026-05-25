CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO public.message_templates (name, type, content) VALUES
('D2D "Not Home" Follow-up', 'sms', 'Hi {{name}}, sorry we missed you! We are doing free roof inspections in {{neighborhood}} this week. Reply YES to book a slot.'),
('Post-Inspection Review', 'email', 'Hi {{name}}, thanks for choosing Wayside Services! Could you take 30 seconds to leave us a review?'),
('6-Month Seasonal Nurture', 'email', 'Hi {{name}}, the seasons are changing! It’s a great time for a quick maintenance check on your property at {{address}}.');
