"use client";

import React, { useState } from "react";
import { PendingTaskItem } from "@/types/anfeta";

interface PendingTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<PendingTaskItem, "id">, editId?: string) => void;
  taskToEdit?: PendingTaskItem | null;
  initialQuery?: string;
  currentUser?: string;
}

const COLLABORATORS = [
  { id: "", label: "Sin asignar (Para mí / Personal)" },
  { id: "John", label: "John" },
  { id: "Edwin", label: "Edwin" },
  { id: "Karla", label: "Karla" },
  { id: "Brian", label: "Brian" },
  { id: "Genaro", label: "Genaro" },
  { id: "Isaias", label: "Isaias" },
  { id: "Andrade", label: "Andrade" },
  { id: "Sotelo", label: "Sotelo" },
  { id: "Acalli", label: "Acalli" },
  { id: "Neftali", label: "Neftali" },
];

export function PendingTaskModal({ isOpen, onClose, onSave, taskToEdit, initialQuery = "", currentUser }: PendingTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [scheduledDate, setScheduledDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [query, setQuery] = useState("");

  React.useEffect(() => {
    if (isOpen) {
      if (taskToEdit) {
        setTitle(taskToEdit.title || "");
        setDescription(taskToEdit.description || "");
        setAssignedTo(taskToEdit.assignedTo || "");
        setScheduledDate(taskToEdit.scheduledDate || "");
        setQuery(taskToEdit.query || "");
      } else {
        const domInput = typeof document !== "undefined"
          ? (document.querySelector('input[placeholder*="Buscar"], input[type="search"], input[data-search-input]') as HTMLInputElement)?.value
          : "";
        const defaultText = (initialQuery || domInput || "").trim();
        setTitle(defaultText);
        setDescription("");
        setAssignedTo("");
        setScheduledDate(new Date().toISOString().split("T")[0]);
        setQuery(defaultText);
      }
    }
  }, [isOpen, taskToEdit, initialQuery]);

  if (!isOpen) return null;

  const setDateByOffset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setScheduledDate(d.toISOString().split("T")[0]);
  };

  const setNextMonday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() + (day === 0 ? 1 : 8 - day);
    d.setDate(diff);
    setScheduledDate(d.toISOString().split("T")[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        scheduledDate,
        query: query.trim() || title.trim(),
        isCompleted: taskToEdit ? taskToEdit.isCompleted : false,
        isAttended: taskToEdit ? taskToEdit.isAttended : false,
        isArchived: taskToEdit ? taskToEdit.isArchived : false,
        assignedTo: assignedTo.trim() || undefined,
        assignedBy: assignedTo.trim() ? (taskToEdit?.assignedBy || currentUser || "Neftali") : undefined,
        assignedAt: assignedTo.trim() ? (taskToEdit?.assignedAt || new Date().toISOString()) : undefined,
      },
      taskToEdit?.id
    );
    setTitle("");
    setDescription("");
    setAssignedTo("");
    setQuery("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 sm:pt-10 overflow-y-auto bg-black/70 backdrop-blur-sm p-4 select-none">
      <div className="w-[440px] bg-[#111822] border border-[#253549] rounded-xl shadow-2xl p-4 space-y-3">
        {/* Header Card Ámbar */}
        <div className="flex items-center gap-3 p-3 bg-[#28F59E0B] border border-[#78F59E0B] rounded-lg">
          <div className="w-9 h-9 rounded-md bg-[#50D97706] border border-[#FBBF24] flex items-center justify-center text-lg shrink-0">
            📋
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#FDE68A]">
              {taskToEdit ? "Editar Pendiente" : "Nuevo Pendiente"}
            </h3>
            <p className="text-[10px] text-[#CBD5E1]">
              {taskToEdit
                ? "Modifica el título, fecha programada o término de búsqueda."
                : "Organiza tus tareas con fecha agendada y filtro de búsqueda."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Campo Título */}
          <div>
            <label className="block text-[11px] font-semibold text-[#E2E8F0] mb-1">
              Título de la tarea o pendiente:
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Revisar cotización y métricas..."
              className="w-full h-8 px-2.5 bg-[#141B26] text-[#F8FAFC] border border-[#26354A] rounded text-xs focus:border-[#38BDF8] focus:outline-none"
              autoFocus
            />
          </div>

          {/* Campo Asignar a otro usuario (Desplegable) */}
          <div>
            <label className="block text-[11px] font-semibold text-[#E2E8F0] mb-1">
              Asignar a compañero (opcional):
            </label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full h-8 px-2 bg-[#141B26] text-[#F8FAFC] border border-[#26354A] rounded text-xs focus:border-[#38BDF8] focus:outline-none cursor-pointer"
            >
              {COLLABORATORS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            {assignedTo && (
              <p className="text-[10px] text-cyan-400 mt-1">
                🔔 Se notificará a {assignedTo} indicándole que le asignaste este pendiente.
              </p>
            )}
          </div>

          {/* Campo Descripción opcional */}
          <div>
            <label className="block text-[11px] font-semibold text-[#E2E8F0] mb-1">
              Descripción o notas adicionales (opcional):
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Detalles sobre el pendiente, fase o contexto..."
              className="w-full p-2 bg-[#141B26] text-[#F8FAFC] border border-[#26354A] rounded text-xs focus:border-[#38BDF8] focus:outline-none resize-none"
            />
          </div>

          {/* Campo Fecha Programada + Chips Rápidos */}
          <div>
            <label className="block text-[11px] font-semibold text-[#E2E8F0] mb-1">
              Fecha programada (ej. dd/MM o dd/MM/yyyy):
            </label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full h-8 px-2.5 bg-[#141B26] text-[#F8FAFC] border border-[#26354A] rounded text-xs focus:border-[#38BDF8] focus:outline-none mb-1.5"
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDateByOffset(0)}
                className="px-2 py-0.5 rounded bg-[#1A2D3E] border border-[#38BDF8] text-[#7DD3FC] text-[10px] hover:bg-[#1E3A5F]"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => setDateByOffset(1)}
                className="px-2 py-0.5 rounded bg-[#1A2D3E] border border-[#38BDF8] text-[#7DD3FC] text-[10px] hover:bg-[#1E3A5F]"
              >
                Mañana
              </button>
              <button
                type="button"
                onClick={() => setDateByOffset(3)}
                className="px-2 py-0.5 rounded bg-[#1A2D3E] border border-[#38BDF8] text-[#7DD3FC] text-[10px] hover:bg-[#1E3A5F]"
              >
                +3 Días
              </button>
              <button
                type="button"
                onClick={setNextMonday}
                className="px-2 py-0.5 rounded bg-[#1A2D3E] border border-[#38BDF8] text-[#7DD3FC] text-[10px] hover:bg-[#1E3A5F]"
              >
                Próx. Lunes
              </button>
              <button
                type="button"
                onClick={() => setScheduledDate("")}
                className="px-2 py-0.5 rounded bg-[#161F2C] border border-[#26354A] text-[#94A3B8] text-[10px] hover:bg-[#1E2836]"
              >
                Sin fecha
              </button>
            </div>
          </div>

          {/* Campo Búsqueda Vinculada */}
          <div>
            <label className="block text-[11px] font-semibold text-[#E2E8F0] mb-1">
              Filtro o búsqueda vinculada (opcional):
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej. anfeta.com o #tag..."
              className="w-full h-8 px-2.5 bg-[#141B26] text-[#F8FAFC] border border-[#26354A] rounded text-xs focus:border-[#38BDF8] focus:outline-none"
            />
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-between pt-2 border-t border-[#1E2836]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded bg-[#161F2C] border border-[#26354A] text-[#CBD5E1] text-xs hover:bg-[#1E2836]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-[#0C4A6E] border border-[#38BDF8] text-[#38BDF8] text-xs font-bold hover:bg-[#0284C7] hover:text-white transition-colors"
            >
              {taskToEdit ? "Guardar cambios" : "Guardar pendiente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
