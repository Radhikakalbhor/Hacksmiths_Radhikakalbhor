'use client';

import React, { useState, useEffect } from 'react';
import {
  Megaphone,
  Send,
  Users,
  Briefcase,
  Globe,
  MapPin,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/admin/ToastContext';

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  audience: 'ALL' | 'CUSTOMERS' | 'WORKERS' | 'CITY';
  city?: string | null;
  created_at: string;
}

export default function AnnouncementsPage() {
  const { success, error } = useToast();
  const [history, setHistory] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'ALL' | 'CUSTOMERS' | 'WORKERS' | 'CITY'>('ALL');
  const [city, setCity] = useState('Mumbai');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch('/api/admin/announcements');
        const json = await res.json();
        if (isMounted && json.success && json.data) {
          setHistory(json.data);
        }
      } catch {
        if (isMounted) error('Failed to load past broadcasts');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [error]);

  const refreshAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/announcements');
      const json = await res.json();
      if (json.success && json.data) {
        setHistory(json.data);
      }
    } catch {
      error('Failed to load past broadcasts');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      error('Please provide both title and body content.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          audience,
          city: audience === 'CITY' ? city : undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        success('Announcement broadcast published to users.');
        setTitle('');
        setBody('');
        refreshAnnouncements();
      } else {
        error(json.error?.message || 'Broadcast failed.');
      }
    } catch {
      error('Network error dispatching broadcast.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-[#0D4A52]">
              <Megaphone className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-[#152220]">Community & Safety Announcements</h1>
          </div>
          <p className="text-xs md:text-sm text-[#576563] mt-1">
            Broadcast platform-wide updates, monsoon weather advisories, or city-specific guidelines.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Broadcast Form (1 col) */}
        <Card className="p-6 rounded-2xl border-[#E5DFD2] shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD2]">
            <h3 className="text-base font-bold text-[#152220]">New Broadcast</h3>
            <span className="text-xs text-[#576563]">Instant Dispatch</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Title */}
            <div className="space-y-1">
              <label className="font-bold text-[#152220]">Headline / Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Monsoon Safety Protocol 2026..."
                className="w-full px-3 py-2 rounded-xl border border-[#E5DFD2] bg-[#FAF9F5] focus:outline-none focus:ring-2 focus:ring-[#0D4A52] text-xs font-semibold"
              />
            </div>

            {/* Target Audience */}
            <div className="space-y-1">
              <label className="font-bold text-[#152220]">Audience Segment</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'ALL', label: 'All Users', icon: Globe },
                  { key: 'WORKERS', label: 'Partners Only', icon: Briefcase },
                  { key: 'CUSTOMERS', label: 'Customers', icon: Users },
                  { key: 'CITY', label: 'Specific City', icon: MapPin },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    onClick={() => setAudience(item.key as 'ALL' | 'CUSTOMERS' | 'WORKERS' | 'CITY')}
                    className={`flex items-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition-colors ${
                      audience === item.key
                        ? 'bg-[#0D4A52] text-white border-[#0D4A52]'
                        : 'bg-[#FAF9F5] text-[#576563] border-[#E5DFD2] hover:bg-white'
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* City if applicable */}
            {audience === 'CITY' && (
              <div className="space-y-1">
                <label className="font-bold text-[#152220]">Target Metro City</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DFD2] bg-[#FAF9F5] focus:outline-none focus:ring-2 focus:ring-[#0D4A52] text-xs font-semibold"
                >
                  <option value="Mumbai">Mumbai</option>
                  <option value="Delhi NCR">Delhi NCR</option>
                  <option value="Bengaluru">Bengaluru</option>
                  <option value="Pune">Pune</option>
                </select>
              </div>
            )}

            {/* Body */}
            <div className="space-y-1">
              <label className="font-bold text-[#152220]">Message Body</label>
              <textarea
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Draft the announcement details clearly..."
                className="w-full px-3 py-2 rounded-xl border border-[#E5DFD2] bg-[#FAF9F5] focus:outline-none focus:ring-2 focus:ring-[#0D4A52] text-xs resize-none"
              />
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={submitting}
              variant="primary"
              className="w-full rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Publishing...' : 'Broadcast Announcement'}</span>
            </Button>
          </form>
        </Card>

        {/* Broadcast History (2 cols) */}
        <Card className="lg:col-span-2 p-6 rounded-2xl border-[#E5DFD2] shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD2]">
            <h3 className="text-base font-bold text-[#152220]">Broadcast Archive</h3>
            <span className="text-xs text-[#576563]">{history.length} Sent</span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {loading ? (
              <p className="py-12 text-center text-xs text-[#576563]">Loading announcements...</p>
            ) : history.length === 0 ? (
              <p className="py-12 text-center text-xs text-[#576563]">No past announcements found.</p>
            ) : (
              history.map((ann) => (
                <div
                  key={ann.id}
                  className="p-4 rounded-xl border border-[#E5DFD2] bg-[#FAF9F5]/50 space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-bold text-sm text-[#152220]">{ann.title}</h4>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-[#0D4A52] border border-teal-200">
                      {ann.audience} {ann.city ? `• ${ann.city}` : ''}
                    </span>
                  </div>
                  <p className="text-[#576563] leading-relaxed whitespace-pre-wrap">{ann.body}</p>
                  <span className="text-[10px] text-[#576563]/80 block pt-1">
                    Sent on {new Date(ann.created_at).toLocaleString('en-IN')}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
