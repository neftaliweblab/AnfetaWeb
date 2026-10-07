"use client";

import React, { useState, useEffect, useRef } from "react";
import { parseVisualParts } from "@/lib/visualTitleParser";
import {
  Globe,
  Folder,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  FileCode,
  Check,
  Trash2,
  Upload,
  Star,
  Clock,
  Send,
  CheckCircle,
  ExternalLink,
  FolderOpen,
  Edit2,
  Copy,
  Link,
  FolderPlus,
  CopyPlus,
  ChevronRight,
} from "lucide-react";
import { formatSmartDate } from "@/lib/dateUtils";

export interface ResultItem {
  id: string;
  name: string;
  source?: string;
  sourceName?: string;
  externalSourceName?: string;
  target?: string;
  path?: string;
  [key: string]: any;
}

interface ResultsTableProps {
  currentUser: string;
  items: any[];
  selectedId: string | null;
  selectedIds: Set<string>;
  searchQuery?: string;
  favorites?: Set<string>;
  onSelect: (item: any) => void;
  onToggleCheck: (id: string) => void;
  onToggleBookmark?: (item: any) => void;
  onDelete: (item: any) => void;
  onDoubleClick: (item: any) => void;
  onOpenLocation?: (item: any) => void;
  onCopyName?: (item: any) => void;
  onCopyPath?: (item: any) => void;
  onCopyLink?: (item: any) => void;
  onCopyDomain?: (item: any) => void;
  onCopyDomainType?: (item: any) => void;
  onCopyContent?: (item: any) => void;
  onOpenDomain?: (domain: string) => void;
  onRename?: (item: any) => void;
  onDuplicate?: (item: any) => void;
  onCreateFolder?: (targetDir?: string) => void;
  onUpdateStatus?: (item: any, newStatus: string) => void;
  onToggleSelectAll?: () => void;
  onClearSelection?: () => void;
  onDeleteSelected?: () => void;
  onOpenUploadDropbox?: (targetDir?: string) => void;
  onDropFiles?: (files: File[]) => void;
  showPath?: boolean;
  showStatus?: boolean;
  showScheduledDate?: boolean;
  showModifiedDate?: boolean;
  viewZoom?: "list" | "small" | "medium" | "large";
  textScale?: string;
  groupBy?: string;
}

const PERSON_ALIASES: Record<string, string> = {
  jjohn: "John",
  john: "John",
  aandr: "Andrade",
  andrade: "Andrade",
  nneft: "Neftali",
  neftali: "Neftali",
  bbria: "Brian",
  brian: "Brian",
  ggena: "Genaro",
  genaro: "Genaro",
  iisaia: "Isaias",
  iisai: "Isaias",
  isaias: "Isaias",
  kkarl: "Karla",
  karla: "Karla",
  eedua: "Sotelo",
  ssote: "Sotelo",
  sotelo: "Sotelo",
  eduardo: "Sotelo",
  aacal: "Acali",
  acalli: "Acali",
  eemma: "Emmanuel",
  emmanuel: "Emmanuel",
};

function getItemGroupKey(item: any, groupBy: string): string {
  const name = (item.name || "").toLowerCase();
  const parsed = parseVisualParts(item.name, item.updateStatus, item.contentSnippet);

  if (groupBy === "name" || groupBy === "name_noterminated" || groupBy === "person") {
    for (const [key, label] of Object.entries(PERSON_ALIASES)) {
      if (name.includes(key)) {
        return `👤 ${label}`;
      }
    }
    return "👤 Sin persona asignada";
  }

  if (groupBy === "domain" || groupBy === "domain_nobilling") {
    const dom = parsed.domain || item.domainChip || item.domain || item.sourceName || "General";
    const status = parsed.workflow || item.updateStatus || "Activo";
    return `🌐 ${dom} · ${status}`;
  }

  if (groupBy === "project_suffix") {
    const dom = parsed.domain || item.domainChip || item.domain || "General";
    const suffixMatch = name.match(/\.(webs|ads|seo|app|prog)\b/i);
    const suffix = suffixMatch ? suffixMatch[0] : ".general";
    return `📁 ${dom} · ${suffix}`;
  }

  if (groupBy === "month") {
    return parsed.monthCode ? `📅 Mes: ${parsed.monthCode}` : "📅 Sin mes";
  }

  if (groupBy === "area" || groupBy === "area_nobilling") {
    return parsed.area ? `🏷️ Área: ${parsed.area}` : "🏷️ Otros";
  }

  return "";
}

export function ResultsVirtualTable({
  items,
  selectedId,
  selectedIds,
  searchQuery = "",
  favorites = new Set(),
  onSelect,
  onToggleCheck,
  onToggleBookmark,
  onDelete,
  onDoubleClick,
  onOpenLocation,
  onCopyName,
  onCopyPath,
  onCopyLink,
  onCopyDomain,
  onCopyDomainType,
  onCopyContent,
  onOpenDomain,
  onRename,
  onDuplicate,
  onCreateFolder,
  onUpdateStatus, currentUser,
  onToggleSelectAll,
  onClearSelection,
  onDeleteSelected,
  onOpenUploadDropbox,
  onDropFiles,
  showPath = true,
  showStatus = true,
  showScheduledDate = true,
  showModifiedDate = true,
  viewZoom = "list",
  textScale = "100%",
  groupBy = "none",
}: ResultsTableProps) {
  const [contextMenu, setContextMenu] = useState<{ item: any; x: number; y: number } | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Anchos de columna configurables y redimensionables interactivamente
  type ColumnKey = "path" | "status" | "scheduledDate" | "modifiedDate";
  const defaultColWidths: Record<ColumnKey, number> = {
    path: 130,
    status: 160,
    scheduledDate: 185, // Suficiente espacio para mostrar fechas completas con hora sin recortar
    modifiedDate: 140,
  };

  const [colWidths, setColWidths] = useState<Record<ColumnKey, number>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("anfeta_col_widths");
        if (saved) {
          return { ...defaultColWidths, ...JSON.parse(saved) };
        }
      } catch {}
    }
    return defaultColWidths;
  });

  const resizingColRef = useRef<{
    col: ColumnKey;
    startX: number;
    startW: number;
  } | null>(null);

  const handleStartColResize = (col: ColumnKey, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingColRef.current = {
      col,
      startX: e.clientX,
      startW: colWidths[col],
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingColRef.current) return;
      const { col: activeCol, startX, startW } = resizingColRef.current;
      const diff = moveEvent.clientX - startX;
      const minWidths: Record<ColumnKey, number> = {
        path: 80,
        status: 100,
        scheduledDate: 120,
        modifiedDate: 90,
      };
      const newW = Math.max(minWidths[activeCol], startW + diff);
      setColWidths((prev) => ({ ...prev, [activeCol]: newW }));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      resizingColRef.current = null;
      setColWidths((latest) => {
        try {
          localStorage.setItem("anfeta_col_widths", JSON.stringify(latest));
        } catch {}
        return latest;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setActiveSubmenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
        setActiveSubmenu(null);
      }
    };
    if (contextMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  const scale = (() => {
    if (!textScale) return 1.0;
    const num = parseFloat(textScale.replace("%", "").trim());
    return !isNaN(num) && num > 0 ? num / 100 : 1.0;
  })();

  const groupedItems = React.useMemo(() => {
    if (!groupBy || groupBy === "none") return null;

    const map = new Map<string, any[]>();
    for (const item of items) {
      if (
        groupBy === "name_noterminated" &&
        (item.updateStatus?.toLowerCase().includes("terminad") ||
          item.name?.toLowerCase().includes("zrevision"))
      ) {
        continue;
      }
      if (
        groupBy.includes("nobilling") &&
        (item.sourceName?.toLowerCase().includes("pagar") ||
          item.sourceName?.toLowerCase().includes("cobrar") ||
          item.name?.toLowerCase().includes("cobrar") ||
          item.name?.toLowerCase().includes("pagar"))
      ) {
        continue;
      }

      const key = getItemGroupKey(item, groupBy);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    }

    return Array.from(map.entries()).map(([key, groupRows]) => ({
      key,
      items: groupRows,
    }));
  }, [items, groupBy]);

  const renderIcon = (item: any) => {
    const ext = (item.extension || item.name?.split(".").pop() || "").toLowerCase();
    const isFolder = item.type?.toLowerCase() === "folder";
    const srcLower = (item.source || "").toString().toLowerCase();
    const iconStyle = {
      width: `${Math.round(14 * scale)}px`,
      height: `${Math.round(14 * scale)}px`,
    };

    if (srcLower === "notion") return <Globe style={iconStyle} className="text-[#B8B8B8]" />;
    if (isFolder) return <Folder style={iconStyle} className="text-[#F59E0B]" />;
    if (ext === "pdf") return <FileText style={iconStyle} className="text-[#EF4444]" />;
    if (["xlsx", "xls", "csv"].includes(ext)) return <FileSpreadsheet style={iconStyle} className="text-[#10B981]" />;
    if (["docx", "doc"].includes(ext)) return <FileText style={iconStyle} className="text-[#3B82F6]" />;
    if (["png", "jpg", "jpeg", "webp"].includes(ext)) return <ImageIcon style={iconStyle} className="text-[#8B5CF6]" />;
    return <FileCode style={iconStyle} className="text-[#06B6D4]" />;
  };

  const highlightMatch = (text: string) => {
    if (!searchQuery || searchQuery.trim().length < 2) return text;
    const cleanQ = searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${cleanQ})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <span key={i} className="text-[#38BDF8] bg-[#38BDF8]/20 px-0.5 rounded font-bold">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const renderRow = (item: any) => {
    const isSelected = selectedId === item.id;
    const isChecked = selectedIds.has(item.id);
    const parsed = parseVisualParts(item.name, item.updateStatus || item.statusLabel, item.contentSnippet);
    const isFav = favorites.has(String(item.externalId || item.path || item.id));
    const targetPath = item.target || item.path || "";
    const displayPath = item.sourceName || (targetPath ? targetPath.replace(/\\/g, "/").split("/").slice(-2, -1)[0] : "—");

    return (
      <div
        key={item.id}
        onClick={() => onSelect(item)}
        onDoubleClick={() => onDoubleClick(item)}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ item, x: e.clientX, y: e.clientY });
        }}
        style={{
          minHeight: `${Math.round(30 * scale)}px`,
          paddingTop: `${Math.max(2, Math.round(3 * scale))}px`,
          paddingBottom: `${Math.max(2, Math.round(3 * scale))}px`,
        }}
        className={`flex items-center px-3 cursor-pointer transition-colors ${
          isSelected
            ? "bg-[#1E293B] border-l-2 border-[#38BDF8] text-white"
            : isChecked
            ? "bg-[#131F2E] border-l-2 border-[#1E3A5F] text-[#F1F5F9]"
            : "hover:bg-[#172230] text-[#CBD5E1]"
        }`}
      >
        {showPath && (
          <div
            style={{
              fontSize: `${(10 * scale).toFixed(1)}px`,
              width: `${colWidths.path}px`,
            }}
            className="shrink-0 truncate text-[#74808B] font-mono pr-2"
            title={displayPath}
          >
            {displayPath}
          </div>
        )}

        {/* Nombre + Chips + Dominio */}
        <div className="flex-1 flex items-center min-w-0 pr-2 gap-1.5 overflow-hidden">
          <span
            className="shrink-0 flex items-center justify-center"
            style={{
              width: `${Math.round(14 * scale)}px`,
              height: `${Math.round(14 * scale)}px`,
            }}
          >
            {renderIcon(item)}
          </span>
          {parsed.area && (
            <span
              style={{
                fontSize: `${Math.max(7.5, 7.5 * scale).toFixed(1)}px`,
                padding: `${Math.max(1, Math.round(1 * scale))}px ${Math.max(3, Math.round(4 * scale))}px`,
              }}
              className="shrink-0 rounded font-bold bg-[#1B4764]/40 border border-[#38B6FF]/60 text-[#7DD3FC]"
            >
              {parsed.area}
            </span>
          )}
          {parsed.monthCode && (
            <span
              style={{
                fontSize: `${Math.max(7.5, 7.5 * scale).toFixed(1)}px`,
                padding: `${Math.max(1, Math.round(1 * scale))}px ${Math.max(3, Math.round(4 * scale))}px`,
              }}
              className="shrink-0 rounded font-bold bg-[#104E3E]/40 border border-[#2DD4BF]/60 text-[#5EEAD4]"
            >
              {parsed.monthCode}
            </span>
          )}
          {parsed.orderCode && (
            <span
              style={{
                fontSize: `${Math.max(7.5, 7.5 * scale).toFixed(1)}px`,
                padding: `${Math.max(1, Math.round(1 * scale))}px ${Math.max(3, Math.round(4 * scale))}px`,
              }}
              className="shrink-0 rounded font-bold bg-[#3B2D6B]/40 border border-[#A78BFA]/60 text-[#C4B5FD]"
            >
              {parsed.orderCode}
            </span>
          )}
          <span
            style={{ fontSize: `${(11 * scale).toFixed(1)}px` }}
            className="truncate font-semibold text-[#E2E8F0]"
          >
            {highlightMatch(parsed.title)}
          </span>
          {(parsed.domain || item.domainChip || item.domain) && (
            <span
              style={{
                fontSize: `${Math.max(7.5, 8 * scale).toFixed(1)}px`,
                padding: `${Math.max(1, Math.round(1 * scale))}px ${Math.max(4, Math.round(6 * scale))}px`,
              }}
              className="shrink-0 max-w-[140px] truncate ml-auto rounded bg-[#1E293B]/70 border border-[#60A5FA]/30 text-[#93C5FD] font-mono"
            >
              {parsed.domain || item.domainChip || item.domain}
            </span>
          )}
        </div>

        {/* Estado */}
        {showStatus && (
          <div
            style={{ width: `${colWidths.status}px` }}
            className="shrink-0 px-1 flex items-center gap-1 overflow-hidden"
          >
            {parsed.workflow ? (
              <span
                style={{
                  fontSize: `${Math.max(7.5, 8 * scale).toFixed(1)}px`,
                  padding: `${Math.max(1, Math.round(1 * scale))}px ${Math.max(4, Math.round(6 * scale))}px`,
                }}
                className="inline-flex items-center gap-1 rounded-full font-bold bg-[#1E293B] border border-current/20 truncate"
              >
                <span
                  className="rounded-full shrink-0"
                  style={{
                    width: `${Math.max(4, Math.round(6 * scale))}px`,
                    height: `${Math.max(4, Math.round(6 * scale))}px`,
                    backgroundColor: parsed.workflowColor,
                  }}
                />
                <span style={{ color: parsed.workflowColor }} className="truncate">
                  {parsed.workflow}
                </span>
              </span>
            ) : (
              <span
                style={{ fontSize: `${(9.5 * scale).toFixed(1)}px` }}
                className="text-[#94A3B8] truncate"
              >
                {item.updateStatus || "—"}
              </span>
            )}
          </div>
        )}

        {/* Fecha por hacer */}
        {showScheduledDate && (
          <div
            style={{
              fontSize: `${(10 * scale).toFixed(1)}px`,
              width: `${colWidths.scheduledDate}px`,
            }}
            className="shrink-0 px-1 text-[#CBD5E1] truncate font-mono whitespace-nowrap"
            title={item.scheduledDate ? formatSmartDate(item.scheduledDate) : undefined}
          >
            {formatSmartDate(item.scheduledDate)}
          </div>
        )}

        {/* Fecha modificada */}
        {showModifiedDate && (
          <div
            style={{
              fontSize: `${(10 * scale).toFixed(1)}px`,
              width: `${colWidths.modifiedDate}px`,
            }}
            className="shrink-0 px-1 text-[#94A3B8] truncate font-mono whitespace-nowrap"
            title={formatSmartDate(item.serverModified || item.modifiedLocalDate)}
          >
            {formatSmartDate(item.serverModified || item.modifiedLocalDate)}
          </div>
        )}

        {/* Favorito + Checkbox + Eliminar */}
        <div className="w-[62px] shrink-0 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark?.(item);
            }}
            style={{
              width: `${Math.round(15 * scale)}px`,
              height: `${Math.round(15 * scale)}px`,
            }}
            className="flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
            title={isFav ? "Quitar de Favoritos" : "Agregar a Favoritos"}
          >
            <Star
              style={{
                width: `${Math.round(11 * scale)}px`,
                height: `${Math.round(11 * scale)}px`,
              }}
              className={isFav ? "fill-[#F59E0B] text-[#F59E0B]" : "text-[#475569] hover:text-[#F59E0B]"}
            />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCheck(item.id);
            }}
            style={{
              width: `${Math.round(14 * scale)}px`,
              height: `${Math.round(14 * scale)}px`,
            }}
            className={`rounded border flex items-center justify-center transition-colors cursor-pointer ${
              isChecked
                ? "bg-[#0C4A6E] border-[#38BDF8] text-[#38BDF8]"
                : "bg-[#11161D] border-[#475569] hover:border-[#38BDF8]"
            }`}
            title={isChecked ? "Deseleccionar" : "Seleccionar"}
          >
            {isChecked && (
              <Check
                className="stroke-[3]"
                style={{
                  width: `${Math.round(10 * scale)}px`,
                  height: `${Math.round(10 * scale)}px`,
                }}
              />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
            style={{
              width: `${Math.round(16 * scale)}px`,
              height: `${Math.round(16 * scale)}px`,
            }}
            className="rounded hover:bg-[#EF4444]/20 text-[#EF4444] flex items-center justify-center cursor-pointer"
            title="Eliminar"
          >
            <Trash2
              style={{
                width: `${Math.round(10 * scale)}px`,
                height: `${Math.round(10 * scale)}px`,
              }}
            />
          </button>
        </div>
      </div>
    );
  };

  const renderCard = (item: any) => {
    const isSelected = selectedId === item.id;
    const isChecked = selectedIds.has(item.id);
    const parsed = parseVisualParts(item.name, item.updateStatus || item.statusLabel, item.contentSnippet);
    const isFav = favorites.has(String(item.externalId || item.path || item.id));
    return (
      <div
        key={item.id}
        onClick={() => onSelect(item)}
        onDoubleClick={() => onDoubleClick(item)}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ item, x: e.clientX, y: e.clientY });
        }}
        className={`relative flex flex-col justify-between p-2.5 rounded-lg border transition-all cursor-pointer min-h-[90px] ${
          isSelected
            ? "bg-[#1E293B] border-[#38BDF8] shadow-lg shadow-[#38BDF8]/10"
            : isChecked
            ? "bg-[#131F2E] border-[#1E3A5F]"
            : "bg-[#121822] border-[#1E2836] hover:border-[#2E3C4E] hover:bg-[#161F2C]"
        }`}
      >
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="shrink-0">{renderIcon(item)}</span>
            {parsed.area && (
              <span
                style={{ fontSize: `${Math.max(7, 7.5 * scale).toFixed(1)}px` }}
                className="shrink-0 px-1 py-0.2 rounded font-bold bg-[#1B4764]/40 border border-[#38B6FF]/60 text-[#7DD3FC]"
              >
                {parsed.area}
              </span>
            )}
            {parsed.monthCode && (
              <span
                style={{ fontSize: `${Math.max(7, 7.5 * scale).toFixed(1)}px` }}
                className="shrink-0 px-1 py-0.2 rounded font-bold bg-[#104E3E]/40 border border-[#2DD4BF]/60 text-[#5EEAD4]"
              >
                {parsed.monthCode}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleBookmark?.(item);
              }}
              style={{
                width: `${Math.round(15 * scale)}px`,
                height: `${Math.round(15 * scale)}px`,
              }}
              className="flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
              title={isFav ? "Quitar de Favoritos" : "Agregar a Favoritos"}
            >
              <Star
                style={{
                  width: `${Math.round(11 * scale)}px`,
                  height: `${Math.round(11 * scale)}px`,
                }}
                className={isFav ? "fill-[#F59E0B] text-[#F59E0B]" : "text-[#475569] hover:text-[#F59E0B]"}
              />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCheck(item.id);
              }}
              style={{
                width: `${Math.round(14 * scale)}px`,
                height: `${Math.round(14 * scale)}px`,
              }}
              className={`rounded border flex items-center justify-center transition-colors cursor-pointer ${
                isChecked
                  ? "bg-[#0C4A6E] border-[#38BDF8] text-[#38BDF8]"
                  : "bg-[#11161D] border-[#475569] hover:border-[#38BDF8]"
              }`}
              title={isChecked ? "Deseleccionar" : "Seleccionar"}
            >
              {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item);
              }}
              style={{
                width: `${Math.round(16 * scale)}px`,
                height: `${Math.round(16 * scale)}px`,
              }}
              className="rounded hover:bg-[#EF4444]/20 text-[#EF4444] flex items-center justify-center cursor-pointer"
              title="Eliminar"
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        <div
          style={{ fontSize: `${(11 * scale).toFixed(1)}px` }}
          className="font-semibold text-[#E2E8F0] line-clamp-2 mb-2"
        >
          {highlightMatch(parsed.title)}
        </div>

        <div
          style={{ fontSize: `${(9 * scale).toFixed(1)}px` }}
          className="flex items-center justify-between text-[#94A3B8] pt-1 border-t border-[#1E2836] gap-1"
        >
          {(parsed.domain || item.domainChip || item.domain) ? (
            <span className="truncate max-w-[90px] text-[#93C5FD] font-mono">{parsed.domain || item.domainChip || item.domain}</span>
          ) : (
            <span className="truncate max-w-[90px] text-[#64748B] font-mono">{item.sourceName || "—"}</span>
          )}
          {(item.scheduledDate || item.serverModified) && (
            <span
              className="text-[9px] text-[#CBD5E1] font-mono truncate max-w-[130px]"
              title={formatSmartDate(item.scheduledDate || item.serverModified)}
            >
              {formatSmartDate(item.scheduledDate || item.serverModified)}
            </span>
          )}
          {parsed.workflow && (
            <span
              style={{ fontSize: `${Math.max(7, 7.5 * scale).toFixed(1)}px` }}
              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full font-bold bg-[#1E293B] border border-current/20 shrink-0"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: parsed.workflowColor }} />
              <span style={{ color: parsed.workflowColor }}>{parsed.workflow}</span>
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`flex-1 flex flex-col h-full bg-[#0F141C] border ${
        isDraggingOver ? "border-[#38BDF8] ring-2 ring-[#38BDF8]/40" : "border-[#1E2836]"
      } rounded-lg select-none text-[11.5px] overflow-hidden relative transition-colors`}
      onClick={() => setContextMenu(null)}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          onDropFiles?.(Array.from(e.dataTransfer.files));
        }
      }}
    >
      {/* Overlay al arrastrar archivos */}
      {isDraggingOver && (
        <div className="absolute inset-0 bg-[#0284C7]/20 backdrop-blur-sm z-30 flex flex-col items-center justify-center border-2 border-dashed border-[#38BDF8] rounded-lg pointer-events-none">
          <Upload className="w-10 h-10 text-[#38BDF8] animate-bounce mb-2" />
          <span className="text-sm font-bold text-white">Suelta archivos para subir a Dropbox</span>
          <span className="text-xs text-[#93C5FD]">Se guardarán en la carpeta activa</span>
        </div>
      )}
      {/* Subheader de Ruta y Estadísticas */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#121822] border-b border-[#1E2836] text-[10.5px]">
        <span className="text-[#64748B] font-mono truncate">
          Ruta / Base: {items[0]?.sourceName || "Sin resultados"}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[#94A3B8] font-mono">{items.length} páginas</span>
          {selectedIds.size > 0 && (
            <span className="text-[#38BDF8] font-semibold text-[10px]">
              ({selectedIds.size} seleccionada{selectedIds.size > 1 ? "s" : ""})
            </span>
          )}
          <button
            type="button"
            onClick={onToggleSelectAll}
            className={`px-1.5 py-0.5 rounded border text-[9.5px] font-bold transition-colors ${
              selectedIds.size > 0
                ? "bg-[#0C4A6E] border-[#38BDF8] text-[#38BDF8]"
                : "bg-[#161F2C] border-[#26354A] text-[#94A3B8] hover:text-[#CBD5E1] hover:border-[#38BDF8]"
            }`}
            title="Seleccionar todas / Deseleccionar todas"
          >
            ✓ / ✕
          </button>
          {selectedIds.size > 0 && onDeleteSelected && (
            <button
              type="button"
              onClick={onDeleteSelected}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#EF4444]/20 border border-[#EF4444]/40 hover:bg-[#EF4444]/30 text-[#FCA5A5] text-[9.5px] font-semibold transition-colors"
              title={`Borrar ${selectedIds.size} páginas seleccionadas`}
            >
              <Trash2 className="w-2.5 h-2.5" />
              Borrar
            </button>
          )}
        </div>
      </div>

      {/* Encabezados de Columna (Modo Lista) */}
      {viewZoom === "list" && (
        <div
          style={{
            minHeight: `${Math.round(28 * scale)}px`,
            fontSize: `${(9.5 * scale).toFixed(1)}px`,
          }}
          className="flex items-center px-3 bg-[#141B26] border-b border-[#1E2836] font-bold text-[#94A3B8] select-none"
        >
          {showPath && (
            <div
              style={{ width: `${colWidths.path}px` }}
              className="shrink-0 relative flex items-center justify-between pr-2 group/col"
            >
              <span className="truncate">Path / Base</span>
              <div
                onMouseDown={(e) => handleStartColResize("path", e)}
                className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize z-10 flex items-center justify-center hover:bg-[#38BDF8]/20 group-hover/col:bg-[#38BDF8]/10"
                title="Arrastra para cambiar el ancho de la columna"
              >
                <div className="w-[1.5px] h-3 bg-[#26354A] group-hover/col:bg-[#38BDF8]" />
              </div>
            </div>
          )}

          <div className="flex-1 px-1 min-w-[120px] truncate">Nombre ▲</div>

          {showStatus && (
            <div
              style={{ width: `${colWidths.status}px` }}
              className="shrink-0 px-1 relative flex items-center justify-between group/col"
            >
              <span className="truncate">Estado actualiz...</span>
              <div
                onMouseDown={(e) => handleStartColResize("status", e)}
                className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize z-10 flex items-center justify-center hover:bg-[#38BDF8]/20 group-hover/col:bg-[#38BDF8]/10"
                title="Arrastra para cambiar el ancho de la columna"
              >
                <div className="w-[1.5px] h-3 bg-[#26354A] group-hover/col:bg-[#38BDF8]" />
              </div>
            </div>
          )}

          {showScheduledDate && (
            <div
              style={{ width: `${colWidths.scheduledDate}px` }}
              className="shrink-0 px-1 relative flex items-center justify-between group/col"
            >
              <span className="truncate">Fecha por hacer</span>
              <div
                onMouseDown={(e) => handleStartColResize("scheduledDate", e)}
                className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize z-10 flex items-center justify-center hover:bg-[#38BDF8]/20 group-hover/col:bg-[#38BDF8]/10"
                title="Arrastra para cambiar el ancho de la columna"
              >
                <div className="w-[1.5px] h-3 bg-[#26354A] group-hover/col:bg-[#38BDF8]" />
              </div>
            </div>
          )}

          {showModifiedDate && (
            <div
              style={{ width: `${colWidths.modifiedDate}px` }}
              className="shrink-0 px-1 relative flex items-center justify-between group/col"
            >
              <span className="truncate">Fecha modificada</span>
              <div
                onMouseDown={(e) => handleStartColResize("modifiedDate", e)}
                className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize z-10 flex items-center justify-center hover:bg-[#38BDF8]/20 group-hover/col:bg-[#38BDF8]/10"
                title="Arrastra para cambiar el ancho de la columna"
              >
                <div className="w-[1.5px] h-3 bg-[#26354A] group-hover/col:bg-[#38BDF8]" />
              </div>
            </div>
          )}

          <div className="w-[62px] shrink-0 text-center flex items-center justify-center gap-1">
            <span className="text-[10px] text-[#F59E0B]" title="Favoritos">★</span>
            <button
              type="button"
              onClick={onToggleSelectAll}
              className="hover:text-[#38BDF8] cursor-pointer transition-colors"
              title="Seleccionar todas / Deseleccionar todas"
            >
              ✓ / ✕
            </button>
          </div>
        </div>
      )}

      {/* Lista de Resultados (Modo Lista o Cuadrícula) */}
      {viewZoom === "list" ? (
        <div className="flex-1 overflow-y-auto divide-y divide-[#17212F] scrollbar-thin">
          {groupedItems ? (
            groupedItems.map((group) => (
              <div key={group.key} className="mb-1">
                <div
                  style={{
                    minHeight: `${Math.round(26 * scale)}px`,
                    marginTop: `${Math.round(6 * scale)}px`,
                    marginBottom: `${Math.round(2 * scale)}px`,
                  }}
                  className="flex items-center bg-[#162636]/90 border-y border-[#3A779B]/40 select-none sticky top-0 z-10 backdrop-blur-sm"
                >
                  <div
                    style={{ width: `${Math.round(4 * scale)}px` }}
                    className="self-stretch bg-[#28B8F5] shrink-0"
                  />
                  <div
                    style={{
                      fontSize: `${(11.5 * scale).toFixed(1)}px`,
                      padding: `${Math.round(3 * scale)}px ${Math.round(10 * scale)}px`,
                    }}
                    className="font-semibold text-[#E5F1FA] flex items-center justify-between w-full"
                  >
                    <span>{group.key}</span>
                    <span
                      style={{ fontSize: `${(9.5 * scale).toFixed(1)}px` }}
                      className="text-[#38BDF8] font-mono font-normal"
                    >
                      {group.items.length} página{group.items.length > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-[#17212F]">
                  {group.items.map(renderRow)}
                </div>
              </div>
            ))
          ) : (
            items.map(renderRow)
          )}
        </div>
      ) : (
        <div
          className={`flex-1 overflow-y-auto p-3 grid gap-2.5 scrollbar-thin ${
            viewZoom === "small"
              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 auto-rows-max"
              : viewZoom === "medium"
              ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-max"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-max"
          }`}
        >
          {groupedItems ? (
            groupedItems.map((group) => (
              <React.Fragment key={group.key}>
                <div
                  style={{
                    minHeight: `${Math.round(26 * scale)}px`,
                    fontSize: `${(11.5 * scale).toFixed(1)}px`,
                  }}
                  className="col-span-full flex items-center bg-[#162636]/90 border border-[#3A779B]/40 rounded px-3 py-1 font-semibold text-[#E5F1FA] justify-between"
                >
                  <span>{group.key}</span>
                  <span className="text-[#38BDF8] font-mono text-xs">{group.items.length} páginas</span>
                </div>
                {group.items.map(renderCard)}
              </React.Fragment>
            ))
          ) : (
            items.map(renderCard)
          )}
        </div>
      )}

      {/* Menú Contextual (Clic Derecho) - 1:1 ANFETA ResultsContextFlyout */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-[#0D1522]/98 backdrop-blur-md border border-[#00C8FF]/40 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] p-1 text-xs w-64 select-none animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: Math.max(10, Math.min(contextMenu.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 520)),
            left: Math.max(10, Math.min(contextMenu.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 270)),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const item = contextMenu.item;
            const parsed = parseVisualParts(item.name, item.updateStatus, item.contentSnippet);
            const domain = parsed.domain || item.sourceName || "";
            const chatCode = `${domain} · ${parsed.workflow || "Activo"}`;
            const isFav = favorites.has(String(item.externalId || item.path || item.id));

            return (
              <>
                {/* 1. Cambiar estado (Submenú) */}
                <div
                  className="relative"
                  onMouseEnter={() => setActiveSubmenu("status")}
                  onMouseLeave={() => setActiveSubmenu(null)}
                >
                  <button
                    type="button"
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
                      <span>Cambiar estado</span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-[#64748B]" />
                  </button>

                  {activeSubmenu === "status" && (
                    <div className="absolute left-full top-0 ml-1 bg-[#0D1522] border border-[#00C8FF]/40 rounded-lg shadow-2xl p-1 w-48 z-50">
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateStatus?.(item, "REVISION");
                          setContextMenu(null);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] flex items-center gap-2 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5 text-[#38BDF8]" />
                        <span>Enviar a revisión…</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateStatus?.(item, "TERMINADO");
                          setContextMenu(null);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] flex items-center gap-2 cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-[#22C55E]" />
                        <span>T · Terminar…</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Abrir */}
                <button
                  type="button"
                  onClick={() => {
                    onDoubleClick(item);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] flex items-center gap-2 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#00C8FF]" />
                  <span>Abrir</span>
                </button>

                {/* 3. Abrir en Explorador */}
                <button
                  type="button"
                  onClick={() => {
                    onOpenLocation?.(item);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] flex items-center gap-2 cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-[#FFB900]" />
                  <span>Abrir en Explorador</span>
                </button>

                <div className="h-px bg-[#26354A] my-1" />

                {/* 4. Renombrar… */}
                <button
                  type="button"
                  onClick={() => {
                    onRename?.(item);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] flex items-center gap-2 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-[#A78BFA]" />
                  <span>Renombrar…</span>
                </button>

                <div className="h-px bg-[#26354A] my-1" />

                {/* 5. Copiar nombre */}
                <button
                  type="button"
                  onClick={() => {
                    onCopyName?.(item);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] flex items-center gap-2 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-[#94A3B8]" />
                  <span>Copiar nombre</span>
                </button>

                {/* 6. Copiar ruta */}
                <button
                  type="button"
                  onClick={() => {
                    onCopyPath?.(item);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] flex items-center gap-2 cursor-pointer"
                >
                  <Link className="w-3.5 h-3.5 text-[#38BDF8]" />
                  <span>Copiar ruta</span>
                </button>

                {/* 7. Copiar link */}
                <button
                  type="button"
                  onClick={() => {
                    onCopyLink?.(item);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] flex items-center gap-2 cursor-pointer"
                >
                  <Link className="w-3.5 h-3.5 text-[#00B4FF]" />
                  <span>Copiar link</span>
                </button>

                {/* 8. Copiar dominio */}
                <button
                  type="button"
                  onClick={() => {
                    onCopyDomain?.(domain);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] flex items-center gap-2 cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 text-[#34D399]" />
                  <span>Copiar dominio</span>
                </button>

                {/* 9. Copiar dominio y tipo */}
                <button
                  type="button"
                  onClick={() => {
                    onCopyDomainType?.(chatCode);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] flex items-center gap-2 cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 text-[#22C55E]" />
                  <span>Copiar dominio y tipo</span>
                </button>

                {/* 10. Copiar contenido */}
                <button
                  type="button"
                  onClick={() => {
                    onCopyContent?.(item);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[#CBD5E1]" />
                  <span>Copiar contenido</span>
                </button>

                {/* 11. Ir al dominio */}
                <button
                  type="button"
                  onClick={() => {
                    onOpenDomain?.(domain);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] flex items-center gap-2 cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 text-[#38BDF8]" />
                  <span>Ir al dominio</span>
                </button>

                <div className="h-px bg-[#26354A] my-1" />

                {/* 12. Crear carpeta aquí... */}
                <button
                  type="button"
                  onClick={() => {
                    const target = item.target || item.path;
                    onCreateFolder?.(target);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#00C8FF] text-[11px] flex items-center gap-2 cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-[#00C8FF]" />
                  <span>Crear carpeta aquí...</span>
                </button>

                {/* 13. Subir archivo (Submenú) */}
                <div
                  className="relative"
                  onMouseEnter={() => setActiveSubmenu("upload")}
                  onMouseLeave={() => setActiveSubmenu(null)}
                >
                  <button
                    type="button"
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#60A5FA] text-[11px] flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Upload className="w-3.5 h-3.5 text-[#60A5FA]" />
                      <span>Subir archivo</span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-[#64748B]" />
                  </button>

                  {activeSubmenu === "upload" && (
                    <div className="absolute left-full top-0 ml-1 bg-[#0D1522] border border-[#00C8FF]/40 rounded-lg shadow-2xl p-1 w-56 z-50">
                      <button
                        type="button"
                        onClick={() => {
                          onOpenUploadDropbox?.();
                          setContextMenu(null);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] flex items-center gap-2 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#00E5FF]" />
                        <span>A Dropbox (DRX Inteligente)...</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const target = item.target || item.path;
                          onOpenUploadDropbox?.(target);
                          setContextMenu(null);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] flex items-center gap-2 cursor-pointer"
                      >
                        <Folder className="w-3.5 h-3.5 text-[#38BDF8]" />
                        <span>A esta carpeta en Dropbox...</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenUploadDropbox?.();
                          setContextMenu(null);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] flex items-center gap-2 cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5 text-[#A78BFA]" />
                        <span>A Notion — Revisiones...</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="h-px bg-[#26354A] my-1" />

                {/* 14. Duplicar… */}
                <button
                  type="button"
                  onClick={() => {
                    onDuplicate?.(item);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#CBD5E1] text-[11px] flex items-center gap-2 cursor-pointer"
                >
                  <CopyPlus className="w-3.5 h-3.5 text-[#818CF8]" />
                  <span>Duplicar…</span>
                </button>

                {/* 15. Eliminar */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedIds.has(item.id) && selectedIds.size > 1 && onDeleteSelected) {
                      onDeleteSelected();
                    } else {
                      onDelete(item);
                    }
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#EF4444]/20 text-[#EF4444] text-[11px] flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#F87171]" />
                  <span>
                    {selectedIds.has(item.id) && selectedIds.size > 1
                      ? `Eliminar seleccionadas (${selectedIds.size})`
                      : "Eliminar"}
                  </span>
                </button>

                <div className="h-px bg-[#26354A] my-1" />

                {/* 16. Agregar a Favoritos / Quitar de Favoritos */}
                <button
                  type="button"
                  onClick={() => {
                    onToggleBookmark?.(item);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1E2836] text-[#FBBF24] text-[11px] flex items-center gap-2 cursor-pointer"
                >
                  <Star className={`w-3.5 h-3.5 ${isFav ? "fill-[#FBBF24] text-[#FBBF24]" : "text-[#FBBF24]"}`} />
                  <span>{isFav ? "Quitar de Favoritos" : "Agregar a Favoritos"}</span>
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
