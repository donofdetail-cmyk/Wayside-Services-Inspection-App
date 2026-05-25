import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, X, Calendar as CalendarIcon, User, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';

// Fix Leaflet default icon paths in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// A nice palette for technicians
const TECH_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#8b5cf6', // purple
  '#f97316', // orange
  '#14b8a6', // teal
  '#ec4899', // pink
  '#eab308', // yellow
];

const UNASSIGNED_COLOR = '#9ca3af'; // gray

interface Props {
  leads: any[];
  profiles: any[];
  onAssignTech: (leadId: string, techId: string) => Promise<void>;
  onScheduleTime: (leadId: string, start: string | null, end: string | null) => Promise<void>;
}

export function DispatchMap({ leads, profiles, onAssignTech, onScheduleTime }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [techColorMap, setTechColorMap] = useState<Record<string, string>>({});

  const technicians = profiles.filter(p => p.role === 'technician');
  const scheduledLeads = leads.filter(l => l.status === 'scheduled');
  
  const unassignedLeads = scheduledLeads.filter(l => !l.assigned_tech_id);
  const assignedLeads = scheduledLeads.filter(l => !!l.assigned_tech_id);

  // Initialize tech colors mapping stably
  useEffect(() => {
    const newMap: Record<string, string> = {};
    technicians.forEach((tech, idx) => {
      newMap[tech.id] = TECH_COLORS[idx % TECH_COLORS.length];
    });
    setTechColorMap(newMap);
  }, [technicians]);

  // Init map once
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, {
      center: [37.7749, -122.4194], // Default to SF or a central location. Will auto-fit bounds later.
      zoom: 12,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);
    mapInstance.current = map;

    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  // Sync pins and fit bounds
  useEffect(() => {
    if (!mapInstance.current) return;
    
    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const bounds = L.latLngBounds([]);

    scheduledLeads.forEach(lead => {
      if (lead.lat == null || lead.lng == null) return;
      
      const color = lead.assigned_tech_id ? techColorMap[lead.assigned_tech_id] || '#000' : UNASSIGNED_COLOR;
      
      const marker = L.circleMarker([lead.lat, lead.lng], {
        radius: 10,
        fillColor: color,
        color: 'white',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      })
        .addTo(mapInstance.current!)
        .on('click', () => setSelectedLead(lead));
        
      markersRef.current.push(marker);
      bounds.extend([lead.lat, lead.lng]);
    });

    if (bounds.isValid() && markersRef.current.length > 0) {
      mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [scheduledLeads, techColorMap]);

  // If selected lead changes in parent state, make sure local state gets the fresh object
  useEffect(() => {
    if (selectedLead) {
      const fresh = scheduledLeads.find(l => l.id === selectedLead.id);
      if (fresh) setSelectedLead(fresh);
      else setSelectedLead(null);
    }
  }, [scheduledLeads]);

  const handlePanTo = (lead: any) => {
    if (lead.lat != null && lead.lng != null && mapInstance.current) {
      mapInstance.current.setView([lead.lat, lead.lng], 17, { animate: true });
      setSelectedLead(lead);
    } else {
      setSelectedLead(lead);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 overflow-hidden flex flex-col md:flex-row h-[75vh] min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Sidebar Queue */}
      <div className="w-full md:w-80 bg-linen-white/30 border-r border-deep-forest/10 flex flex-col shrink-0">
        <div className="p-4 border-b border-deep-forest/10 bg-white">
          <h3 className="font-bold text-deep-forest flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-amber-porch" /> 
            Dispatch Queue
          </h3>
          <p className="text-xs text-deep-forest/60 mt-1">
            {unassignedLeads.length} Unassigned • {assignedLeads.length} Assigned
          </p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Unassigned Section */}
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-deep-forest/50 mb-3 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: UNASSIGNED_COLOR }}></div>
              Action Required ({unassignedLeads.length})
            </h4>
            <div className="space-y-2">
              {unassignedLeads.length === 0 && <p className="text-xs text-deep-forest/40 italic">All caught up.</p>}
              {unassignedLeads.map(lead => (
                <div 
                  key={lead.id} 
                  onClick={() => handlePanTo(lead)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedLead?.id === lead.id ? 'bg-white border-amber-porch shadow-md ring-1 ring-amber-porch' : 'bg-white border-deep-forest/5 hover:border-amber-porch/50 hover:shadow-sm'}`}
                >
                  <p className="font-bold text-sm text-deep-forest truncate">{lead.contact_name || 'Resident'}</p>
                  <p className="text-xs text-deep-forest/60 truncate mt-0.5">{lead.address}</p>
                  {!lead.lat && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">No GPS Data</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Assigned Section */}
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-deep-forest/50 mb-3">
              Routed Today
            </h4>
            <div className="space-y-2">
              {assignedLeads.length === 0 && <p className="text-xs text-deep-forest/40 italic">No routes built yet.</p>}
              {assignedLeads.map(lead => (
                <div 
                  key={lead.id} 
                  onClick={() => handlePanTo(lead)}
                  className={`p-3 rounded-xl border border-l-4 cursor-pointer transition-all ${selectedLead?.id === lead.id ? 'bg-white shadow-md brightness-95' : 'bg-white hover:brightness-95'}`}
                  style={{ borderLeftColor: techColorMap[lead.assigned_tech_id] || UNASSIGNED_COLOR }}
                >
                  <p className="font-bold text-sm text-deep-forest truncate">{lead.contact_name || 'Resident'}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <User className="w-3 h-3 text-deep-forest/40" />
                    <p className="text-[10px] font-bold text-deep-forest/60 truncate">
                      {technicians.find(t => t.id === lead.assigned_tech_id)?.full_name || 'Unknown'}
                    </p>
                  </div>
                  {lead.scheduled_start && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3 text-deep-forest/40" />
                      <p className="text-[10px] font-bold text-pathway-green">
                        {new Date(lead.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Map Legend */}
        <div className="p-4 border-t border-deep-forest/10 bg-white">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-deep-forest/50 mb-2">Tech Legend</h4>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {technicians.map(tech => (
              <div key={tech.id} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: techColorMap[tech.id] }}></div>
                <span className="text-xs text-deep-forest/70 font-medium truncate max-w-[80px]">{tech.full_name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div className="relative flex-1 bg-gray-100 min-h-[400px]">
        <div ref={mapRef} className="absolute inset-0 z-0" />
        
        {/* Selected Lead Overlay Panel */}
        {selectedLead && (
          <div className="absolute top-4 right-4 z-[1000] w-80 bg-white/95 backdrop-blur-md border border-deep-forest/10 rounded-2xl shadow-2xl p-5 animate-in slide-in-from-right-4 duration-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-bold text-lg text-deep-forest leading-tight">{selectedLead.contact_name || 'Resident'}</h4>
                <p className="text-xs text-deep-forest/60 mt-1">{selectedLead.address}</p>
                {selectedLead.notes && <p className="text-xs italic text-deep-forest/50 mt-2 line-clamp-2">"{selectedLead.notes}"</p>}
              </div>
              <button 
                onClick={() => setSelectedLead(null)}
                className="w-8 h-8 rounded-full bg-deep-forest/5 hover:bg-deep-forest/10 flex items-center justify-center text-deep-forest transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 pt-4 border-t border-deep-forest/10">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-deep-forest/50 mb-1.5 flex items-center gap-1">
                  <User className="w-3 h-3" /> Assign Technician
                </label>
                <select
                  className="w-full text-sm p-2.5 border border-deep-forest/20 rounded-xl bg-white focus:outline-none focus:border-pathway-green focus:ring-1 focus:ring-pathway-green transition-all"
                  value={selectedLead.assigned_tech_id || ''}
                  onChange={(e) => onAssignTech(selectedLead.id, e.target.value)}
                >
                  <option value="" disabled>Select Tech...</option>
                  {technicians.map(tech => (
                    <option key={tech.id} value={tech.id}>{tech.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-deep-forest/50 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Time Window
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-deep-forest/40 ml-1">Start</span>
                    <Input 
                      type="datetime-local" 
                      className="text-xs h-9" 
                      value={selectedLead.scheduled_start ? selectedLead.scheduled_start.substring(0,16) : ''} 
                      onChange={(e) => {
                        const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                        onScheduleTime(selectedLead.id, val, selectedLead.scheduled_end);
                      }} 
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-deep-forest/40 ml-1">End</span>
                    <Input 
                      type="datetime-local" 
                      className="text-xs h-9" 
                      value={selectedLead.scheduled_end ? selectedLead.scheduled_end.substring(0,16) : ''} 
                      onChange={(e) => {
                        const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                        onScheduleTime(selectedLead.id, selectedLead.scheduled_start, val);
                      }} 
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-5 pt-4 border-t border-deep-forest/10 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-deep-forest/40">Status: {selectedLead.status.replace('_', ' ')}</span>
              {selectedLead.assigned_tech_id && selectedLead.scheduled_start && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-pathway-green bg-pathway-green/10 px-2 py-1 rounded">
                  Fully Dispatched
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
