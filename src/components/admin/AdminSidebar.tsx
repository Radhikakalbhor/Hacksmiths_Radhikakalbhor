'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  Briefcase,
  AlertOctagon,
  Scale,
  Star,
  Coins,
  MapPin,
  Bot,
  Megaphone,
  FileText,
  Activity,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
} from 'lucide-react';

interface AdminSidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (val: boolean) => void;
  pendingVerificationsCount?: number;
  openSosCount?: number;
}

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/verification', label: 'Verification Queue', icon: ShieldCheck, badgeKey: 'verification' },
  { href: '/admin/users', label: 'Users Directory', icon: Users },
  { href: '/admin/jobs', label: 'Jobs Manager', icon: Briefcase },
  { href: '/admin/sos', label: 'SOS Console', icon: AlertOctagon, badgeKey: 'sos', isDanger: true },
  { href: '/admin/disputes', label: 'Disputes & Claims', icon: Scale },
  { href: '/admin/reviews', label: 'Review Moderation', icon: Star },
  { href: '/admin/pricing', label: 'Pricing Benchmarks', icon: Coins },
  { href: '/admin/categories', label: 'Categories & Areas', icon: MapPin },
  { href: '/admin/ai-logs', label: 'AI Prompt Logs', icon: Bot },
  { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/admin/audit-log', label: 'Audit Trail', icon: FileText },
  { href: '/admin/system-health', label: 'System Health', icon: Activity },
];

export function AdminSidebar({
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
  pendingVerificationsCount = 3,
  openSosCount = 1,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <aside
      className={`h-full flex flex-col bg-white border-r border-[#E5DFD2] transition-all duration-300 select-none ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#E5DFD2]/70">
        <Link href="/admin" className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0D4A52] to-[#217E66] flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
            S
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-[#0D4A52] leading-none">
                Sahayak
              </span>
              <span className="text-[10px] font-semibold tracking-wider text-[#217E66] uppercase mt-0.5">
                Admin Console
              </span>
            </div>
          )}
        </Link>

        {/* Desktop Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden md:flex p-1.5 rounded-lg text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6] transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Mobile Close Button */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden p-1.5 rounded-lg text-[#576563] hover:bg-[#F3EFE6]"
          aria-label="Close mobile navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));

          const badgeCount =
            item.badgeKey === 'verification'
              ? pendingVerificationsCount
              : item.badgeKey === 'sos'
              ? openSosCount
              : 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
                isActive
                  ? 'bg-[#0D4A52] text-white shadow-xs font-semibold'
                  : 'text-[#576563] hover:text-[#152220] hover:bg-[#F3EFE6]'
              }`}
            >
              <Icon
                className={`w-5 h-5 shrink-0 ${
                  isActive
                    ? 'text-white'
                    : item.isDanger
                    ? 'text-red-500 group-hover:text-red-600'
                    : 'text-[#576563] group-hover:text-[#0D4A52]'
                }`}
              />

              {!isCollapsed && <span className="truncate flex-1">{item.label}</span>}

              {/* Notifications Pill */}
              {badgeCount > 0 && !isCollapsed && (
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    item.isDanger
                      ? 'bg-red-500 text-white animate-pulse'
                      : isActive
                      ? 'bg-[#217E66] text-white'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}
                >
                  {badgeCount}
                </span>
              )}

              {/* Collapsed notification pip indicator */}
              {badgeCount > 0 && isCollapsed && (
                <span
                  className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                    item.isDanger ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Return Link */}
      <div className="p-3 border-t border-[#E5DFD2]/70">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6] transition-colors"
        >
          <ExternalLink className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Back to Main Marketplace</span>}
        </Link>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block shrink-0 h-screen sticky top-0 z-30">
        {sidebarContent}
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex md:hidden bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
          <div className="flex-1" onClick={() => setIsMobileOpen(false)} />
        </div>
      )}
    </>
  );
}

