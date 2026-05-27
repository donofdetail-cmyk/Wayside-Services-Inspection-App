import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface TechRouteMapProps {
  jobs: any[];
}

export function TechRouteMap({ jobs }: TechRouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Layer[]>([]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      }).addTo(mapInstance.current);
    }

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (jobs.length === 0) {
      mapInstance.current.setView([39.8283, -98.5795], 4);
      return;
    }

    const bounds = L.latLngBounds([]);
    const validJobs = jobs.filter(j => j.lat != null && j.lng != null).sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());

    // Draw markers
    validJobs.forEach((job, idx) => {
      const marker = L.circleMarker([job.lat, job.lng], {
        radius: 12,
        fillColor: '#1D3B34',
        color: 'white',
        weight: 2,
        fillOpacity: 1
      }).bindTooltip(`${idx + 1}. ${job.contact_name || 'Customer'}`, { permanent: true, direction: 'right', className: 'font-bold text-xs' })
      .addTo(mapInstance.current!);
      
      markersRef.current.push(marker);
      bounds.extend([job.lat, job.lng]);
    });

    // Draw Polyline Route
    if (validJobs.length > 1) {
      const coords = validJobs.map(j => [j.lat, j.lng] as [number, number]);
      const polyline = L.polyline(coords, {
        color: '#28A745', // Pathway Green
        weight: 4,
        opacity: 0.8,
        dashArray: '10, 10'
      }).addTo(mapInstance.current!);
      markersRef.current.push(polyline);
    }

    if (bounds.isValid()) {
      mapInstance.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [jobs]);

  return (
    <div className="w-full h-48 md:h-64 rounded-xl overflow-hidden border border-deep-forest/10 shadow-inner relative z-0">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
