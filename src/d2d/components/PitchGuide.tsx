import { useState } from 'react';
import { ChevronDown, ChevronUp, Home } from 'lucide-react';

const PLANS = [
  {
    tier: 'Standard',
    price: '$99/mo',
    sqft: 'Homes under 2,000 sq ft',
    accent: 'pathway-green' as const,
    bg: 'bg-pathway-green/5',
    border: 'border-pathway-green/20',
    textColor: 'text-pathway-green',
    features: [
      'HVAC Air Filter Inspection & Replacement',
      'Visual Plumbing Inspection',
      'Faucet & Fixture Performance Check',
      'Light Switch & Receptacle Safety Check',
      'Smoke & CO Detector Status Check',
      'Door & Window Operation Check',
      'Garage Door Seal & Functionality',
      'Exterior Visual Walk-Around',
      'Weather Seal Inspection',
      '+ 1 Rotating Seasonal Preventative Task',
    ],
  },
  {
    tier: 'Premium',
    price: '$129/mo',
    sqft: 'Homes 2,001–3,500 sq ft',
    accent: 'amber-porch' as const,
    bg: 'bg-amber-porch/5',
    border: 'border-amber-porch/20',
    textColor: 'text-amber-porch',
    features: [
      'Everything in Standard Plan',
      'Extended HVAC duct inspection',
      'Full plumbing pressure check',
      'Electrical panel visual review',
      'Crawl space / attic visual check',
      'Exterior drainage & grading review',
      'Roof & gutter visual inspection',
      'Window seal integrity test',
      'Smart device battery check',
      '+ 2 Rotating Seasonal Preventative Tasks',
    ],
  },
];

const OBJECTIONS = [
  {
    q: '"That\'s too expensive."',
    a: 'Most homeowners spend $800–$2,000 per year on emergency repairs that could\'ve been prevented. Our plan is $99–$129/month — that\'s less than $3 a day to have a professional eyes-on your home every single month. We\'re not a cost — we\'re insurance.',
  },
  {
    q: '"I\'m not interested right now."',
    a: 'Totally fair! Most people say that before they understand what we actually do. 72% of our members have had at least one issue caught before it became a major repair in their first 6 months. Can I share one quick example?',
  },
  {
    q: '"I already have someone who does this."',
    a: 'That\'s great — who do you use? The difference with Wayside is consistency. We\'re at your home every single month on a schedule, we document everything, and you get a digital report after every visit. One visit a year is reactive. What we do is proactive home management.',
  },
  {
    q: '"I need to talk to my spouse first."',
    a: 'Absolutely, I respect that. Would it help if I came back when you\'re both home? Our plan is month-to-month with no long-term contract — you can cancel any time. No pressure at all.',
  },
  {
    q: '"We just moved in, we don\'t need this yet."',
    a: 'Actually, right now is the perfect time! Most problems in a home are invisible for the first 6–12 months. New homeowners who start early catch issues while they\'re small — before warranties expire and before things get expensive.',
  },
  {
    q: '"I do my own maintenance."',
    a: 'That\'s impressive — most people don\'t. Our members who are handy love us because we catch the things that are easy to miss: carbon monoxide sensor battery levels, weatherstripping gaps, slow drain buildup. We\'re your second set of professional eyes.',
  },
];

function ObjectionCard({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`bg-white rounded-2xl border transition-all ${open ? 'border-pathway-green/30' : 'border-deep-forest/10'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-5 py-4 flex items-center justify-between gap-3"
      >
        <span className="text-sm font-semibold text-deep-forest">{q}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-pathway-green flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-deep-forest/30 flex-shrink-0" />
        }
      </button>
      {open && (
        <div className="px-5 pb-5 animate-in slide-in-from-top-1 duration-150">
          <p className="text-sm text-deep-forest/70 leading-relaxed border-t border-deep-forest/5 pt-4 italic">{a}</p>
        </div>
      )}
    </div>
  );
}

export function PitchGuide() {
  const [tab, setTab] = useState<'plans' | 'objections'>('plans');

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Tab switcher */}
      <div className="flex gap-2 bg-linen-white rounded-xl p-1 border border-deep-forest/10">
        {(['plans', 'objections'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              tab === t
                ? 'bg-pathway-green text-white shadow-sm'
                : 'text-deep-forest/50 hover:text-deep-forest/70'
            }`}
          >
            {t === 'plans' ? 'Plan Cards' : 'Objections'}
          </button>
        ))}
      </div>

      {/* Plans */}
      {tab === 'plans' && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          {PLANS.map(plan => (
            <div
              key={plan.tier}
              className={`bg-white rounded-2xl border ${plan.border} overflow-hidden`}
            >
              {/* Plan header */}
              <div className={`${plan.bg} px-5 py-5 border-b ${plan.border}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${plan.textColor}`}>{plan.tier} Plan</p>
                    <p className="text-3xl font-black text-deep-forest mt-0.5">{plan.price}</p>
                    <p className="text-deep-forest/50 text-xs mt-0.5">{plan.sqft}</p>
                  </div>
                  <Home className={`w-8 h-8 ${plan.textColor} opacity-40 mb-1`} />
                </div>
              </div>
              {/* Feature list */}
              <ul className="px-5 py-4 flex flex-col gap-2.5">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-deep-forest/80">
                    <span className={`mt-0.5 flex-shrink-0 font-bold ${plan.textColor}`}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Objections */}
      {tab === 'objections' && (
        <div className="flex flex-col gap-3 animate-in fade-in duration-200">
          <p className="text-[11px] italic text-deep-forest/40">Tap any objection for a scripted response.</p>
          {OBJECTIONS.map((o, i) => (
            <ObjectionCard key={i} {...o} />
          ))}
        </div>
      )}
    </div>
  );
}
