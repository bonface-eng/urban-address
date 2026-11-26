'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Navigation } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

// Fix for default marker icons
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void;
  initialLat?: number;
  initialLng?: number;
}

function MapEvents({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, 16);
  return null;
}

export default function LocationPicker({ onLocationSelect, initialLat, initialLng }: LocationPickerProps) {
  const [position, setPosition] = useState<[number, number]>(
    initialLat && initialLng ? [initialLat, initialLng] : [-0.2875, 36.1076] // Default to Nakuru
  );
  const [searchQuery, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (initialLat != null && initialLng != null) setPosition([initialLat, initialLng]);
  }, [initialLat, initialLng]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/maps/geocode?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      if (data && data[0]) {
        const { lat, lon, display_name } = data[0];
        const newPos: [number, number] = [parseFloat(lat), parseFloat(lon)];
        setPosition(newPos);
        onLocationSelect(newPos[0], newPos[1], display_name);
        toast({ title: "Location Found", description: display_name.split(',').slice(0, 2).join(',') });
      } else {
        toast({ variant: "destructive", title: "Not Found", description: "Could not find that specific location." });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Search Error", description: "Failed to connect to location services." });
    } finally {
      setIsSearching(false);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "Error", description: "Geolocation not supported." });
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setPosition(newPos);
        onLocationSelect(newPos[0], newPos[1], "Current Location (GPS)");
        setIsLocating(false);
        toast({ title: "Location Synced", description: "Map centered on your current position." });
      },
      () => {
        setIsLocating(false);
        toast({ variant: "destructive", title: "Access Denied", description: "Please enable location permissions." });
      }
    );
  };

  const handleMarkerDrag = (e: any) => {
    const { lat, lng } = e.target.getLatLng();
    setPosition([lat, lng]);
    onLocationSelect(lat, lng, `Custom Point: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input 
            placeholder="Search by building, street or area..." 
            value={searchQuery}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10 h-12 bg-white border-zinc-200 rounded-xl font-bold text-xs"
          />
        </div>
        <Button 
          type="button"
          onClick={handleSearch}
          disabled={isSearching}
          className="h-12 px-6 bg-zinc-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest"
        >
          {isSearching ? <div className="animate-pulse"><img src="/assets/logo.png" className="h-4 w-auto brightness-0 invert" alt="" /></div> : 'Search'}
        </Button>
        <Button 
          type="button"
          variant="outline"
          onClick={handleLocateMe}
          disabled={isLocating}
          className="h-12 w-12 p-0 rounded-xl border-zinc-200 text-primary hover:bg-primary/5"
        >
          {isLocating ? <div className="animate-pulse"><img src="/assets/logo.png" className="h-4 w-auto" alt="" /></div> : <Navigation className="w-4 h-4" />}
        </Button>
      </div>

      <div className="h-[300px] w-full rounded-2xl overflow-hidden border border-zinc-100 shadow-inner relative z-10">
        <MapContainer center={position} zoom={16} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ChangeView center={position} />
          <MapEvents onMove={(lat, lng) => {
             setPosition([lat, lng]);
             onLocationSelect(lat, lng, `Pinned: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }} />
          <Marker 
            position={position} 
            draggable={true}
            eventHandlers={{ dragend: handleMarkerDrag }}
          />
        </MapContainer>
        <div className="absolute bottom-4 left-4 z-[400] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-xl border border-zinc-100">
           <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Tap or drag to pick exact spot</p>
        </div>
      </div>
    </div>
  );
}