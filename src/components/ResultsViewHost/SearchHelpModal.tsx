"use client";

import React from "react";
import { X, Search, Folder, Zap, Globe, Keyboard, ExternalLink } from "lucide-react";

interface SearchHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertCommand: (cmd: string) => void;
}

export function SearchHelpModal({ isOpen, onClose, onInsertCommand }: SearchHelpModalProps) {
  if (!isOpen) return null;

  const sections = [
    {
      title: "📁 Dropbox · carpetas y archivos",
      icon: Folder,
      commands: [
        { cmd: ".folder", desc: "Atajo: muestra solo carpetas." },
        { cmd: ".carpeta", desc: "Alias en español de .folder." },
        { cmd: "type:folder", desc: "Operador completo: solo carpetas." },
        { cmd: ".file", desc: "Atajo: muestra solo archivos." },
        { cmd: ".archivo", desc: "Alias en español de .file." },
        { cmd: "type:file", desc: "Operador completo: solo archivos." },
        { cmd: "ext:pdf", desc: "Solo archivos PDF." },
        { cmd: "ext:pdf;docx;xlsx", desc: "PDF, Word y Excel en una sola búsqueda." },
        { cmd: "folder:finanzas", desc: "Resultados cuya ruta contenga 'finanzas'." },
        { cmd: "nopath:SEO", desc: "Excluye resultados cuya ruta contenga 'SEO'." },
      ],
    },
    {
      title: "🔎 Búsqueda rápida y operadores",
      icon: Search,
      commands: [
        { cmd: "factura 2026", desc: "AND automático: deben aparecer ambos términos." },
        { cmd: '"estado de cuenta"', desc: "Busca la frase exacta y en ese orden." },
        { cmd: "reporte -SEO", desc: "Busca reporte y excluye SEO." },
        { cmd: "reporte !SEO", desc: "Otra forma de excluir SEO." },
        { cmd: "pdf OR docx", desc: "Cualquiera de los dos términos (OR)." },
        { cmd: "a|b|c", desc: "OR compacto entre variantes." },
        { cmd: "( SEO OR ADS ) cliente", desc: "Agrupa condiciones con paréntesis." },
      ],
    },
    {
      title: "🧠 Filtros avanzados",
      icon: Zap,
      commands: [
        { cmd: "size:>10MB", desc: "Archivos mayores a 10 MB." },
        { cmd: "dm:<=7", desc: "Modificados hace 7 días o menos." },
        { cmd: "date:2026-08-01", desc: "Modificados exactamente en esa fecha." },
        { cmd: "regex:^00act", desc: "Expresión regular: nombre que empieza con 00act." },
        { cmd: "regex:reporte.*(pdf|url)", desc: "Regex: reporte seguido de pdf o url." },
      ],
    },
    {
      title: "🗂️ Bases de Notion",
      icon: Globe,
      commands: [
        { cmd: "revisiones", desc: "Limita la búsqueda a la base Revisiones." },
        { cmd: "zclientes", desc: "Limita a base Clientes." },
        { cmd: "zdominios", desc: "Limita a base Dominios." },
        { cmd: "zproyectos", desc: "Limita a Programas y proyectos." },
        { cmd: "zcorreos", desc: "Limita a Correos / Contraseñas." },
        { cmd: "zpagar", desc: "Limita a registros de Pagar." },
        { cmd: "zcobrar", desc: "Limita a registros de Cobrar." },
      ],
    },
    {
      title: "⌨️ Atajos de Teclado Globales",
      icon: Keyboard,
      commands: [
        { cmd: "Ctrl + V", desc: "Pegar texto (crea página Notion) o imagen (sube a Dropbox)." },
        { cmd: "F5", desc: "Recargar y refrescar índice local." },
        { cmd: "Delete", desc: "Eliminar elemento o elementos seleccionados." },
        { cmd: "Enter", desc: "Abrir página en Notion o archivo local." },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-[740px] max-h-[85vh] bg-[#0D131A] border border-[#253B4D] rounded-xl shadow-2xl flex flex-col overflow-hidden text-[#E2E8F0]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#101A24] border-b border-[#1E2E3E]">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-[#38BDF8]">❓ Guía Rápida de Comandos y Filtros</span>
            <span className="text-xs text-[#94A3B8]">ANFETA 1:1</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#1E2E3E] text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info card */}
        <div className="px-5 pt-3 pb-1">
          <div className="p-3 rounded-lg bg-[#00A8FF]/10 border border-[#00A8FF]/30 text-xs text-[#BAE6FD]">
            <span className="font-bold text-[#38BDF8]">💡 Cómo funciona: </span>
            Escribe palabras normalmente y ANFETA las combina como <span className="font-mono font-bold text-white">AND</span>.
            Pulsa en cualquiera de los comandos abajo para insertarlo directamente en tu barra de búsqueda.
          </div>
        </div>

        {/* Contenido desplazable */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-5 scrollbar-thin">
          {sections.map((sec) => {
            const Icon = sec.icon;
            return (
              <div key={sec.title} className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#F1F5F9] border-b border-[#1E293B] pb-1">
                  <Icon className="w-3.5 h-3.5 text-[#38BDF8]" />
                  <span>{sec.title}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {sec.commands.map((c) => (
                    <button
                      key={c.cmd}
                      type="button"
                      onClick={() => {
                        onInsertCommand(c.cmd);
                        onClose();
                      }}
                      className="flex flex-col text-left p-2 rounded-lg bg-[#141E2B] border border-[#233549] hover:border-[#38BDF8] hover:bg-[#1A2637] transition-all cursor-pointer group"
                    >
                      <span className="font-mono text-[11px] font-bold text-[#38BDF8] group-hover:text-white">
                        {c.cmd}
                      </span>
                      <span className="text-[10px] text-[#94A3B8] mt-0.5 line-clamp-1">{c.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-[#101A24] border-t border-[#1E2E3E] flex items-center justify-between text-xs text-[#64748B]">
          <span>Tip: Combina filtros como <code className="text-[#38BDF8]">cliente ext:pdf .file</code></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1 rounded bg-[#162334] hover:bg-[#1E2E3E] border border-[#2B4055] text-white text-xs font-medium cursor-pointer transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
