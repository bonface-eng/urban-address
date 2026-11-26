
'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet + Next.js
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

function MapResizer({ center, zoom, bounds }: { center?: [number, number], zoom?: number, bounds?: [number, number][] | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      try {
        const leafletBounds = L.latLngBounds(bounds as L.LatLngExpression[]);
        map.fitBounds(leafletBounds, { padding: [50, 50] });
      } catch (err) {
        console.warn('Could not fit bounds:', err);
      }
    } else if (center) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [map, center, zoom, bounds]);

  return null;
}

interface MapViewProps {
  shopPosition: [number, number];
  userPos: [number, number] | null;
  route: [number, number][] | null;
  mapBounds: [number, number][] | null;
}

export default function MapView({ shopPosition, userPos, route, mapBounds }: MapViewProps) {
  return (
    <MapContainer 
      center={shopPosition} 
      zoom={16} 
      scrollWheelZoom={false} 
      style={{ height: '100%', width: '100%', zIndex: 10 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      <MapResizer bounds={mapBounds} />

      <Marker position={shopPosition}>
        <Popup>
          <div className="text-center p-1">
            <p className="font-black text-zinc-900 uppercase text-[10px] mb-1">Urban Auto Express</p>
            <p className="text-[8px] font-bold text-zinc-400 uppercase">Nakuru HQ</p>
          </div>
        </Popup>
      </Marker>

      {userPos && (
        <Marker position={userPos}>
          <Popup>
            <div className="text-center p-1">
              <p className="font-black text-primary uppercase text-[10px]">Your Location</p>
            </div>
          </Popup>
        </Marker>
      )}

      {route && (
        <Polyline 
          positions={route as L.LatLngExpression[]} 
          pathOptions={{ color: 'hsl(25, 100%, 50%)', weight: 5, opacity: 0.7, lineJoin: 'round' }} 
        />
      )}
    </MapContainer>
  );
}
