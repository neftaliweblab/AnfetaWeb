"use client";

import React, { useState, useEffect } from "react";
import {
  Clipboard,
  X,
  Upload,
  Globe,
  Folder,
  Users,
  Check,
  Loader2,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import {
  playCheckChime,
  playCopyChime,
  sendWindowsNotification,
} from "@/services/windowsIntegration";

export interface GlobalPasteImagePayload {
  dataUrl: string;
  base64: string;
  filename: string;
  sizeBytes: number;
}

interface GlobalPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText?: string;
  initialImage?: GlobalPasteImagePayload | null;
  onSuccess: (newItem: any) => void;
}

const TEAM_PERSONS = [
  { id: "jjohn", name: "John" },
  { id: "kkarl", name: "Karla" },
  { id: "nneft", name: "Neftali" },
  { id: "iisai", name: "Isaias" },
  { id: "aandr", name: "Andrade" },
  { id: "bbria", name: "Brian" },
  { id: "ggena", name: "Genaro" },
  { id: "ssote", name: "Sotelo" },
  { id: "aacal", name: "Acalli" },
  { id: "eemma", name: "Emmanuel" },
];

const MAIN_TAGS = ["rtuz", "prtuz", "revision", "00", "zclientes", "zdominios", "zproyectos", "zpagar", "zcorreos"];

const JOHN_SUFFIXES = [
  { tag: ".webs", label: "Web" },
  { tag: ".ads", label: "Ads" },
  { tag: ".ceo", label: "SEO" },
  { tag: ".auditoria", label: "Auditoría" },
  { tag: ".cotizacion", label: "Cotización" },
  { tag: ".preproyecto", label: "Pre-Proyecto" },
  { tag: ".software", label: "Software" },
  { tag: ".aplicacion", label: "Aplicación" },
];

const DOMAIN_REGEX =
  /(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:com\.mx|org\.mx|gob\.mx|edu\.mx|net\.mx|com|mx|org|net|io|co|app|dev))/i;

export function GlobalPasteModal({
  isOpen,
  onClose,
  initialText = "",
  initialImage = null,
  onSuccess,
}: GlobalPasteModalProps) {
  const [dest, setDest] = useState<"notion" | "dropbox">("dropbox");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imagePayload, setImagePayload] = useState<GlobalPasteImagePayload | null>(initialImage);
  const [variant, setVariant] = useState<"" | "00" | "001" | "002" | "003">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStatusMsg(null);
      setIsSubmitting(false);
      setImagePayload(initialImage || null);
      setBody(initialText || "");

      if (initialImage) {
        setDest("dropbox");
        setTitle(initialImage.filename);
      } else {
        setDest("notion");
        const match = DOMAIN_REGEX.exec(initialText || "");
        if (match && match[1]) {
          const d = match[1].toLowerCase();
          if (!d.includes("notion.so") && !d.includes("google.com")) {
            setTitle(`${d} `);
          } else {
            setTitle("");
          }
        } else {
          setTitle("");
        }
      }
    }
  }, [isOpen, initialText, initialImage]);

  if (!isOpen) return null;

  const isUrl = (() => {
    try {
      const u = new URL(body.trim());
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  })();

  const currentDomain = (() => {
    const combined = `${title} ${body}`;
    const match = DOMAIN_REGEX.exec(combined);
    if (match && match[1]) {
      const d = match[1].toLowerCase();
      if (!d.includes("notion.so") && !d.includes("google.com")) return d;
    }
    return "anfeta.com";
  })();

  const handleAppendTag = (rawTag: string) => {
    let tagToAdd = rawTag.trim();
    if (variant && !tagToAdd.endsWith("00") && !tagToAdd.endsWith("001") && !tagToAdd.endsWith("002") && !tagToAdd.endsWith("003")) {
      tagToAdd += variant;
    }

    const cur = title.trim();
    const tokens = cur.split(/\s+/).filter(Boolean);
    if (tokens.includes(tagToAdd)) return;

    setTitle(cur ? `${tagToAdd} ${cur}` : `${tagToAdd} `);
  };

  const handleAssignAll002 = () => {
    let nextTitle = title.trim();
    TEAM_PERSONS.forEach((p) => {
      const tag = `${p.id}002`;
      if (!nextTitle.includes(tag)) {
        nextTitle = `${tag} ${nextTitle}`;
      }
    });
    setTitle(nextTitle.trim());
  };

  const handleAppendSuffix = (suffix: string) => {
    const cur = title.trim();
    if (!cur.toLowerCase().includes(suffix.toLowerCase())) {
      setTitle(cur ? `${cur} ${suffix}` : suffix);
    }
  };

  const handleReadClipboardAgain = async () => {
    try {
      if (navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          for (const type of item.types) {
            if (type.startsWith("image/")) {
              const blob = await item.getType(type);
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result as string;
                const base64 = dataUrl.split(",")[1];
                const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
                const filename = `Captura_${timestamp}.png`;
                setImagePayload({ dataUrl, base64, filename, sizeBytes: blob.size });
                setTitle(filename);
                setDest("dropbox");
                playCopyChime();
                setStatusMsg({ ok: true, text: "✓ Imagen cargada desde el portapapeles" });
              };
              reader.readAsDataURL(blob);
              return;
            }
          }
        }
      }

      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setBody(text.trim());
        setImagePayload(null);
        playCopyChime();
        setStatusMsg({ ok: true, text: "✓ Texto cargado desde el portapapeles" });
      } else {
        setStatusMsg({ ok: false, text: "El portapapeles está vacío o no contiene datos legibles." });
      }
    } catch (err: any) {
      setStatusMsg({ ok: false, text: "Permiso de portapapeles no concedido por el navegador." });
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setStatusMsg({ ok: false, text: "Ingresa un título o nombre para continuar." });
      return;
    }
    if (!imagePayload && !body.trim()) {
      setStatusMsg({ ok: false, text: "Ingresa el contenido o pega una imagen." });
      return;
    }

    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      // 1. Caso Imagen pegada a Dropbox
      if (imagePayload) {
        const res = await fetch("/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upload-to-dropbox",
            payload: {
              targetDir: `C:\\Users\\nanoc\\Dropbox\\DRX\\${currentDomain}.Carpeta`,
              filename: title.trim().endsWith(".png") ? title.trim() : `${title.trim()}.png`,
              base64: imagePayload.base64,
            },
          }),
        });

        const data = await res.json();
        setIsSubmitting(false);

        if (res.ok && data.success) {
          playCheckChime();
          sendWindowsNotification("Dropbox ANFETA", `Captura guardada en DRX: ${data.filename}`);
          setStatusMsg({ ok: true, text: `✓ Captura guardada con éxito en Dropbox: ${data.filename}` });
          onSuccess({
            id: `dropbox-paste-${Date.now()}`,
            name: data.filename,
            path: data.path,
            target: data.path,
            folder: data.targetDir,
            extension: "png",
            sizeBytes: data.sizeBytes,
            modifiedLocalDate: new Date().toISOString().slice(0, 10),
            daysModified: 0,
            serverModified: new Date().toISOString(),
            source: "Dropbox",
            sourceName: "Dropbox",
            isFolder: false,
            type: "FILE",
          });
          setTimeout(() => onClose(), 1000);
        } else {
          setStatusMsg({ ok: false, text: data.error || "Error al guardar captura en Dropbox" });
        }
        return;
      }

      // 2. Caso Texto/URL a Dropbox
      if (dest === "dropbox") {
        const res = await fetch("/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save-paste-to-dropbox",
            payload: {
              title: title.trim(),
              body: body.trim(),
              domain: currentDomain,
              isUrl,
            },
          }),
        });

        const data = await res.json();
        setIsSubmitting(false);

        if (res.ok && data.success) {
          playCheckChime();
          sendWindowsNotification("Dropbox ANFETA", `Guardado en DRX/${currentDomain}.Carpeta: ${data.filename}`);
          setStatusMsg({ ok: true, text: `✓ Guardado con éxito en Dropbox: ${data.filename}` });
          onSuccess({
            id: `dropbox-paste-${Date.now()}`,
            name: data.filename,
            path: data.path,
            target: data.path,
            folder: data.targetDir,
            extension: isUrl ? "url" : "txt",
            sizeBytes: data.sizeBytes,
            modifiedLocalDate: new Date().toISOString().slice(0, 10),
            daysModified: 0,
            serverModified: new Date().toISOString(),
            source: "Dropbox",
            sourceName: "Dropbox",
            isFolder: false,
            type: "FILE",
          });
          setTimeout(() => onClose(), 1000);
        } else {
          setStatusMsg({ ok: false, text: data.error || "Error al guardar en Dropbox" });
        }
        return;
      }

      // 3. Caso Notion
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-notion-page",
          payload: {
            title: title.trim(),
            body: body.trim(),
          },
        }),
      });

      const data = await res.json();
      setIsSubmitting(false);

      if (res.ok && data.success) {
        playCheckChime();
        sendWindowsNotification("Notion ANFETA", `Actividad creada: ${title}`);
        setStatusMsg({ ok: true, text: `✓ Actividad creada en Notion: ${title}` });
        onSuccess({
          id: data.pageId || `notion-${Date.now()}`,
          name: title.trim(),
          path: data.pageUrl || "",
          target: data.pageUrl || "",
          externalUrl: data.pageUrl,
          contentSnippet: body.slice(0, 200),
          modifiedLocalDate: new Date().toISOString().slice(0, 10),
          daysModified: 0,
          serverModified: new Date().toISOString(),
          source: "Notion",
          sourceName: "Notion",
          isFolder: false,
          type: "PAGE",
        });
        setTimeout(() => onClose(), 1000);
      } else {
        setStatusMsg({ ok: false, text: data.error || "Error al crear actividad en Notion" });
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setStatusMsg({ ok: false, text: err.message || "Error procesando solicitud" });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#0B1017] border-2 border-[#00A8FF]/60 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] anfeta-neon-glow">
        {/* Cabecera */}
        <div className="px-5 py-3.5 bg-[#0F1722] border-b border-[#1E2C3D] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0284C7]/20 border border-[#0284C7]/50 flex items-center justify-center text-[#38BDF8]">
              {imagePayload ? <ImageIcon className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#F1F5F9] flex items-center gap-1.5">
                {imagePayload ? (
                  <>
                    <span>🖼️ Guardar Captura de Pantalla</span>
                    <span className="px-1.5 py-0.2 rounded bg-[#0284C7]/30 text-[#7DD3FC] text-[9.5px]">Ctrl+V</span>
                  </>
                ) : dest === "dropbox" ? (
                  isUrl ? `🔗 Guardar enlace en Dropbox · DRX/${currentDomain}.Carpeta` : `📄 Guardar texto en Dropbox · DRX/${currentDomain}.Carpeta`
                ) : (
                  "📋 Pegar en Notion · Revisiones"
                )}
              </h3>
              <p className="text-[10px] text-[#64748B]">Flujo inteligente de captura global ANFETA</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#64748B] hover:text-[#CBD5E1] p-1.5 rounded hover:bg-[#1E2836] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs scrollbar-thin">
          {/* Vista previa de Imagen (si se pegó imagen) */}
          {imagePayload && (
            <div className="p-3 rounded-xl bg-[#0D1520] border border-[#1F334A] flex items-center gap-3.5">
              <div className="w-24 h-16 rounded-lg bg-black/50 border border-[#263E5A] overflow-hidden flex items-center justify-center shrink-0">
                <img
                  src={imagePayload.dataUrl}
                  alt="Captura"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="px-1.5 py-0.5 rounded bg-[#10B981]/20 border border-[#10B981]/40 text-[#6EE7B7] text-[9.5px] font-bold">
                    ✓ Imagen del Portapapeles
                  </span>
                  <span className="text-[10px] text-[#94A3B8]">
                    {(imagePayload.sizeBytes / 1024).toFixed(1)} KB
                  </span>
                </div>
                <p className="text-[10.5px] text-[#CBD5E1] font-mono truncate">
                  {imagePayload.filename}
                </p>
                <p className="text-[9.5px] text-[#64748B] mt-0.5">
                  Se guardará automáticamente en <strong className="text-[#38BDF8]">DRX/{currentDomain}.Carpeta/</strong>
                </p>
              </div>
            </div>
          )}

          {/* 1. Selector de Destino */}
          <div className="p-3 rounded-xl bg-[#0D1622] border border-[#1D2C3E] space-y-2">
            <span className="text-[11px] font-bold text-[#38BDF8] flex items-center gap-1.5">
              🎯 Destino:
            </span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-[#E2E8F0]">
                <input
                  type="radio"
                  name="dest"
                  checked={dest === "dropbox"}
                  onChange={() => setDest("dropbox")}
                  className="accent-[#38BDF8]"
                />
                <span className="font-semibold text-xs flex items-center gap-1">
                  <Folder className="w-3.5 h-3.5 text-[#F59E0B]" /> Dropbox · DRX/{currentDomain}.Carpeta
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-[#E2E8F0]">
                <input
                  type="radio"
                  name="dest"
                  checked={dest === "notion"}
                  onChange={() => setDest("notion")}
                  className="accent-[#38BDF8]"
                />
                <span className="font-semibold text-xs flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-[#38BDF8]" /> Notion · Revisiones
                </span>
              </label>
            </div>

            {dest === "dropbox" ? (
              <div className="mt-2 p-2 rounded bg-[#78350F]/20 border border-[#D97706]/40 text-[#FDE68A] text-[10.5px]">
                📁 <strong>Aviso de Dropbox:</strong> Se guardará dentro de{" "}
                <span className="font-mono text-white">DRX/{currentDomain}.Carpeta/</span> y se sincronizará e indexará de inmediato.
              </div>
            ) : (
              <p className="text-[10px] text-[#64748B]">
                🌐 Se creará una nueva actividad con contenido en Notion (Revisiones).
              </p>
            )}
          </div>

          {/* 2. Convención recomendada */}
          <div className="p-2.5 rounded-lg bg-[#0E2A38]/30 border border-[#0284C7]/30 text-[10.5px]">
            <span className="font-semibold text-[#7DD3FC] block mb-0.5">💡 Convención recomendada de título:</span>
            <span className="text-[#94A3B8]">
              [dominio.com] → [Tipo: sseo | aapli | aads | wwebs] → [Persona/Mes: jjuli | jjohn] → [Descripción]
            </span>
          </div>

          {/* 3. Título / Nombre */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[#CBD5E1] block">
              {imagePayload
                ? "Nombre del archivo de imagen en Dropbox:"
                : dest === "dropbox"
                ? isUrl
                  ? "Nombre del enlace en Dropbox (.url):"
                  : "Nombre del archivo de texto en Dropbox (.txt):"
                : "Título de la nueva página en Notion:"}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: dominio.com sseo jjuli Descripción de la actividad..."
              className="w-full bg-[#111A26] border border-[#23354B] rounded-lg px-3 py-2 text-xs text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
            />
          </div>

          {/* 4. Constructor de Tags & Prioridad */}
          <div className="p-3.5 rounded-xl bg-[#0F1722] border border-[#1E2C3D] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#E2E8F0]">🏷️ Etiquetas y Estados (Tags):</span>
              <button
                type="button"
                onClick={handleAssignAll002}
                className="text-[10px] font-semibold px-2 py-1 rounded bg-[#0284C7]/20 hover:bg-[#0284C7]/40 border border-[#0284C7]/50 text-[#38BDF8] flex items-center gap-1"
                title="Inserta los tags 002 secundarios de todos los integrantes"
              >
                <Users className="w-3 h-3" /> Asignar a Todos (002 Secundario)
              </button>
            </div>

            {/* Variantes de prioridad */}
            <div className="flex items-center gap-3 text-[10.5px]">
              <span className="text-[#64748B]">Variante:</span>
              {[
                { id: "", label: "Normal" },
                { id: "00", label: "00 (Urgente)", color: "text-[#EF4444]" },
                { id: "001", label: "001 (Importante)", color: "text-[#F59E0B]" },
                { id: "002", label: "002 (Secundaria)", color: "text-[#38BDF8]" },
                { id: "003", label: "003 (Recordar)", color: "text-[#A855F7]" },
              ].map((v) => (
                <label key={v.id} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="variant"
                    checked={variant === v.id}
                    onChange={() => setVariant(v.id as any)}
                    className="accent-[#38BDF8]"
                  />
                  <span className={v.color || "text-[#CBD5E1]"}>{v.label}</span>
                </label>
              ))}
            </div>

            {/* Principales Tags */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-[#64748B] mr-1">Principales:</span>
              {MAIN_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleAppendTag(tag)}
                  className="px-2 py-0.5 rounded bg-[#162232] hover:bg-[#1E2D42] border border-[#273B54] text-[10.5px] text-[#94A3B8] hover:text-[#38BDF8]"
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Sufijos John */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-[#64748B] mr-1">Sufijos John:</span>
              {JOHN_SUFFIXES.map((s) => (
                <button
                  key={s.tag}
                  type="button"
                  onClick={() => handleAppendSuffix(s.tag)}
                  className="px-2 py-0.5 rounded bg-[#0369A1]/20 hover:bg-[#0369A1]/40 border border-[#0284C7]/40 text-[10.5px] text-[#7DD3FC]"
                  title={`Agrega sufijo estándar ${s.label}`}
                >
                  {s.tag}
                </button>
              ))}
            </div>

            {/* Integrantes del equipo */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-[#64748B] mr-1">Personas:</span>
              {TEAM_PERSONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleAppendTag(p.id)}
                  className="px-2 py-0.5 rounded bg-[#1A2636] hover:bg-[#25364D] border border-[#2D4360] text-[10.5px] text-[#CBD5E1] hover:text-[#38BDF8]"
                >
                  {p.id}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Contenido / BODY (si no es imagen) */}
          {!imagePayload && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#CBD5E1] block">
                {dest === "dropbox" && isUrl
                  ? "URL del acceso directo (.url):"
                  : "Contenido / BODY (Texto pegado del portapapeles):"}
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                className="w-full bg-[#111A26] border border-[#23354B] rounded-lg p-2.5 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#38BDF8]"
              />
            </div>
          )}

          {/* Mensaje de estado */}
          {statusMsg && (
            <div
              className={`p-2.5 rounded-lg text-xs font-semibold ${
                statusMsg.ok
                  ? "bg-[#064E3B]/40 text-[#6EE7B7] border border-[#059669]/50"
                  : "bg-[#7F1D1D]/40 text-[#FCA5A5] border border-[#DC2626]/50"
              }`}
            >
              {statusMsg.text}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#0F1722] border-t border-[#1E2C3D] flex items-center justify-between">
          <button
            type="button"
            onClick={handleReadClipboardAgain}
            className="text-[10.5px] text-[#38BDF8] hover:underline flex items-center gap-1"
          >
            <Clipboard className="w-3 h-3" /> Releer portapapeles
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-lg border border-[#2A3C52] text-[#94A3B8] hover:text-[#CBD5E1] hover:bg-[#1E2836] text-xs font-medium"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !title.trim() || (!imagePayload && !body.trim())}
              className="px-4 py-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-sky-900/30"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {imagePayload
                      ? "Guardar captura en Dropbox"
                      : dest === "dropbox"
                      ? isUrl
                        ? "Guardar enlace .url en Dropbox"
                        : "Guardar archivo .txt en Dropbox"
                      : "Crear actividad"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
