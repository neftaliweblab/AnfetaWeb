"use client";

import React from "react";
import { Users, Check, X } from "lucide-react";
import { getPersonColor } from "@/services/identityNormalizer";

interface CalendarPeoplePickerModalProps {
  allPeople: string[];
  visiblePeople: string[];
  onTogglePerson: (person: string) => void;
  onClose: () => void;
}

export function CalendarPeoplePickerModal({
  allPeople,
  visiblePeople,
  onTogglePerson,
  onClose,
}: CalendarPeoplePickerModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#0F141A] border border-[#26323E] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-11 px-4 border-b border-[#26323E] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#00A8FF]" />
            <h3 className="text-xs font-bold text-[#F1F5F9]">
              Configurar Colaboradores Visibles
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#F1F5F9] p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 max-h-72 overflow-y-auto space-y-1.5 scrollbar-thin">
          {allPeople.map((p) => {
            const isVisible = visiblePeople.includes(p);
            const color = getPersonColor(p);
            return (
              <div
                key={p}
                onClick={() => onTogglePerson(p)}
                className={`flex items-center justify-between p-2 rounded cursor-pointer border transition-colors ${
                  isVisible
                    ? "bg-[#18212B] border-[#00A8FF]/40 text-[#F1F5F9]"
                    : "bg-[#11161C] border-[#223848] text-[#64748B]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs font-medium">{p}</span>
                </div>
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border ${
                    isVisible
                      ? "bg-[#00A8FF] border-[#00A8FF] text-[#080B0F]"
                      : "border-[#64748B]"
                  }`}
                >
                  {isVisible && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t border-[#26323E] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#00A8FF] hover:bg-[#1FB6FF] text-[#080B0F] text-xs font-bold rounded"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
