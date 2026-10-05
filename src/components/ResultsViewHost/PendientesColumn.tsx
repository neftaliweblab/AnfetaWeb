"use client";

import React, { useState, useEffect, useRef } from "react";
import { Plus, Check, Trash2, Edit2, Calendar } from "lucide-react";
import { PendingTaskItem } from "@/types/anfeta";
import { formatSmartDate } from "@/lib/dateUtils";

interface PendientesColumnProps {
  pendingTasks: PendingTaskItem[];
  onToggleTask: (id: string) => void;
  onOpenNewTaskModal: () => void;
  onEditTask?: (task: PendingTaskItem) => void;
  onDeleteTask: (id: string) => void;
  onDeleteAllTasks?: () => void;
  onSelectTaskQuery?: (query: string) => void;
}

export function PendientesColumn({
  pendingTasks,
  onToggleTask,
  onOpenNewTaskModal,
  onEditTask,
  onDeleteTask,
  onDeleteAllTasks,
  onSelectTaskQuery,
}: PendientesColumnProps) {
  const [contextMenu, setContextMenu] = useState<{ task: PendingTaskItem; x: number; y: number } | null>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  const pendingCount = pendingTasks.filter((t) => !t.isCompleted).length;

  const handleContextMenu = (e: React.MouseEvent, task: PendingTaskItem) => {
    e.preventDefault();
    setContextMenu({ task, x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="w-[260px] shrink-0 h-full bg-[#0F141C] border border-[#1E2836] rounded-lg p-2.5 flex flex-col select-none text-xs">
      {/* Header Pendientes con contador y botón '+' */}
      <div className="flex items-center justify-between pb-2 border-b border-[#1E2836] mb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-[10.5px] text-[#F59E0B]">📋 PENDIENTES</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#78350F] text-[#FDE68A] border border-[#F59E0B]/50">
            {pendingCount}
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenNewTaskModal}
          className="w-5 h-5 flex items-center justify-center rounded bg-[#161F2C] border border-[#38BDF8] text-[#38BDF8] hover:bg-[#1E293B] text-xs font-bold transition-colors cursor-pointer"
          title="Guardar nuevo pendiente con fecha (+)"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Lista de Tareas Manuales o Mensaje Vacío */}
      <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin pr-0.5 min-h-0">
        {pendingTasks.map((task) => (
          <div
            key={task.id}
            onClick={() => {
              if (task.query || task.title) {
                onSelectTaskQuery?.(task.query || task.title);
              }
            }}
            onContextMenu={(e) => handleContextMenu(e, task)}
            className={`p-2 rounded bg-[#141B26] border border-[#1E2836] hover:bg-[#1A2332] hover:border-[#38BDF8]/40 cursor-pointer transition-colors relative group flex items-start gap-2 ${
              task.isCompleted ? "opacity-60 bg-[#0F1622]" : ""
            }`}
            title={`Clic: buscar en el explorador · Clic derecho: menú contextual`}
          >
            {/* Checkbox circular de completado */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleTask(task.id);
              }}
              className={`w-3.5 h-3.5 rounded-full border shrink-0 mt-0.5 flex items-center justify-center transition-colors cursor-pointer ${
                task.isCompleted
                  ? "bg-[#10B981] border-[#10B981] text-black"
                  : "border-[#475569] hover:border-[#38BDF8] bg-transparent"
              }`}
              title={task.isCompleted ? "Marcar como pendiente" : "Marcar como completada"}
            >
              {task.isCompleted && <Check className="w-2.5 h-2.5 stroke-[3]" />}
            </button>

            {/* Contenido de la tarea */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span
                  className={`text-[11px] font-semibold text-[#F1F5F9] truncate block ${
                    task.isCompleted ? "line-through text-[#94A3B8]" : ""
                  }`}
                >
                  {task.title}
                </span>
                {task.scheduledDate && (
                  <span className="shrink-0 px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-[#26D97706] text-[#FDE68A] border border-[#F59E0B]/40 font-mono">
                    {formatSmartDate(task.scheduledDate)}
                  </span>
                )}
              </div>

              {task.query && (
                <span className="text-[9.5px] text-[#64748B] block truncate group-hover:text-[#94A3B8]">
                  🔍 {task.query}
                </span>
              )}
            </div>

            {/* Botón rápido de eliminar en hover */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTask(task.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#EF4444]/20 text-[#EF4444] transition-opacity shrink-0 cursor-pointer"
              title="Eliminar pendiente"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}

        {pendingTasks.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center p-4 text-center text-[#64748B] text-[10.5px]">
            <Calendar className="w-6 h-6 text-[#475569] mb-2 opacity-60" />
            <span>No hay pendientes guardados.</span>
            <span className="mt-1 text-[#94A3B8]">Presiona &apos;+&apos; para programar uno con fecha.</span>
          </div>
        )}
      </div>

      {/* Context Menu Flotante (Paridad 1:1 con ANFETA WinUI 3) */}
      {contextMenu && (
        <div
          ref={contextRef}
          className="fixed z-50 bg-[#111822] border border-[#253549] rounded-lg shadow-2xl p-1 text-xs min-w-[130px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {onEditTask && (
            <button
              type="button"
              onClick={() => {
                onEditTask(contextMenu.task);
                setContextMenu(null);
              }}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] hover:text-[#38BDF8] text-[10.5px] flex items-center gap-1.5 cursor-pointer"
            >
              <Edit2 className="w-3 h-3 text-[#38BDF8]" />
              <span>Editar</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onDeleteTask(contextMenu.task.id);
              setContextMenu(null);
            }}
            className="w-full text-left px-2 py-1.5 rounded hover:bg-[#EF4444]/20 text-[#EF4444] text-[10.5px] flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3 h-3 text-[#EF4444]" />
            <span>Eliminar</span>
          </button>

          {onDeleteAllTasks && pendingTasks.length > 1 && (
            <>
              <div className="h-px bg-[#26354A] my-1" />
              <button
                type="button"
                onClick={() => {
                  if (confirm("¿Estás seguro de que deseas borrar todos los pendientes?")) {
                    onDeleteAllTasks();
                  }
                  setContextMenu(null);
                }}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-[#EF4444]/20 text-[#EF4444] text-[10.5px] flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3 h-3 text-[#EF4444]" />
                <span>Borrar todos</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
