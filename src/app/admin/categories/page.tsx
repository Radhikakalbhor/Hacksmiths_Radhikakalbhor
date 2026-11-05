'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  Wrench,
  Zap,
  Sparkles,
  Paintbrush,
  Hammer,
  Cpu,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/admin/ToastContext';

interface CategoryConfig {
  id: string;
  code: string;
  name: string;
  iconName: string;
  isEnabled: boolean;
  supportedCities: string[];
  supportedPincodes: string[];
  defaultRadiusKm: number;
}

export default function CategoriesAndAreasPage() {
  const { success, error } = useToast();
  const [categories, setCategories] = useState<CategoryConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/categories');
      const json = await res.json();
      if (json.success && json.data) {
        setCategories(json.data);
      }
    } catch {
      error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const res = await fetch('/api/admin/categories');
        const json = await res.json();
        if (!cancelled && json.success && json.data) {
          setCategories(json.data);
        }
      } catch {
        if (!cancelled) error('Failed to load categories');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [error]);

  const toggleCategory = async (code: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryCode: code,
          isEnabled: !currentStatus,
        }),
      });

      const json = await res.json();
      if (json.success) {
        success(`Category ${code} ${!currentStatus ? 'enabled' : 'disabled'}.`);
        loadCategories();
      } else {
        error('Failed to update category status.');
      }
    } catch {
      error('Error updating category.');
    }
  };

  const getCategoryIcon = (icon: string) => {
    switch (icon) {
      case 'Wrench':
        return <Wrench className="w-5 h-5 text-[#0D4A52]" />;
      case 'Zap':
        return <Zap className="w-5 h-5 text-amber-600" />;
      case 'Sparkles':
        return <Sparkles className="w-5 h-5 text-teal-600" />;
      case 'Paintbrush':
        return <Paintbrush className="w-5 h-5 text-purple-600" />;
      case 'Hammer':
        return <Hammer className="w-5 h-5 text-orange-600" />;
      default:
        return <Cpu className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-[#0D4A52]">
              <MapPin className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-[#152220]">Service Categories & Coverage Areas</h1>
          </div>
          <p className="text-xs md:text-sm text-[#576563] mt-1">
            Activate or deactivate trade categories, assign supported cities, and adjust matching radii.
          </p>
        </div>
      </div>

      {/* Categories Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-3 py-16 text-center text-xs text-[#576563]">
            Loading category configuration...
          </div>
        ) : (
          categories.map((cat) => (
            <Card
              key={cat.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                cat.isEnabled ? 'bg-white border-[#E5DFD2]' : 'bg-[#FAF9F5] border-gray-200 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#FAF9F5] border border-[#E5DFD2]">
                    {getCategoryIcon(cat.iconName)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#152220]">{cat.name}</h3>
                    <code className="text-[10px] text-[#576563] bg-[#FAF9F5] px-1.5 py-0.5 rounded border border-[#E5DFD2]">
                      {cat.code}
                    </code>
                  </div>
                </div>

                <button
                  onClick={() => toggleCategory(cat.code, cat.isEnabled)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                    cat.isEnabled
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {cat.isEnabled ? 'Active' : 'Disabled'}
                </button>
              </div>

              {/* Supported Cities & Radius */}
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[11px] font-semibold text-[#576563] block">
                    Supported Metro Cities:
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {cat.supportedCities.map((city) => (
                      <span
                        key={city}
                        className="px-2 py-0.5 rounded-md bg-[#FAF9F5] border border-[#E5DFD2] text-[10px] font-medium text-[#152220]"
                      >
                        {city}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E5DFD2]/60 flex items-center justify-between text-[#576563]">
                  <span>Default Discovery Radius:</span>
                  <span className="font-bold text-[#0D4A52]">{cat.defaultRadiusKm} km</span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
