'use client';

import React, { useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopBar } from './AdminTopBar';
import { ToastProvider } from './ToastContext';

interface AdminLayoutClientProps {
  children: React.ReactNode;
  adminName?: string;
  adminEmail?: string;
}

export function AdminLayoutClient({
  children,
  adminName = 'Super Administrator',
  adminEmail = 'admin@sahayak.internal',
}: AdminLayoutClientProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#FAF9F5] flex text-[#152220]">
        {/* Left Sidebar */}
        <AdminSidebar
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          isMobileOpen={isMobileOpen}
          setIsMobileOpen={setIsMobileOpen}
        />

        {/* Right Main Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <AdminTopBar
            onOpenMobileMenu={() => setIsMobileOpen(true)}
            adminName={adminName}
            adminEmail={adminEmail}
          />

          <main className="flex-1 overflow-x-hidden p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

