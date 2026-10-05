"use client";

import React from "react";
import { CheckCircle2, HardDrive, RefreshCw, User, Volume2 } from "lucide-react";

interface StatusBarProps {
  indexedCount: number;
  currentUser: string;
  lastSyncTime?: string;
}

export function StatusBar({
  indexedCount,
  currentUser,
  lastSyncTime = "En línea (0ms)",
}: StatusBarProps) {
  return (
    <footer className="h-7 bg-[#0B0F14] border-t border-[#26323E] px-4 flex items-center justify-between text-[11px] font-mono text-[#64748B] select-none flex-shrink-0 z-40 overflow-x-auto scrollbar-none">
      {/* Left system status items */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-[#4ADE80]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
          <span>Windows 11 DWM · 60 FPS</span>
        </div>

        <div className="flex items-center gap-1.5 text-[#94A3B8]">
          <HardDrive className="w-3 h-3 text-[#38BDF8]" />
          <span>{indexedCount.toLocaleString()} elementos indexados</span>
        </div>

        <div className="flex items-center gap-1.5 text-[#94A3B8]">
          <RefreshCw className="w-3 h-3 text-[#A855F7]" />
          <span>Notion Sync: {lastSyncTime}</span>
        </div>
      </div>

      {/* Right user & audio status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-[#38BDF8]">
          <Volume2 className="w-3 h-3 text-[#4ADE80]" />
          <span>WASAPI / MMDevice Activo</span>
        </div>

        <div className="flex items-center gap-1.5 text-[#E2E8F0] font-semibold">
          <User className="w-3 h-3 text-[#00A8FF]" />
          <span>Usuario: {currentUser}</span>
        </div>
      </div>
    </footer>
  );
}
