'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

// Dynamically import the map view to prevent SSR errors with Leaflet
const MapView = dynamic(() => import('./map-view'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-zinc-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="animate-pulse">
          <img src="/assets/logo.png" className="h-12 w-auto opacity-30" alt="Urban Express" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-300">Synchronizing map coordinates...</p>
      </div>
    </div>
  )
});

export function LocationMap() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [mapBounds, setMapBounds] = useState<[number, number][] | null>(null);

  const shopPosition: [number, number] = [-0.2875484, 36.1076805];

  const handleGetDirections = () => {
    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "Geolocation Error", description: "Your browser does not support location services." });
      return;
    }

    setIsCalculating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const startPos: [number, number] = [latitude, longitude];
        setUserPos(startPos);

        try {
          const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${longitude},${latitude};${shopPosition[1]},${shopPosition[0]}?overview=full&geometries=geojson`
          );
          const data = await response.json();

          if (data.routes && data.routes[0]) {
            const coordinates = data.routes[0].geometry.coordinates.map((coord: any) => [coord[1], coord[0]]);
            setRoute(coordinates);
            
            // Pass simple arrays for the map to calculate bounds
            setMapBounds([startPos, shopPosition]);
            
            toast({ title: "Route Calculated", description: "Navigation path mapped successfully." });
          }
        } catch (err) {
          console.error('Routing Error:', err);
          toast({ variant: "destructive", title: "Routing Failed", description: "Could not synchronize with the navigation server." });
        } finally {
          setIsCalculating(false);
        }
      },
      (error) => {
        setIsCalculating(false);
        toast({ variant: "destructive", title: "Access Denied", description: "Please enable location access to use in-house navigation." });
      }
    );
  };

  return (
    <section className="relative h-[420px] w-full overflow-hidden border-y border-zinc-100 bg-zinc-100 sm:h-[480px] md:h-[560px]">
      <div className="absolute left-3 top-3 z-30 sm:left-5 sm:top-5">
        <div className="flex flex-col gap-3">
          <Button 
            onClick={handleGetDirections}
            disabled={isCalculating}
            className="h-11 px-4 bg-zinc-900 text-white rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-[0.12em] hover:bg-primary transition-all shadow-xl gap-2 sm:h-12 sm:px-5"
          >
            {isCalculating ? (
              <div className="flex items-center gap-3">
                <div className="animate-pulse">
                   <img src="/assets/logo.png" className="h-4 w-auto brightness-0 invert" alt="" />
                </div>
                Mapping Route...
              </div>
            ) : (
              <>
                <Navigation className="w-4 h-4" />
                Get Directions
              </>
            )}
          </Button>

          {route && (
            <div className="bg-white/95 backdrop-blur-md p-3 px-5 rounded-xl shadow-xl border border-zinc-100 animate-in slide-in-from-top-2 flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
               <p className="text-[9px] font-black text-zinc-900 uppercase tracking-widest">
                 Live Navigation Active
               </p>
            </div>
          )}
        </div>
      </div>

      <MapView 
        shopPosition={shopPosition}
        userPos={userPos}
        route={route}
        mapBounds={mapBounds}
      />
    </section>
  );
}
