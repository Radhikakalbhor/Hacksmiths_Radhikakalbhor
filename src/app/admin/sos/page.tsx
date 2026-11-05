'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertOctagon,
  Phone,
  MapPin,
  CheckCircle2,
  Volume2,
  VolumeX,
  HeartHandshake,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmModal } from '@/components/admin/ConfirmModal';
import { useToast } from '@/components/admin/ToastContext';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

interface SosIncident {
  id: string;
  jobId?: string | null;
  triggeredBy: string;
  triggeredByName: string;
  triggeredByPhone: string;
  triggeredByRole: 'customer' | 'worker';
  severity: string;
  status: 'TRIGGERED' | 'ACKNOWLEDGED' | 'ESCALATED' | 'RESOLVED';
  notes: string | null;
  trustedContacts?: Array<{ name: string; phone: string; relationship?: string }>;
  locationPoint?: { lat: number; lng: number; address?: string };
  createdAt: string;
}

// Mini SOS Map
function MiniSosMap({ lat, lng }: { lat: number; lng: number }) {
  const sosIcon = L.divIcon({
    className: 'custom-sos-marker',
    html: `<div style="background-color: #DC2626; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; border: 3px solid white; box-shadow: 0 0 10px rgba(220,38,38,0.8); animation: pulse 1.5s infinite;">🚨</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={14}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%', borderRadius: '16px' }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[lat, lng]} icon={sosIcon}>
        <Popup>Emergency Incident Location</Popup>
      </Marker>
    </MapContainer>
  );
}

const DynamicSosMap = dynamic(() => Promise.resolve(MiniSosMap), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-red-50 flex items-center justify-center text-xs text-red-600">
      Loading Incident Map...
    </div>
  ),
});

export default function SosConsolePage() {
  const { success, error } = useToast();
  const [incidents, setIncidents] = useState<SosIncident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<SosIncident | null>(null);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'ACKNOWLEDGE' | 'ESCALATE' | 'RESOLVE'>('ACKNOWLEDGE');
  const [actionLoading, setActionLoading] = useState(false);

  // Play synthesized web-audio alert tone without external mp3 dependencies
  const playAlertSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch {
      // Audio autoplay restrictions catch
    }
  }, [soundEnabled]);

  const reloadIncidents = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sos');
      const json = await res.json();
      if (json.success && json.data) {
        setIncidents(json.data);
        if (json.data.length > 0) {
          setSelectedIncident((prev) => prev ?? json.data[0]);
        }
      }
    } catch {
      error('Failed to load SOS incidents');
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const res = await fetch('/api/admin/sos');
        const json = await res.json();
        if (!cancelled && json.success && json.data) {
          setIncidents(json.data);
          if (json.data.length > 0) {
            setSelectedIncident((prev) => prev ?? json.data[0]);
          }
        }
      } catch {
        if (!cancelled) error('Failed to load SOS incidents');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    // Supabase Realtime Subscription
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const channel = supabase
        .channel('admin-sos-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sos_incidents' },
          (payload) => {
            reloadIncidents();
            if (payload.eventType === 'INSERT') {
              playAlertSound();
            }
          }
        )
        .subscribe();

      return () => {
        cancelled = true;
        supabase.removeChannel(channel);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [error, reloadIncidents, playAlertSound]);

  const openActionModal = (type: 'ACKNOWLEDGE' | 'ESCALATE' | 'RESOLVE') => {
    setActionType(type);
    setModalOpen(true);
  };

  const handleConfirmAction = async (notes: string) => {
    if (!selectedIncident) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidentId: selectedIncident.id,
          action: actionType,
          notes,
        }),
      });

      const json = await res.json();
      if (json.success) {
        success(`Incident ${selectedIncident.id.slice(0, 8)} status set to ${actionType}.`);
        setModalOpen(false);
        reloadIncidents();
      } else {
        error(json.error?.message || 'Failed to update SOS incident.');
      }
    } catch {
      error('Network error updating SOS incident.');
    } finally {
      setActionLoading(false);
    }
  };

  const openCount = incidents.filter((i) => i.status !== 'RESOLVED').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-100 text-red-600 animate-pulse">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-[#152220]">Emergency SOS Dispatch Console</h1>
          </div>
          <p className="text-xs md:text-sm text-[#576563] mt-1">
            Real-time panic monitoring, caller location dispatch, and trusted-contact safety outreach.
          </p>
        </div>

        {/* Audio Toggle & Incident Count */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
              soundEnabled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-gray-100 text-gray-600 border-gray-300'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4" />}
            <span>Alert Sound: {soundEnabled ? 'ON' : 'MUTED'}</span>
          </button>

          <span
            className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${
              openCount > 0
                ? 'bg-red-50 text-red-700 border-red-300 animate-pulse'
                : 'bg-emerald-50 text-emerald-700 border-emerald-300'
            }`}
          >
            {openCount} Active Incidents
          </span>
        </div>
      </div>

      {/* Main Console Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incident List (1 col) */}
        <Card className="p-0 overflow-hidden rounded-2xl border-[#E5DFD2] shadow-sm flex flex-col h-[600px]">
          <div className="p-4 bg-white border-b border-[#E5DFD2] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#152220]">Incident Stream</h3>
            <span className="text-xs text-[#576563]">Realtime Supabase Feed</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#E5DFD2]/60">
            {loading ? (
              <div className="py-20 text-center text-xs text-[#576563]">Loading incident alerts...</div>
            ) : incidents.length === 0 ? (
              <div className="py-20 text-center text-[#576563] space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-bold text-[#152220]">No Active Emergencies</p>
                <p className="text-xs">All past incidents resolved.</p>
              </div>
            ) : (
              incidents.map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  className={`p-4 cursor-pointer transition-colors space-y-2 ${
                    selectedIncident?.id === inc.id
                      ? 'bg-red-50/70 border-l-4 border-l-red-600'
                      : 'hover:bg-[#FAF9F5]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#152220]">{inc.triggeredByName}</span>
                    <StatusBadge status={inc.status} type="sos" />
                  </div>
                  <p className="text-xs text-[#576563] line-clamp-2">
                    {inc.notes || 'Emergency button pressed on mobile app.'}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-[#576563]">
                    <span className="capitalize font-semibold text-[#0D4A52]">{inc.triggeredByRole}</span>
                    <span>{new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Selected Incident Control & Map Detail (2 cols) */}
        {selectedIncident ? (
          <div className="lg:col-span-2 space-y-6">
            {/* Live Map Canvas */}
            <Card className="p-0 rounded-2xl border-[#E5DFD2] overflow-hidden shadow-sm flex flex-col h-72">
              <div className="p-3 bg-white border-b border-[#E5DFD2] flex items-center justify-between text-xs font-bold text-[#152220]">
                <span className="flex items-center gap-1.5 text-red-600">
                  <MapPin className="w-4 h-4" /> Incident GPS Coordinates
                </span>
                <span className="text-[#576563]">
                  {selectedIncident.locationPoint?.address || 'Bandra West, Mumbai'}
                </span>
              </div>
              <div className="flex-1 w-full relative">
                <DynamicSosMap
                  lat={selectedIncident.locationPoint?.lat || 19.0596}
                  lng={selectedIncident.locationPoint?.lng || 72.8295}
                />
              </div>
            </Card>

            {/* Caller & Trusted Contacts Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Triggerer Contact */}
              <Card className="p-5 rounded-2xl border-[#E5DFD2] shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#E5DFD2]/60">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#576563]">
                    Caller Information
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize bg-teal-50 text-teal-800 border border-teal-200">
                    {selectedIncident.triggeredByRole}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <p className="text-sm font-bold text-[#152220]">{selectedIncident.triggeredByName}</p>
                  <p className="flex items-center gap-1.5 text-[#0D4A52] font-semibold">
                    <Phone className="w-3.5 h-3.5" />
                    <a href={`tel:${selectedIncident.triggeredByPhone}`} className="hover:underline">
                      {selectedIncident.triggeredByPhone}
                    </a>
                  </p>
                  <p className="text-[#576563]">User ID: {selectedIncident.triggeredBy}</p>
                </div>
              </Card>

              {/* Trusted Contacts */}
              <Card className="p-5 rounded-2xl border-[#E5DFD2] shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#E5DFD2]/60">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#576563]">
                    Registered Trusted Contacts
                  </span>
                  <HeartHandshake className="w-4 h-4 text-[#217E66]" />
                </div>
                <div className="space-y-2 text-xs">
                  {selectedIncident.trustedContacts && selectedIncident.trustedContacts.length > 0 ? (
                    selectedIncident.trustedContacts.map((contact, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-[#FAF9F5] border border-[#E5DFD2]">
                        <div>
                          <span className="font-bold text-[#152220] block">{contact.name}</span>
                          <span className="text-[11px] text-[#576563]">{contact.relationship || 'Contact'}</span>
                        </div>
                        <a
                          href={`tel:${contact.phone}`}
                          className="px-2.5 py-1 bg-[#0D4A52] text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" /> Call
                        </a>
                      </div>
                    ))
                  ) : (
                    <p className="text-[#576563] italic py-2">No trusted contacts configured by user.</p>
                  )}
                </div>
              </Card>
            </div>

            {/* Action Bar */}
            <Card className="p-5 rounded-2xl border-[#E5DFD2] shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-[#152220] block">Action Required</span>
                <p className="text-xs text-[#576563]">
                  All decisions logged to audit trail.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedIncident.status === 'TRIGGERED' && (
                  <Button
                    onClick={() => openActionModal('ACKNOWLEDGE')}
                    variant="secondary"
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-amber-700 hover:text-amber-800"
                  >
                    Acknowledge Dispatch
                  </Button>
                )}

                {selectedIncident.status !== 'ESCALATED' && selectedIncident.status !== 'RESOLVED' && (
                  <Button
                    onClick={() => openActionModal('ESCALATE')}
                    variant="danger"
                    className="rounded-xl px-4 py-2 text-xs font-semibold"
                  >
                    Escalate to Authorities
                  </Button>
                )}

                {selectedIncident.status !== 'RESOLVED' && (
                  <Button
                    onClick={() => openActionModal('RESOLVE')}
                    variant="primary"
                    className="rounded-xl px-4 py-2 text-xs font-semibold bg-[#217E66] hover:bg-[#165646]"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Mark Resolved
                  </Button>
                )}
              </div>
            </Card>
          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center p-12 bg-white rounded-2xl border border-[#E5DFD2]">
            <p className="text-xs text-[#576563]">Select an incident to view details and location.</p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={modalOpen}
        title={`${actionType} Emergency Incident`}
        description={`This action will update caller status in real-time.`}
        confirmLabel={`Submit ${actionType}`}
        variant={actionType === 'ESCALATE' ? 'danger' : 'primary'}
        requireReason={actionType === 'RESOLVE'}
        reasonPlaceholder="Specify resolution notes (e.g. Police reached premises, verified false alarm)..."
        isLoading={actionLoading}
        onConfirm={handleConfirmAction}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
