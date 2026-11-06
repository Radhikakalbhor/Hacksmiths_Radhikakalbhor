'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Card } from '@/components/ui/Card';
import { Filter, Users, Briefcase } from 'lucide-react';

interface MarkerItem {
  id: string;
  type: 'job' | 'worker';
  title: string;
  category: string;
  lat: number;
  lng: number;
  status: string;
  price?: number;
}

const INITIAL_MARKERS: MarkerItem[] = [
  { id: 'm1', type: 'job', title: 'Leaking Kitchen Sink', category: 'plumbing', lat: 19.0596, lng: 72.8295, status: 'IN_PROGRESS', price: 450 },
  { id: 'm2', type: 'worker', title: 'Ramesh Kumar (Plumber)', category: 'plumbing', lat: 19.0620, lng: 72.8350, status: 'ONLINE' },
  { id: 'm3', type: 'job', title: 'Short Circuit in Bedroom', category: 'electrical', lat: 19.0178, lng: 72.8478, status: 'BIDDING_OPEN', price: 600 },
  { id: 'm4', type: 'worker', title: 'Arif Khan (Electrician)', category: 'electrical', lat: 19.0210, lng: 72.8520, status: 'ONLINE' },
  { id: 'm5', type: 'job', title: 'Deep Kitchen Degreasing', category: 'cleaning', lat: 19.1136, lng: 72.8697, status: 'ASSIGNED', price: 1200 },
  { id: 'm6', type: 'worker', title: 'Sunita Bai (Cleaning)', category: 'cleaning', lat: 19.1100, lng: 72.8750, status: 'ONLINE' },
  { id: 'm7', type: 'job', title: 'Wooden Wardrobe Door Latch', category: 'carpentry', lat: 19.1176, lng: 72.9060, status: 'POSTED', price: 350 },
];

const jobIcon = L.divIcon({
  className: 'custom-job-marker',
  html: `<div style="background-color: #0D4A52; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">J</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const workerIcon = L.divIcon({
  className: 'custom-worker-marker',
  html: `<div style="background-color: #217E66; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">W</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function InnerLeafletMap({
  markers,
  selectedCategory,
}: {
  markers: MarkerItem[];
  selectedCategory: string;
}) {
  const filtered =
    selectedCategory === 'all'
      ? markers
      : markers.filter((m) => m.category.toLowerCase() === selectedCategory.toLowerCase());

  return (
    <MapContainer
      center={[19.076, 72.8777]}
      zoom={11}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%', zIndex: 10 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {filtered.map((m) => (
        <Marker key={m.id} position={[m.lat, m.lng]} icon={m.type === 'job' ? jobIcon : workerIcon}>
          <Popup>
            <div className="p-1 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[#152220]">
                {m.type === 'job' ? (
                  <Briefcase className="w-3.5 h-3.5 text-[#0D4A52]" />
                ) : (
                  <Users className="w-3.5 h-3.5 text-[#217E66]" />
                )}
                <span>{m.title}</span>
              </div>
              <p className="text-[#576563] capitalize">Category: {m.category}</p>
              <div className="flex items-center justify-between pt-1 font-semibold">
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100">{m.status}</span>
                {m.price && <span className="text-[#0D4A52]">₹{m.price}</span>}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

const DynamicInnerMap = dynamic(() => Promise.resolve(InnerLeafletMap), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#FAF9F5] text-[#576563] space-y-2">
      <div className="w-8 h-8 rounded-full border-3 border-[#0D4A52] border-t-transparent animate-spin" />
      <span className="text-xs font-medium">Initializing OpenStreetMap Tiles...</span>
    </div>
  ),
});

export function AdminLiveMap() {
  const [category, setCategory] = useState('all');

  return (
    <Card className="p-0 overflow-hidden rounded-2xl border-[#E5DFD2] shadow-sm flex flex-col h-[420px]">
      {/* Top map controls */}
      <div className="p-4 bg-white border-b border-[#E5DFD2] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-sm font-bold text-[#152220]">Live Mumbai Field Operations</h3>
        </div>

        {/* Legend & Filter */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0D4A52]" />
            <span className="text-[#576563]">Active Job</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#217E66]" />
            <span className="text-[#576563]">Online Partner</span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#FAF9F5] border border-[#E5DFD2] rounded-xl px-2.5 py-1">
            <Filter className="w-3.5 h-3.5 text-[#576563]" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#152220] focus:outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="plumbing">Plumbing</option>
              <option value="electrical">Electrical</option>
              <option value="cleaning">Cleaning</option>
              <option value="carpentry">Carpentry</option>
            </select>
          </div>
        </div>
      </div>

      {/* Map View Canvas */}
      <div className="flex-1 w-full relative">
        <DynamicInnerMap markers={INITIAL_MARKERS} selectedCategory={category} />
      </div>
    </Card>
  );
}
