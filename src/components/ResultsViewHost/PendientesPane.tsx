"use client";

import React, { useState } from "react";
import { CheckSquare, Plus, Trash2, Calendar, CheckCircle2 } from "lucide-react";
import { PendingTaskItem } from "@/types/anfeta";
import { playTickSound, triggerConfetti } from "@/utils/soundAndFx";
import { formatSmartDate } from "@/lib/dateUtils";

interface PendientesPaneProps {
  items: PendingTaskItem[];
  onToggleItem: (id: string) => void;
  onAddItem: (item: Omit<PendingTaskItem, "id">) => void;
  onDeleteItem: (id: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function PendientesPane({
  items,
  onToggleItem,
  onAddItem,
  onDeleteItem,
}: PendientesPaneProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [scheduledDate, setScheduledDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const handleQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setScheduledDate(d.toISOString().split("T")[0]);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddItem({
      title: title.trim(),
      scheduledDate,
      query: title.trim(),
      isCompleted: false,
    });
    setTitle("");
    setShowAddForm(false);
  };

  const pendingCount = items.filter((i) => !i.isCompleted).length;

  return (
    <aside className="w-64 bg-[#0F141A] border-r border-[#26323E] flex flex-col flex-shrink-0 select-none">
      {/* Pane header */}
      <div className="h-10 px-3 border-b border-[#26323E] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-[#00A8FF]" />
          <span className="text-xs font-semibold text-[#E2E8F0]">Pendientes</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#18212B] text-[#00A8FF] border border-[#223848]">
            {pendingCount}
          </span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="p-1 text-[#94A3B8] hover:text-[#00A8FF] hover:bg-[#131A22] rounded transition-colors"
          title="Añadir pendiente"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Add Task Form (Expandable) */}
      {showAddForm && (
        <form onSubmit={handleCreate} className="p-3 bg-[#131A22] border-b border-[#26323E] space-y-2">
          <input
            type="text"
            placeholder="Título del pendiente..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-8 px-2 bg-[#080B0F] text-xs text-[#F1F5F9] border border-[#26323E] rounded focus:border-[#00A8FF] focus:outline-none"
            autoFocus
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleQuickDate(0)}
              className="px-2 py-0.5 text-[10px] rounded bg-[#080B0F] hover:bg-[#18212B] text-[#94A3B8] border border-[#26323E]"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => handleQuickDate(1)}
              className="px-2 py-0.5 text-[10px] rounded bg-[#080B0F] hover:bg-[#18212B] text-[#94A3B8] border border-[#26323E]"
            >
              Mañana
            </button>
            <button
              type="button"
              onClick={() => handleQuickDate(3)}
              className="px-2 py-0.5 text-[10px] rounded bg-[#080B0F] hover:bg-[#18212B] text-[#94A3B8] border border-[#26323E]"
            >
              +3d
            </button>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-[#64748B] flex items-center gap-1 font-mono">
              <Calendar className="w-3 h-3" /> {scheduledDate}
            </span>
            <button
              type="submit"
              className="px-3 py-1 bg-[#00A8FF] hover:bg-[#1FB6FF] text-[#080B0F] text-xs font-bold rounded"
            >
              Guardar
            </button>
          </div>
        </form>
      )}

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
        {items.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#64748B]">
            No hay pendientes registrados
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`group flex items-start justify-between gap-2 p-2 rounded border transition-colors ${
                item.isCompleted
                  ? "bg-[#0A1118]/40 border-[#1B2735] opacity-60"
                  : "bg-[#11161C] border-[#223848] hover:border-[#00A8FF]/40"
              }`}
            >
              <div
                className="flex items-start gap-2 flex-1 cursor-pointer"
                onClick={() => {
                  playTickSound();
                  if (!item.isCompleted) triggerConfetti();
                  onToggleItem(item.id);
                }}
              >
                <button className="mt-0.5 text-[#94A3B8] hover:text-[#4ADE80]">
                  {item.isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded border border-[#64748B] hover:border-[#00A8FF]" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs break-words ${
                      item.isCompleted ? "line-through text-[#64748B]" : "text-[#E2E8F0]"
                    }`}
                  >
                    {item.title}
                  </p>
                  <span className="text-[10px] font-mono text-[#64748B]">
                    {formatSmartDate(item.scheduledDate)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onDeleteItem(item.id)}
                className="opacity-0 group-hover:opacity-100 text-[#64748B] hover:text-[#FB7185] transition-opacity p-0.5"
                title="Eliminar"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
