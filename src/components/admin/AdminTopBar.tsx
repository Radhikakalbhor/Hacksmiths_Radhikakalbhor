'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Menu,
  Search,
  Bell,
  Shield,
  LogOut,
  ChevronDown,
  AlertTriangle,
  User,
  CheckCircle2,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface AdminTopBarProps {
  onOpenMobileMenu: () => void;
  adminName?: string;
  adminEmail?: string;
}

export function AdminTopBar({
  onOpenMobileMenu,
  adminName = 'Super Administrator',
  adminEmail = 'admin@sahayak.internal',
}: AdminTopBarProps) {
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/admin/jobs?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSignOut = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch {
      // Ignored
    }
    router.push('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-[#E5DFD2] px-4 md:px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
      {/* Left: Mobile hamburger & Global Search */}
      <div className="flex items-center gap-3 flex-1 max-w-lg">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-xl text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]"
          aria-label="Open navigation drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Admin Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#576563]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search jobs, pincodes, phone numbers, workers..."
            className="w-full text-xs md:text-sm pl-10 pr-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#E5DFD2] focus:outline-none focus:ring-2 focus:ring-[#0D4A52] focus:bg-white placeholder:text-[#576563]/60 transition-all"
          />
        </form>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        {/* Status Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>PostGIS Active</span>
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            aria-label="Open notifications menu"
            className="relative p-2 rounded-xl text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6] transition-colors"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-[#E5DFD2] p-4 space-y-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-[#E5DFD2]">
                <span className="text-xs font-bold text-[#152220] uppercase tracking-wider">
                  Admin Alerts
                </span>
                <span className="text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  1 Urgent SOS
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <Link
                  href="/admin/sos"
                  onClick={() => setShowNotifications(false)}
                  className="block p-2.5 rounded-xl bg-red-50 hover:bg-red-100/80 border border-red-200 transition-colors"
                >
                  <div className="flex items-center gap-2 text-red-700 font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Emergency SOS Alert</span>
                  </div>
                  <p className="text-red-600 mt-1">Bandra West service location triggered safety panic.</p>
                </Link>

                <Link
                  href="/admin/verification"
                  onClick={() => setShowNotifications(false)}
                  className="block p-2.5 rounded-xl bg-[#FAF9F5] hover:bg-[#F3EFE6] border border-[#E5DFD2] transition-colors"
                >
                  <div className="flex items-center gap-2 text-[#0D4A52] font-semibold">
                    <Shield className="w-4 h-4 shrink-0 text-[#217E66]" />
                    <span>3 Pending Worker Approvals</span>
                  </div>
                  <p className="text-[#576563] mt-0.5">Aadhaar & Police Clearances awaiting review.</p>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Admin Avatar Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            aria-label="Open admin profile menu"
            className="flex items-center gap-2.5 p-1.5 pl-2.5 rounded-xl hover:bg-[#F3EFE6] transition-colors border border-transparent hover:border-[#E5DFD2]"
          >
            <div className="w-8 h-8 rounded-full bg-[#0D4A52] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              AD
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-bold text-[#152220] leading-none">{adminName}</span>
              <span className="text-[10px] font-semibold text-[#217E66] uppercase tracking-wider mt-0.5">
                ADMIN
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#576563]" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-[#E5DFD2] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-2 border-b border-[#E5DFD2]/60">
                <p className="text-xs font-bold text-[#152220] truncate">{adminName}</p>
                <p className="text-[11px] text-[#576563] truncate">{adminEmail}</p>
                <div className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Service Role Guarded</span>
                </div>
              </div>

              <div className="py-1">
                <Link
                  href="/dashboard"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2 px-4 py-2 text-xs text-[#152220] hover:bg-[#F3EFE6]"
                >
                  <User className="w-4 h-4 text-[#576563]" />
                  <span>Switch to Customer View</span>
                </Link>

                <Link
                  href="/dashboard?role=worker"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2 px-4 py-2 text-xs text-[#152220] hover:bg-[#F3EFE6]"
                >
                  <Shield className="w-4 h-4 text-[#576563]" />
                  <span>Switch to Partner View</span>
                </Link>
              </div>

              <div className="pt-1 border-t border-[#E5DFD2]/60">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-600 hover:bg-red-50 text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

