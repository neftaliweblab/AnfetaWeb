"use client";

import React, { useState } from "react";
import { Folder, Database, ChevronRight, ChevronDown, HardDrive } from "lucide-react";

interface FoldersPaneProps {
  onSelectFilter: (filter: string) => void;
  activeFilter?: string | null;
}

interface FolderNode {
  id: string;
  name: string;
  type: "folder" | "notion" | "dropbox";
  children?: FolderNode[];
}

const DEFAULT_TREE: FolderNode[] = [
  {
    id: "dropbox",
    name: "Dropbox (Local)",
    type: "dropbox",
    children: [
      { id: "unika", name: "CARPETA UNIKA drx", type: "folder" },
      { id: "clientes", name: "zClientes", type: "folder" },
      { id: "recursos", name: "Recursos y Diseños", type: "folder" },
    ],
  },
  {
    id: "notion",
    name: "Bases Notion",
    type: "notion",
    children: [
      { id: "revisiones", name: "Revisiones Actividades", type: "notion" },
      { id: "proyectos", name: "Proyectos Activos", type: "notion" },
      { id: "cobrar", name: "Cobrar y Pagar", type: "notion" },
    ],
  },
];

export function FoldersPane({ onSelectFilter, activeFilter }: FoldersPaneProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    dropbox: true,
    notion: true,
  });

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderNode = (node: FolderNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExp = expanded[node.id];
    const isSelected = activeFilter === node.name;

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => {
            if (hasChildren) toggle(node.id);
            onSelectFilter(node.name);
          }}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${
            isSelected
              ? "bg-[#18212B] text-[#00A8FF] font-medium"
              : "text-[#94A3B8] hover:bg-[#131A22] hover:text-[#E2E8F0]"
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggle(node.id);
              }}
              className="text-[#64748B] hover:text-[#E2E8F0]"
            >
              {isExp ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          ) : (
            <div className="w-3" />
          )}

          {node.type === "dropbox" && <HardDrive className="w-3.5 h-3.5 text-[#38BDF8]" />}
          {node.type === "notion" && <Database className="w-3.5 h-3.5 text-[#A855F7]" />}
          {node.type === "folder" && <Folder className="w-3.5 h-3.5 text-[#F59E0B]" />}

          <span className="truncate">{node.name}</span>
        </div>

        {hasChildren && isExp && (
          <div>
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-56 bg-[#0F141A] border-r border-[#26323E] flex flex-col flex-shrink-0 select-none">
      <div className="h-10 px-3 border-b border-[#26323E] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[#38BDF8]" />
          <span className="text-xs font-semibold text-[#E2E8F0]">Bases y Carpetas</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 scrollbar-thin">
        {DEFAULT_TREE.map((node) => renderNode(node))}
      </div>
    </aside>
  );
}
