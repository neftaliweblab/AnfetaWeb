"use client";

import React, { useState } from "react";
import { PendingTaskItem } from "@/types/anfeta";
import { stripLeadingScheduleTime } from "@/lib/scheduleHelpers";

interface PendingTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<PendingTaskItem, "id">, editId?: string) => void;
  taskToEdit?: PendingTaskItem | null;
  initialQuery?: string;
  initialTitle?: string;
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

export function PendingTaskModal({ isOpen, onClose, onSave, taskToEdit, initialQuery = "", initialTitle = "", currentUser }: PendingTaskModalProps) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [timeHour, setTimeHour] = useState("");
  const [timeMeridian, setTimeMeridian] = useState<"AM" | "PM">("AM");
  const [assignedTo, setAssignedTo] = useState("");
  const [scheduledDate, setScheduledDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [query, setQuery] = useState("");

  React.useEffect(() => {
    if (isOpen) {
      if (taskToEdit) {
        const cleanedTitle = stripLeadingScheduleTime(taskToEdit.title || "");
        setTitle(cleanedTitle || taskToEdit.title || "");
        setNote(taskToEdit.note || "");
        setDescription(taskToEdit.description || "");
        setUrl(taskToEdit.url || "");
        setAssignedTo(taskToEdit.assignedTo || "");
        setScheduledDate(taskToEdit.scheduledDate || "");
        setQuery(taskToEdit.query || "");

        // Preferir campo dedicado startTime; si no existe, extraer de título heredado
        if (taskToEdit.startTime && /^\d{1,2}:\d{2}$/.test(taskToEdit.startTime.trim())) {
          const [sh, sm] = taskToEdit.startTime.trim().split(":").map((v) => parseInt(v || "0", 10));
          const mer: "AM" | "PM" = sh >= 12 ? "PM" : "AM";
          const dispH = sh % 12 || 12;
          setTimeHour(`${String(dispH).padStart(2, "0")}:${String(sm).padStart(2, "0")}`);
          setTimeMeridian(mer);
        } else {
          const timeMatch = (taskToEdit.title || "").match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/i);
          if (timeMatch) {
            const hRaw = parseInt(timeMatch[1], 10);
            const m = timeMatch[2] || "00";
            const mer = timeMatch[3]?.toUpperCase() as ("AM" | "PM" | undefined);
            const inferredMer = mer || ((hRaw >= 1 && hRaw <= 6) || hRaw >= 12 ? "PM" : "AM");
            const dispH = hRaw > 12 ? hRaw % 12 || 12 : hRaw;
            setTimeHour(`${String(dispH).padStart(2, "0")}:${m}`);
            setTimeMeridian(inferredMer);
          } else {
            setTimeHour("");
            setTimeMeridian("AM");
          }
        }
      } else {
        const domInput = typeof document !== "undefined"
          ? (document.querySelector('input[placeholder*="Buscar"], input[type="search"], input[data-search-input]') as HTMLInputElement)?.value
          : "";
        const cleanInitial = stripLeadingScheduleTime(initialTitle || "");
        const defaultText = (cleanInitial || initialQuery || domInput || "").trim();
        setTitle(defaultText);
        setNote("");
        setDescription("");
        setUrl("");
        setAssignedTo("");
        setScheduledDate(new Date().toISOString().split("T")[0]);
        setQuery(initialQuery || cleanInitial || defaultText);

        // Si viene con hora inicial (ej. al dar clic en slot libre como "09:00" o "18:00")
        const slotMatch = (initialTitle || "").match(/(\d{1,2}):(\d{2})/);
        if (slotMatch) {
          const h = parseInt(slotMatch[1], 10);
          const mer: "AM" | "PM" = h >= 12 ? "PM" : h >= 1 && h <= 6 ? "PM" : "AM";
          const dispH = h > 12 ? h % 12 || 12 : h === 0 ? 12 : h;
          setTimeHour(`${String(dispH).padStart(2, "0")}:${slotMatch[2]}`);
          setTimeMeridian(mer);
        } else {
          setTimeHour("");
          setTimeMeridian("AM");
        }
      }
    }
  }, [isOpen, taskToEdit, initialQuery, initialTitle]);

  if (!isOpen) return null;

  const isAssignedFromOther = Boolean(
    taskToEdit &&
    taskToEdit.assignedBy &&
    taskToEdit.assignedTo &&
    taskToEdit.assignedBy !== currentUser
  );

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
    if (!title.trim() || !query.trim()) return;

    // Guardar la hora en campo dedicado startTime sin contaminar el título con AM/PM
    let computedStartTime: string | undefined;
    const rawTime = timeHour.trim();
    if (rawTime) {
      const m = rawTime.match(/^(\d{1,2})(?:[:.](\d{2}))?/);
      if (m) {
        let h = parseInt(m[1], 10);
        const min = Math.min(59, Math.max(0, parseInt(m[2] || "0", 10)));
        if (h >= 0 && h <= 23) {
          if (h <= 12) {
            if (timeMeridian === "PM" && h < 12) h += 12;
            else if (timeMeridian === "AM" && h === 12) h = 0;
          }
          computedStartTime = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
        }
      }
    }
    const cleanTitle = stripLeadingScheduleTime(title.trim()) || title.trim();

    onSave(
      {
        title: cleanTitle,
        note: note.trim() || undefined,
        description: description.trim() || undefined,
        url: url.trim() || undefined,
        scheduledDate,
        startTime: computedStartTime,
        endTime: computedStartTime === taskToEdit?.startTime ? taskToEdit?.endTime : undefined,
        isPostMidnight: taskToEdit?.isPostMidnight,
        query: query.trim(),
        isCompleted: taskToEdit ? taskToEdit.isCompleted : false,
        isAttended: taskToEdit ? taskToEdit.isAttended : false,
        isArchived: taskToEdit ? taskToEdit.isArchived : false,
        isStarred: assignedTo.trim() ? (taskToEdit?.isStarred ?? true) : taskToEdit?.isStarred,
        assignedTo: assignedTo.trim() || undefined,
        assignedBy: assignedTo.trim() ? (taskToEdit?.assignedBy || currentUser || "Neftali") : undefined,
        assignedAt: assignedTo.trim() ? (taskToEdit?.assignedAt || new Date().toISOString()) : undefined,
      },
      taskToEdit?.id
    );
    setTitle("");
    setNote("");
    setDescription("");
    setUrl("");
    setAssignedTo("");
    setQuery("");
    onClose();
  };

  const handleReturnToAssigner = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!title.trim() || !query.trim()) return;
    const assigner = taskToEdit?.assignedBy || "Neftali";
    onSave(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        url: url.trim() || undefined,
        scheduledDate,
        query: query.trim(),
        isCompleted: false,
        isAttended: true, // Queda atendida por quien la devolvió
        isArchived: false,
        assignedTo: assigner, // Reasignada de vuelta al autor
        assignedBy: currentUser || taskToEdit?.assignedTo || "John",
        assignedAt: new Date().toISOString(),
      },
      taskToEdit?.id
    );
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
          {/* Campo Título (OBLIGATORIO) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-[#E2E8F0]">
                * Nombre / Título del pendiente:
              </label>
              {!title.trim() && (
                <span className="text-[10px] text-amber-400 font-medium">Requerido</span>
              )}
            </div>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Revisar cotización y métricas..."
              className={`w-full h-8 px-2.5 bg-[#141B26] text-[#F8FAFC] border rounded text-xs focus:outline-none ${
                !title.trim() ? "border-amber-500/70 focus:border-amber-400" : "border-[#26354A] focus:border-[#38BDF8]"
              }`}
              autoFocus
            />
          </div>

          {/* Campo Búsqueda Vinculada (OBLIGATORIA) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-[#E2E8F0]">
                * Búsqueda vinculada que ejecutará el pendiente:
              </label>
              {!query.trim() && (
                <span className="text-[10px] text-amber-400 font-medium">Requerida</span>
              )}
            </div>
            <input
              type="text"
              required
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej. nne00 OR nne11, bitácora, anfeta.com..."
              className={`w-full h-8 px-2.5 bg-[#141B26] text-[#F8FAFC] border rounded text-xs focus:outline-none ${
                !query.trim() ? "border-amber-500/70 focus:border-amber-400" : "border-[#26354A] focus:border-[#38BDF8]"
              }`}
            />
            <p className="text-[9.5px] text-slate-400 mt-0.5">
              Al hacer clic en el pendiente, se ejecutará automáticamente esta búsqueda.
            </p>
          </div>

          {/* Fila Hora programada (AM/PM) + Link de entrega */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-[#E2E8F0] mb-1">
                Hora del horario (opcional):
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={timeHour}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTimeHour(val);
                    if (val.toLowerCase().includes("pm")) setTimeMeridian("PM");
                    else if (val.toLowerCase().includes("am")) setTimeMeridian("AM");
                    else {
                      const num = parseInt(val, 10);
                      if (!isNaN(num)) {
                        if ((num >= 1 && num <= 6) || num === 12) setTimeMeridian("PM");
                        else if (num >= 7 && num <= 11) setTimeMeridian("AM");
                      }
                    }
                  }}
                  placeholder="Ej. 09:00 o 5"
                  className="w-full h-8 px-2.5 bg-[#141B26] text-[#F8FAFC] border border-[#26354A] rounded text-xs focus:border-[#38BDF8] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setTimeMeridian((prev) => (prev === "AM" ? "PM" : "AM"))}
                  className="h-8 px-2 rounded bg-cyan-950 border border-cyan-500/60 text-cyan-300 font-bold text-xs hover:bg-cyan-900 transition cursor-pointer shrink-0"
                  title="Clic para alternar entre AM y PM (detecta automáticamente por jornada)"
                >
                  {timeMeridian}
                </button>
              </div>
            </div>

            {/* Campo Link / Enlace de entrega (Opcional) */}
            <div>
              <label className="block text-[11px] font-semibold text-[#E2E8F0] mb-1">
                Link de entrega (opcional):
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://notion.so/... enlace"
                className="w-full h-8 px-2.5 bg-[#141B26] text-[#F8FAFC] border border-[#26354A] rounded text-xs focus:border-[#38BDF8] focus:outline-none"
              />
            </div>
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

          {/* Campo Nota visible (no altera la búsqueda) */}
          <div>
            <label className="block text-[11px] font-semibold text-amber-200 mb-1">
              Nota visible (opcional · no altera búsqueda):
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. Esperar respuesta del cliente / Revisar copy..."
              className="w-full h-8 px-2.5 bg-[#141B26] text-amber-100 border border-amber-500/40 rounded text-xs focus:border-amber-400 focus:outline-none"
            />
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

          {/* Botones de acción */}
          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-[#1E2836] gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-[#161F2C] border border-[#26354A] text-[#CBD5E1] text-xs hover:bg-[#1E2836] cursor-pointer"
            >
              Cancelar
            </button>

            <div className="flex items-center gap-2 ml-auto">
              {/* Botón Devolver / Regresar a quien me lo asignó */}
              {isAssignedFromOther && (
                <button
                  type="button"
                  onClick={handleReturnToAssigner}
                  className="px-3 py-1.5 rounded bg-emerald-950/80 border border-emerald-500/80 text-emerald-300 text-xs font-bold hover:bg-emerald-900 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                  title={`Devolver el pendiente terminado a ${taskToEdit?.assignedBy || "compañero"}`}
                >
                  ↩️ Devolver a {taskToEdit?.assignedBy || "compañero"} (Listo)
                </button>
              )}

              <button
                type="submit"
                disabled={!title.trim() || !query.trim()}
                className="px-4 py-1.5 rounded bg-[#0C4A6E] border border-[#38BDF8] text-[#38BDF8] text-xs font-bold hover:bg-[#0284C7] hover:text-white transition-colors cursor-pointer disabled:opacity-40"
              >
                {taskToEdit ? "Guardar cambios" : "Guardar pendiente"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
