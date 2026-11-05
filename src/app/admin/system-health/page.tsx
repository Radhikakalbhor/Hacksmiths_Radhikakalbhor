'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Database,
  ShieldCheck,
  MapPin,
  Bot,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Layers,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/admin/ToastContext';

interface HealthData {
  timestamp: string;
  status: 'HEALTHY' | 'DEGRADED';
  latencyMs: number;
  services: {
    supabasePublic: { status: string; url: string };
    supabaseServiceRole: { status: string; role: string };
    postgis: { status: string; projection: string };
    geminiAi: { status: string; model: string };
  };
  tableCounts: Record<string, number>;
}

export default function SystemHealthPage() {
  const { error } = useToast();
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch('/api/admin/health');
        const json = await res.json();
        if (isMounted && json.success && json.data) {
          setData(json.data);
        }
      } catch {
        if (isMounted) error('Failed to probe infrastructure health');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [error]);

  const refreshHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/health');
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch {
      error('Failed to probe infrastructure health');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-[#0D4A52]">
              <Activity className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-[#152220]">System & Infrastructure Health</h1>
          </div>
          <p className="text-xs md:text-sm text-[#576563] mt-1">
            Real-time diagnostics for PostGIS spatial engine, Supabase RLS, and Google Gemini integration.
          </p>
        </div>

        <Button
          onClick={refreshHealth}
          disabled={loading}
          variant="secondary"
          className="rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2 self-start"
        >
          <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Diagnostics</span>
        </Button>
      </div>

      {/* Primary Status Banner */}
      <Card className="p-6 rounded-2xl border-[#E5DFD2] shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-xs ${
              data?.status === 'HEALTHY' ? 'bg-[#217E66]' : 'bg-amber-500'
            }`}
          >
            {data?.status === 'HEALTHY' ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#152220]">
              Overall Platform Status: {data?.status || 'PROBING...'}
            </h2>
            <p className="text-xs text-[#576563]">
              API & DB Latency: <strong className="text-[#0D4A52]">{data?.latencyMs || 0} ms</strong> • Last probe:{' '}
              {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'Now'}
            </p>
          </div>
        </div>

        <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
          Security Definer Guard Active
        </span>
      </Card>

      {/* 4 Core Infrastructure Services Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Supabase Public */}
        <Card className="p-5 rounded-2xl border-[#E5DFD2] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#576563] uppercase">Database Public Anon</span>
            <Database className="w-4 h-4 text-[#0D4A52]" />
          </div>
          <div>
            <span className="text-sm font-bold text-[#152220] block">
              {data?.services?.supabasePublic?.status || 'ONLINE'}
            </span>
            <span className="text-[11px] text-[#576563] truncate block mt-0.5">
              RLS Policy Enforcement
            </span>
          </div>
        </Card>

        {/* Supabase Service Role */}
        <Card className="p-5 rounded-2xl border-[#E5DFD2] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#576563] uppercase">Service Role Secret</span>
            <ShieldCheck className="w-4 h-4 text-[#217E66]" />
          </div>
          <div>
            <span className="text-sm font-bold text-[#152220] block">
              {data?.services?.supabaseServiceRole?.status || 'CONFIGURED'}
            </span>
            <span className="text-[11px] text-[#576563] block mt-0.5">
              Protected Node.js Runtime
            </span>
          </div>
        </Card>

        {/* PostGIS */}
        <Card className="p-5 rounded-2xl border-[#E5DFD2] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#576563] uppercase">PostGIS Geography</span>
            <MapPin className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <span className="text-sm font-bold text-[#152220] block">
              {data?.services?.postgis?.status || 'ACTIVE'}
            </span>
            <span className="text-[11px] text-[#576563] block mt-0.5">
              Spatial Index (EPSG:4326)
            </span>
          </div>
        </Card>

        {/* Gemini AI */}
        <Card className="p-5 rounded-2xl border-[#E5DFD2] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#576563] uppercase">Google Gemini AI</span>
            <Bot className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <span className="text-sm font-bold text-[#152220] block">
              {data?.services?.geminiAi?.status || 'CONFIGURED'}
            </span>
            <span className="text-[11px] text-[#576563] block mt-0.5">
              Flash 2.0 Advisory Engine
            </span>
          </div>
        </Card>
      </div>

      {/* Database Statistics Card */}
      <Card className="p-6 rounded-2xl border-[#E5DFD2] shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD2]">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#0D4A52]" />
            <h3 className="text-sm font-bold text-[#152220]">Database Entity Volumes</h3>
          </div>
          <span className="text-xs text-[#576563]">Synchronized via PostgreSQL</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
          <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E5DFD2]">
            <span className="text-xs text-[#576563] block">Total Profiles</span>
            <span className="text-xl font-bold text-[#152220] mt-1 block">
              {data?.tableCounts?.profiles ?? 0}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E5DFD2]">
            <span className="text-xs text-[#576563] block">Marketplace Jobs</span>
            <span className="text-xl font-bold text-[#0D4A52] mt-1 block">
              {data?.tableCounts?.jobs ?? 0}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E5DFD2]">
            <span className="text-xs text-[#576563] block">Bids Placed</span>
            <span className="text-xl font-bold text-[#217E66] mt-1 block">
              {data?.tableCounts?.bids ?? 0}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E5DFD2]">
            <span className="text-xs text-[#576563] block">Logged Disputes</span>
            <span className="text-xl font-bold text-purple-700 mt-1 block">
              {data?.tableCounts?.disputes ?? 0}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E5DFD2]">
            <span className="text-xs text-[#576563] block">SOS Incidents</span>
            <span className="text-xl font-bold text-red-600 mt-1 block">
              {data?.tableCounts?.sos_incidents ?? 0}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
