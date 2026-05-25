-- ==============================================================================
-- RESTORE ORIGINAL 10 CHECKLIST ITEMS
-- ==============================================================================

-- Clear the existing template items
DELETE FROM public.inspection_templates;

-- Insert the original 10 items in the correct order
INSERT INTO public.inspection_templates (order_index, question_text) VALUES 
(0, 'HVAC Air Filter Inspection & Replacement'),
(1, 'Visual Plumbing Inspection'),
(2, 'Faucet & Fixture Performance Check'),
(3, 'Light Switch & Receptacle Safety Check'),
(4, 'Smoke & Carbon Monoxide Detector Status Check'),
(5, 'Door & Window Operation Check'),
(6, 'Garage Door Seal & Functionality Check'),
(7, 'Exterior Visual Walk-Around'),
(8, 'Weather Seal Inspection'),
(9, '+ One Rotating Seasonal Preventative Task');
