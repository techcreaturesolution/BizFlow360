"use client";

import React, { useState } from "react";
import { SuperAdminGuard } from "@/components/super-admin/SuperAdminGuard";
import { Sidebar } from "@/components/super-admin/Sidebar";
import { Topbar } from "@/components/super-admin/Topbar";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <SuperAdminGuard>
      <div className="min-h-screen bg-slate-50 flex">
        {/* Left Navigation Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Right Main Content */}
        <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
          <Topbar
            onMenuToggle={() => setIsSidebarOpen((prev) => !prev)}
            title="Super Admin Platform"
            description="Multi-tenant cloud infrastructure and lifecycle management"
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SuperAdminGuard>
  );
}
