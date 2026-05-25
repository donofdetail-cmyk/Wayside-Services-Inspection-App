import { useEffect, useRef, useState } from 'react';
import { D2DLead, STATUS_COLORS, STATUS_LABELS } from '../types';
import { Loader2, Navigation, X, MapPin } from 'lucide-react';
import L from 'leaflet';

// Fix Leaflet default icon paths in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Props {
  leads: D2DLead[];
  onLogDoor: (lat: number, lng: number) => void;
}

export function MapView({ leads, onLogDoor }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const [locating, setLocating] = useState(false);
  const [selectedLead, setSelectedLead] = useState<D2DLead | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);

  // Init map once
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, {
      center: [37.7749, -122.4194],
      zoom: 15,
      zoomControl: false,
    });

    // Light tile layer matching the app's warm/clean palette
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapInstance.current = map;

    // Auto-center on user
    navigator.geolocation?.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        map.setView([lat, lng], 16);
        setUserPos({ lat, lng });
        placeUserMarker(map, lat, lng);
      },
      () => {},
      { enableHighAccuracy: true }
    );

    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  const placeUserMarker = (map: L.Map, lat: number, lng: number) => {
    if (userMarkerRef.current) userMarkerRef.current.remove();
    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:16px;height:16px;
        background:#1D9E75;
        border:3px solid white;
        border-radius:50%;
        box-shadow:0 0 0 5px rgba(29,158,117,0.25), 0 2px 6px rgba(0,0,0,0.2);
      "></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    userMarkerRef.current = L.marker([lat, lng], { icon }).addTo(map);
  };

  // Sync pins
  useEffect(() => {
    if (!mapInstance.current) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    leads.forEach(lead => {
      if (lead.lat == null || lead.lng == null) return;
      const marker = L.circleMarker([lead.lat, lead.lng], {
        radius: 9,
        fillColor: STATUS_COLORS[lead.status],
        color: 'white',
        weight: 2,
        opacity: 1,
        fillOpacity: 1,
      })
        .addTo(mapInstance.current!)
        .on('click', () => setSelectedLead(lead));
      markersRef.current.push(marker);
    });
  }, [leads]);

  const handleLocateMe = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserPos({ lat, lng });
        mapInstance.current?.setView([lat, lng], 17);
        if (mapInstance.current) placeUserMarker(mapInstance.current, lat, lng);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true }
    );
  };

  const handleLogHere = () => {
    if (userPos) {
      onLogDoor(userPos.lat, userPos.lng);
    } else {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setUserPos({ lat, lng });
          if (mapInstance.current) placeUserMarker(mapInstance.current, lat, lng);
          setLocating(false);
          onLogDoor(lat, lng);
        },
        () => { setLocating(false); onLogDoor(0, 0); },
        { enableHighAccuracy: true }
      );
    }
  };

  return (
    <div className="relative flex-1 flex flex-col" style={{ minHeight: 0 }}>
      {/* Legend — white card style */}
      <div className="absolute top-3 left-3 z-[1000] bg-white border border-deep-forest/10 rounded-2xl px-3 py-2.5 flex flex-col gap-1.5 shadow-md">
        {(['interested', 'scheduled', 'not_home', 'not_interested'] as const).map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/60" style={{ background: STATUS_COLORS[s] }} />
            <span className="text-[10px] text-deep-forest/70 font-bold uppercase tracking-wide">{STATUS_LABELS[s]}</span>
          </div>
        ))}
      </div>

      {/* Map */}
      <div ref={mapRef} className="flex-1" style={{ minHeight: 0 }} />

      {/* Lead popup — white card style */}
      {selectedLead && (
        <div className="absolute bottom-24 left-3 right-3 z-[1000] bg-white border border-deep-forest/10 rounded-2xl p-4 shadow-xl animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[selectedLead.status] }} />
                <span className="text-[10px] font-bold uppercase text-deep-forest/40 tracking-wider">{STATUS_LABELS[selectedLead.status]}</span>
              </div>
              <p className="text-deep-forest font-bold text-sm truncate">{selectedLead.address || 'Address not captured'}</p>
              {selectedLead.contact_name && <p className="text-deep-forest/60 text-xs mt-0.5">{selectedLead.contact_name} · {selectedLead.phone}</p>}
              {selectedLead.notes && <p className="text-deep-forest/40 text-xs mt-1 line-clamp-2 italic">{selectedLead.notes}</p>}
              <p className="text-pathway-green text-xs font-bold mt-1.5">
                ${selectedLead.tier === 'under2000' ? '99' : '129'}/mo plan
              </p>
            </div>
            <button onClick={() => setSelectedLead(null)} className="text-deep-forest/30 hover:text-deep-forest transition-colors mt-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* FABs */}
      <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2 items-end">
        <button
          onClick={handleLocateMe}
          className="w-11 h-11 rounded-full bg-white border border-deep-forest/10 flex items-center justify-center shadow-md text-deep-forest/50 hover:text-pathway-green hover:border-pathway-green/30 transition-all"
        >
          {locating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
        </button>
        <button
          onClick={handleLogHere}
          className="px-5 py-3 rounded-full bg-pathway-green text-white text-sm font-bold shadow-lg shadow-pathway-green/20 hover:brightness-110 transition-all flex items-center gap-2"
        >
          <MapPin className="w-4 h-4" />
          Log This Door
        </button>
      </div>
    </div>
  );
}
