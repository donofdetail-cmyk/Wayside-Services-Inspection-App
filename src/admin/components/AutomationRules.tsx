import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface AutomationRule {
  id: string;
  event: string;
  action: string;
  isActive: boolean;
}

const DEFAULT_RULES: AutomationRule[] = [
  { id: '1', event: 'inspection_completed', action: 'send_web_report_sms', isActive: true },
  { id: '2', event: 'inspection_completed', action: 'send_web_report_email', isActive: false },
];

export function AutomationRules() {
  const [rules, setRules] = useState<AutomationRule[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('wayside_automation_rules');
    if (saved) {
      setRules(JSON.parse(saved));
    } else {
      setRules(DEFAULT_RULES);
      localStorage.setItem('wayside_automation_rules', JSON.stringify(DEFAULT_RULES));
    }
  }, []);

  const saveRules = (newRules: AutomationRule[]) => {
    setRules(newRules);
    localStorage.setItem('wayside_automation_rules', JSON.stringify(newRules));
  };

  const addRule = () => {
    const newRule: AutomationRule = {
      id: crypto.randomUUID(),
      event: 'inspection_completed',
      action: 'send_web_report_sms',
      isActive: true
    };
    saveRules([...rules, newRule]);
  };

  const deleteRule = (id: string) => {
    saveRules(rules.filter(r => r.id !== id));
  };

  const updateRule = (id: string, field: keyof AutomationRule, value: any) => {
    saveRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-porch" /> IFTTT Automation Rules
          </h3>
          <p className="text-sm text-deep-forest/60 mt-1">Configure automatic actions triggered by system events.</p>
        </div>
        <Button onClick={addRule} className="bg-deep-forest text-white hover:bg-deep-forest/90 font-bold rounded-xl flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Rule
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {rules.map((rule, idx) => (
          <div key={rule.id} className="flex flex-col sm:flex-row sm:items-center gap-4 bg-linen-white/30 p-4 rounded-xl border border-deep-forest/10">
            
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase font-black tracking-widest text-deep-forest/40">IF</span>
              <select 
                value={rule.event} 
                onChange={(e) => updateRule(rule.id, 'event', e.target.value)}
                className="bg-white border border-deep-forest/10 rounded-lg px-3 py-2 text-sm font-bold text-deep-forest focus:outline-none focus:ring-2 focus:ring-pathway-green/20"
              >
                <option value="inspection_completed">Inspection Completed</option>
                <option value="contract_signed">Contract Signed</option>
              </select>
            </div>

            <div className="hidden sm:block text-deep-forest/20 font-black">➔</div>

            <div className="flex items-center gap-3 flex-1">
              <span className="text-[10px] uppercase font-black tracking-widest text-deep-forest/40">THEN</span>
              <select 
                value={rule.action} 
                onChange={(e) => updateRule(rule.id, 'action', e.target.value)}
                className="bg-white border border-deep-forest/10 rounded-lg px-3 py-2 text-sm font-bold text-deep-forest focus:outline-none focus:ring-2 focus:ring-pathway-green/20 w-full"
              >
                <option value="send_web_report_sms">Send Web Report via SMS</option>
                <option value="send_web_report_email">Send Web Report via Email</option>
                <option value="notify_admin">Notify Admin</option>
              </select>
            </div>

            <div className="flex items-center gap-4 shrink-0 mt-2 sm:mt-0">
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="relative">
                  <input type="checkbox" checked={rule.isActive} onChange={(e) => updateRule(rule.id, 'isActive', e.target.checked)} className="peer sr-only" />
                  <div className="w-10 h-6 bg-deep-forest/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pathway-green"></div>
                </div>
                <span className="text-xs font-bold text-deep-forest/60 uppercase">{rule.isActive ? 'On' : 'Off'}</span>
              </label>

              <button onClick={() => deleteRule(rule.id)} className="text-deep-forest/30 hover:text-red-500 transition-colors p-2">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {rules.length === 0 && (
          <div className="p-8 text-center bg-deep-forest/5 rounded-xl border border-dashed border-deep-forest/20">
            <p className="text-sm font-bold text-deep-forest/60">No automation rules configured.</p>
          </div>
        )}
      </div>
    </div>
  );
}
