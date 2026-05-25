import { useState, useEffect } from 'react';
import { D2DLead, LeadStatus, PricingTier, PRICING_TIERS } from '../types';
import { Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  repName: string;
  initialLat?: number;
  initialLng?: number;
  onSave: (lead: Omit<D2DLead, 'id' | 'created_at'>) => Promise<void>;
  onCancel: () => void;
}

export function LogDoorForm({ repName, initialLat, initialLng, onSave, onCancel }: Props) {
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [sqft, setSqft] = useState<PricingTier>('under2000');
  const [status, setStatus] = useState<LeadStatus>('not_home');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  // Auto reverse-geocode coords → address
  useEffect(() => {
    if (initialLat && initialLng && initialLat !== 0) {
      setGeocoding(true);
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${initialLat}&lon=${initialLng}&format=json`)
        .then(r => r.json())
        .then(data => {
          if (data?.display_name) {
            const parts = data.display_name.split(', ');
            setAddress(parts.slice(0, 3).join(', '));
          }
        })
        .catch(() => {})
        .finally(() => setGeocoding(false));
    }
  }, [initialLat, initialLng]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        rep_name: repName,
        address,
        lat: initialLat || null,
        lng: initialLng || null,
        sqft,
        tier: sqft,
        status,
        contact_name: contactName,
        phone,
        notes,
        follow_up_date: followUpDate,
      });
    } catch {
      toast.error('Failed to save. Check your connection.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-4 py-3 rounded-xl border border-deep-forest/10 text-deep-forest text-sm focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50';
  const labelClass = 'text-[10px] font-bold uppercase text-deep-forest/50 block mb-1.5';

  const outcomes: { value: LeadStatus; label: string; color: string }[] = [
    { value: 'interested', label: 'Interested', color: '#1D9E75' },
    { value: 'scheduled', label: 'Appt. Set', color: '#3B82F6' },
    { value: 'not_home', label: 'Not Home', color: '#EF9F27' },
    { value: 'not_interested', label: 'Not Interested', color: '#EF4444' },
  ];

  const showContactFields = status === 'interested' || status === 'scheduled';
  const showFollowUp = status === 'interested' || status === 'not_home';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5">

      {/* Address */}
      <div>
        <label htmlFor="door-address" className={labelClass}>Property Address</label>
        <div className="relative">
          {geocoding
            ? <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/30 pointer-events-none animate-spin" />
            : <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/30 pointer-events-none" />
          }
          <input
            id="door-address"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Auto-detected — tap to edit"
            className={inputClass + ' pl-10'}
          />
        </div>
        {initialLat !== 0 && initialLat != null && (
          <p className="text-[10px] italic text-deep-forest/40 mt-1 ml-1">GPS location captured</p>
        )}
      </div>

      {/* Outcome */}
      <div>
        <label className={labelClass}>Outcome *</label>
        <div className="grid grid-cols-2 gap-2">
          {outcomes.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatus(opt.value)}
              className={`px-3 py-3 rounded-xl text-xs font-bold text-left transition-all border ${
                status === opt.value
                  ? 'text-white'
                  : 'bg-linen-white text-deep-forest/60 border-deep-forest/10 hover:bg-deep-forest/5'
              }`}
              style={
                status === opt.value
                  ? { background: opt.color, borderColor: opt.color }
                  : {}
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Home size + pricing */}
      <div>
        <label className={labelClass}>Home Size</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(PRICING_TIERS) as [PricingTier, typeof PRICING_TIERS[PricingTier]][]).map(([key, tier]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSqft(key)}
              className={`px-4 py-3 rounded-xl text-left transition-all border flex flex-col gap-0.5 ${
                sqft === key
                  ? 'bg-pathway-green/10 border-pathway-green/30 text-deep-forest'
                  : 'bg-linen-white border-deep-forest/10 text-deep-forest/60 hover:bg-deep-forest/5'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-deep-forest/50">{tier.sqft}</span>
              <span className={`text-lg font-black ${sqft === key ? 'text-pathway-green' : 'text-deep-forest/30'}`}>
                ${tier.price}<span className="text-xs font-medium">/mo</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Contact info — only when interested or scheduled */}
      {showContactFields && (
        <div className="flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
          <div>
            <label htmlFor="contact-name" className={labelClass}>Contact Name</label>
            <input id="contact-name" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Homeowner's name" className={inputClass} />
          </div>
          <div>
            <label htmlFor="contact-phone" className={labelClass}>Phone Number</label>
            <input id="contact-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" className={inputClass} />
          </div>
        </div>
      )}

      {/* Follow-up date */}
      {showFollowUp && (
        <div className="animate-in slide-in-from-top-2 duration-200">
          <label htmlFor="follow-up-date" className={labelClass}>Follow-up Date</label>
          <input
            id="follow-up-date"
            type="date"
            value={followUpDate}
            onChange={e => setFollowUpDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className={inputClass}
          />
        </div>
      )}

      {/* Notes */}
      <div>
        <label htmlFor="door-notes" className={labelClass}>Notes</label>
        <textarea
          id="door-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Dogs, gated, best time to call back..."
          rows={3}
          className={inputClass + ' resize-none min-h-[80px]'}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3.5 rounded-xl border border-deep-forest/10 text-deep-forest/60 text-sm font-bold hover:bg-deep-forest/5 transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-grow flex-2 py-3.5 px-8 rounded-xl bg-pathway-green text-white text-sm font-bold hover:brightness-110 transition-all shadow-lg shadow-pathway-green/20 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving...' : 'Log Door'}
        </button>
      </div>
    </form>
  );
}
