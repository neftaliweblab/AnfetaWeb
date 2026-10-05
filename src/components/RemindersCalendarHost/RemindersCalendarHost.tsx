"use client";

import React, { useState } from "react";
import { Bell, Plus, CheckCircle, Clock } from "lucide-react";
import { ReminderItem } from "@/types/anfeta";
import { playTickSound, triggerConfetti } from "@/utils/soundAndFx";

const SAMPLE_REMINDERS: ReminderItem[] = [
  {
    id: "r1",
    title: "Revisión matutina de tickets urgentes",
    dueTime: "08:30",
    dueDate: "2026-10-03",
    category: "Operaciones",
    isCompleted: true,
    priority: "high",
  },
  {
    id: "r2",
    title: "Sincronización semanal de métricas ejecutivas",
    dueTime: "11:00",
    dueDate: "2026-10-03",
    category: "Reunión",
    isCompleted: false,
    priority: "urgent",
  },
  {
    id: "r3",
    title: "Respaldo local de caché de base de datos",
    dueTime: "16:00",
    dueDate: "2026-10-03",
    category: "Sistema",
    isCompleted: false,
    priority: "medium",
  },
];

export function RemindersCalendarHost() {
  const [reminders, setReminders] = useState<ReminderItem[]>(SAMPLE_REMINDERS);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("12:00");

  const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const item: ReminderItem = {
      id: `r_${Date.now()}`,
      title: newTitle.trim(),
      dueTime: newTime,
      dueDate: new Date().toISOString().split("T")[0],
      category: "Personal",
      isCompleted: false,
      priority: "medium",
    };

    setReminders([...reminders, item]);
    setNewTitle("");
    playTickSound();
  };

  const handleToggle = (id: string) => {
    setReminders((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const next = !r.isCompleted;
          if (next) triggerConfetti();
          playTickSound();
          return { ...r, isCompleted: next };
        }
        return r;
      })
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080B0F] select-none overflow-hidden">
      {/* Header */}
      <div className="h-12 bg-[#0F141A] border-b border-[#26323E] px-4 flex items-center justify-between flex-shrink-0 overflow-x-auto scrollbar-none gap-2">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#A855F7]" />
          <h3 className="text-xs font-bold text-[#F1F5F9]">
            Canvas de Recordatorios 24 Horas
          </h3>
          <span className="text-[10px] font-mono text-[#A855F7] bg-[#18212B] px-2 py-0.5 rounded border border-[#5B2A86]">
            {reminders.filter((r) => !r.isCompleted).length} activos
          </span>
        </div>

        {/* Quick add form */}
        <form onSubmit={handleAddReminder} className="flex items-center gap-2">
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="h-8 px-2 bg-[#080B0F] text-xs font-mono text-[#F1F5F9] rounded border border-[#26323E]"
          />
          <input
            type="text"
            placeholder="Nuevo recordatorio..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="h-8 px-3 bg-[#080B0F] text-xs text-[#F1F5F9] rounded border border-[#26323E] w-48"
          />
          <button
            type="submit"
            className="h-8 px-3 bg-[#A855F7] hover:bg-[#B366FF] text-[#080B0F] font-bold rounded text-xs flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar</span>
          </button>
        </form>
      </div>

      {/* 24 Hour Timeline Canvas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
        {hours.map((hour) => {
          const hourPrefix = hour.slice(0, 2);
          const hourReminders = reminders.filter((r) => r.dueTime.startsWith(hourPrefix));

          return (
            <div
              key={hour}
              className="flex items-start gap-4 p-2 rounded border border-[#161F2B] hover:border-[#26323E] bg-[#0A1118]/50"
            >
              <span className="w-12 font-mono text-xs text-[#64748B] pt-1">
                {hour}
              </span>

              <div className="flex-1 flex flex-wrap gap-2">
                {hourReminders.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => handleToggle(r.id)}
                    className={`p-2.5 rounded border cursor-pointer flex items-center gap-2.5 transition-all ${
                      r.isCompleted
                        ? "bg-[#0F141A] border-[#1B2735] opacity-50 line-through text-[#64748B]"
                        : "bg-[#18212B] border-[#A855F7]/40 text-[#F1F5F9] shadow-[0_0_8px_rgba(168,85,247,0.15)]"
                    }`}
                  >
                    <CheckCircle
                      className={`w-4 h-4 ${
                        r.isCompleted ? "text-[#4ADE80]" : "text-[#A855F7]"
                      }`}
                    />
                    <div className="text-xs">
                      <span className="font-semibold">{r.title}</span>
                      <span className="text-[10px] font-mono text-[#94A3B8] ml-2">
                        {r.dueTime}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
