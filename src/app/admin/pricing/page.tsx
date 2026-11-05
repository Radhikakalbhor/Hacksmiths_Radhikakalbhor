'use client';

import React, { useState, useEffect } from 'react';
import {
  Coins,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/admin/ToastContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface BenchmarkItem {
  id: string;
  category: string;
  city: string;
  minPriceInr: number;
  typicalPriceInr: number;
  maxPriceInr: number;
  avgAcceptedBidInr?: number;
  updatedAt: string;
}

export default function PricingManagerPage() {
  const { success, error } = useToast();
  const [benchmarks, setBenchmarks] = useState<BenchmarkItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ min: number; typical: number; max: number }>({
    min: 0,
    typical: 0,
    max: 0,
  });

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch('/api/admin/pricing');
        const json = await res.json();
        if (isMounted && json.success && json.data) {
          setBenchmarks(json.data);
        }
      } catch {
        if (isMounted) error('Failed to load pricing benchmarks');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [error]);

  const refreshBenchmarks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/pricing');
      const json = await res.json();
      if (json.success && json.data) {
        setBenchmarks(json.data);
      }
    } catch {
      error('Failed to load pricing benchmarks');
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (b: BenchmarkItem) => {
    setEditingId(b.id);
    setEditForm({
      min: b.minPriceInr,
      typical: b.typicalPriceInr,
      max: b.maxPriceInr,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveEditing = async (b: BenchmarkItem) => {
    if (editForm.min <= 0 || editForm.typical <= 0 || editForm.max <= 0) {
      error('All price benchmarks must be greater than zero.');
      return;
    }
    if (editForm.min > editForm.typical) {
      error('Typical price cannot be lower than minimum benchmark.');
      return;
    }
    if (editForm.typical > editForm.max) {
      error('Maximum price cannot be lower than typical benchmark.');
      return;
    }

    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: b.id,
          category: b.category,
          city: b.city,
          minPriceInr: Number(editForm.min),
          typicalPriceInr: Number(editForm.typical),
          maxPriceInr: Number(editForm.max),
        }),
      });

      const json = await res.json();
      if (json.success) {
        success(`Benchmark for ${b.category} updated successfully.`);
        setEditingId(null);
        refreshBenchmarks();
      } else {
        error(json.error?.message || 'Failed to update benchmark');
      }
    } catch {
      error('Error saving benchmark.');
    }
  };

  const chartData = benchmarks.map((b) => ({
    category: b.category.charAt(0).toUpperCase() + b.category.slice(1),
    typicalBenchmark: b.typicalPriceInr,
    avgAcceptedBid: b.avgAcceptedBidInr || b.typicalPriceInr,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-[#0D4A52]">
              <Coins className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-[#152220]">Micro-Market Fair Price Manager</h1>
          </div>
          <p className="text-xs md:text-sm text-[#576563] mt-1">
            Configure transparent price floors and ceilings to prevent price gouging and customer exploitation.
          </p>
        </div>
      </div>

      {/* Comparison Chart: Benchmark Typical vs Actual Accepted Bids */}
      <Card className="p-6 rounded-2xl border-[#E5DFD2] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#152220]">
              Benchmark Typical vs Real Accepted Bid Average (₹)
            </h3>
            <p className="text-xs text-[#576563]">
              Evaluating algorithmic price guardrails against actual negotiated marketplace contracts.
            </p>
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5DFD2" vertical={false} />
              <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#576563' }} />
              <YAxis tick={{ fontSize: 11, fill: '#576563' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E5DFD2',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
              <Bar dataKey="typicalBenchmark" name="Benchmark Target (₹)" fill="#0D4A52" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avgAcceptedBid" name="Actual Accepted Average (₹)" fill="#217E66" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Benchmarks Management Table */}
      <Card className="p-0 overflow-hidden rounded-2xl border-[#E5DFD2] shadow-sm">
        <div className="p-4 border-b border-[#E5DFD2] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#152220]">Micro-Market Benchmarks</h3>
          <span className="text-xs text-[#576563]">Rule: Min ≤ Typical ≤ Max</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9F5] text-[#576563] font-semibold border-b border-[#E5DFD2]">
              <tr>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Min Floor (₹)</th>
                <th className="px-4 py-3">Typical Fair (₹)</th>
                <th className="px-4 py-3">Max Cap (₹)</th>
                <th className="px-4 py-3">Accepted Avg (₹)</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD2]/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#576563]">
                    Loading price benchmarks...
                  </td>
                </tr>
              ) : (
                benchmarks.map((b) => {
                  const isEditing = editingId === b.id;

                  return (
                    <tr key={b.id} className="hover:bg-[#FAF9F5]/70 transition-colors">
                      <td className="px-4 py-3 font-bold text-[#152220] capitalize">
                        {b.category}
                      </td>
                      <td className="px-4 py-3 text-[#576563]">{b.city}</td>

                      {/* Min Floor */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.min}
                            onChange={(e) =>
                              setEditForm({ ...editForm, min: Number(e.target.value) })
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-[#E5DFD2] bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0D4A52]"
                          />
                        ) : (
                          <span className="font-semibold text-[#152220]">₹{b.minPriceInr}</span>
                        )}
                      </td>

                      {/* Typical Price */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.typical}
                            onChange={(e) =>
                              setEditForm({ ...editForm, typical: Number(e.target.value) })
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-[#E5DFD2] bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0D4A52]"
                          />
                        ) : (
                          <span className="font-bold text-[#0D4A52]">₹{b.typicalPriceInr}</span>
                        )}
                      </td>

                      {/* Max Cap */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.max}
                            onChange={(e) =>
                              setEditForm({ ...editForm, max: Number(e.target.value) })
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-[#E5DFD2] bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0D4A52]"
                          />
                        ) : (
                          <span className="font-semibold text-[#152220]">₹{b.maxPriceInr}</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-[#217E66] font-bold">
                        ₹{b.avgAcceptedBidInr || b.typicalPriceInr}
                      </td>

                      <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => saveEditing(b)}
                              className="rounded-lg text-xs py-1 bg-[#217E66] hover:bg-[#165646]"
                            >
                              <Check className="w-3.5 h-3.5 mr-1" /> Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEditing}
                              className="rounded-lg text-xs py-1"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => startEditing(b)}
                            className="rounded-lg text-xs py-1"
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
