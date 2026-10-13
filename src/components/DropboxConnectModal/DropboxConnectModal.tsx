"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Cloud,
  ExternalLink,
  Key,
  X,
  Check,
  AlertCircle,
  RotateCw,
  Copy,
  CheckCheck,
  ShieldCheck,
  Unlink,
  ClipboardPaste,
} from "lucide-react";
import { getDropboxAuthorizeUrl, DropboxOAuthAccountInfo } from "@/lib/dropboxConfig";

interface DropboxConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: (info: DropboxOAuthAccountInfo) => void;
  onDisconnected?: () => void;
}

export function DropboxConnectModal({
  isOpen,
  onClose,
  onConnected,
  onDisconnected,
}: DropboxConnectModalProps) {
  const [authCode, setAuthCode] = useState("");
  const [isExchanging, setIsExchanging] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Leer estado actual de conexión
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setTestResult(null);
    setAuthCode("");
    setIsReconnecting(false);

    try {
      const stored = localStorage.getItem("anfeta_settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.dropboxToken && parsed.dropboxToken.trim() && parsed.dropboxAccountName) {
          setHasToken(true);
          setConnectedAccount(parsed.dropboxAccountName);
          setConnectedEmail(parsed.dropboxAccountEmail || "");
        } else {
          setHasToken(false);
          setConnectedAccount(null);
          setConnectedEmail(null);
        }
      } else {
        setHasToken(false);
        setConnectedAccount(null);
        setConnectedEmail(null);
      }
    } catch {
      setHasToken(false);
    }

    // Consultar también la configuración del servidor
    fetch("/api/data?type=settings")
      .then((r) => r.json())
      .then((data) => {
        if (data && data.dropboxToken && data.dropboxAccountName) {
          setHasToken(true);
          setConnectedAccount(data.dropboxAccountName);
          if (data.dropboxAccountEmail) setConnectedEmail(data.dropboxAccountEmail);
        } else if (!data?.dropboxToken) {
          setHasToken(false);
          setConnectedAccount(null);
          setConnectedEmail(null);
        }
      })
      .catch(() => {});

    // Auto-focus en el campo de código tras abrir el modal
    setTimeout(() => {
      codeInputRef.current?.focus();
    }, 150);
  }, [isOpen]);

  if (!isOpen) return null;

  const authUrl = getDropboxAuthorizeUrl();

  const handleOpenAuthUrl = () => {
    if (typeof window !== "undefined") {
      window.open(authUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(authUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {}
  };

  const handlePasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setAuthCode(text.trim());
        setErrorMessage(null);
      }
    } catch {}
  };

  const handleExchangeCode = async () => {
    const cleanCode = authCode.trim();
    if (!cleanCode) {
      setErrorMessage("Por favor pega el código de autorización que Dropbox te mostró.");
      return;
    }

    setIsExchanging(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "exchange-dropbox-code",
          payload: { code: cleanCode },
        }),
      });

      const data = await res.json().catch(() => null);

      if (data?.success) {
        const accountName = data.account || "Cuenta de Dropbox";
        const email = data.email || "";
        const token = data.token || "";

        setHasToken(true);
        setConnectedAccount(accountName);
        setConnectedEmail(email);
        setIsReconnecting(false);
        setSuccessMessage(`✓ ¡Vinculado exitosamente con Dropbox! Cuenta: ${accountName}`);

        // Persistir en localStorage
        try {
          const prev = JSON.parse(localStorage.getItem("anfeta_settings") || "{}");
          const updated = {
            ...prev,
            dropboxToken: token,
            dropboxAccountName: accountName,
            dropboxAccountEmail: email,
          };
          localStorage.setItem("anfeta_settings", JSON.stringify(updated));
          window.dispatchEvent(new CustomEvent("anfeta_settings_changed", { detail: updated }));
        } catch {}

        if (onConnected) {
          onConnected({
            account: accountName,
            email,
            token,
            hasRefreshToken: data.hasRefreshToken,
          });
        }
      } else {
        setErrorMessage(data?.error || "No se pudo vincular la cuenta. Verifica el código e intenta de nuevo.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Error de red al conectar con el servidor.");
    } finally {
      setIsExchanging(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-dropbox-token" }),
      });
      const data = await res.json().catch(() => null);

      if (data?.success) {
        const account = data.account || data.email || "Cuenta activa";
        setTestResult({ ok: true, msg: `✓ Conexión activa: ${account}` });
        setConnectedAccount(account);
        if (data.email) setConnectedEmail(data.email);
      } else {
        setTestResult({ ok: false, msg: `✕ ${data?.error || "Error al verificar la conexión"}` });
      }
    } catch (err: any) {
      setTestResult({ ok: false, msg: `✕ Error: ${err?.message || "Tiempo de espera agotado"}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("¿Deseas desvincular la cuenta de Dropbox de ANFETA?")) return;

    setIsDisconnecting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect-dropbox" }),
      });

      setHasToken(false);
      setConnectedAccount(null);
      setConnectedEmail(null);
      setTestResult(null);
      setSuccessMessage("Cuenta de Dropbox desvinculada.");

      try {
        const prev = JSON.parse(localStorage.getItem("anfeta_settings") || "{}");
        const updated = {
          ...prev,
          dropboxToken: "",
          dropboxAccountName: "",
          dropboxAccountEmail: "",
        };
        localStorage.setItem("anfeta_settings", JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent("anfeta_settings_changed", { detail: updated }));
      } catch {}

      if (onDisconnected) onDisconnected();
    } catch (err: any) {
      setErrorMessage(err?.message || "Error al desvincular la cuenta.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-lg bg-[#0D131B] border border-[#26354A] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-5 py-3.5 bg-[#141C27] border-b border-[#26354A] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Cloud className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#F1F5F9] flex items-center gap-2">
                <span>Conectar Dropbox con ANFETA</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono">
                  OAuth 2.0
                </span>
              </h2>
              <p className="text-[11px] text-[#94A3B8]">
                Autorización directa mediante código oficial de Dropbox
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1E2836] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs text-[#CBD5E1]">
          {/* Mensajes globales de éxito o error */}
          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 flex items-start gap-2">
              <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="space-y-1">
                <p className="font-semibold">No se pudo vincular la cuenta</p>
                <p className="text-[11px] text-rose-200">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Estado de cuenta conectada (si existe) */}
          {hasToken && (
            <div className="space-y-3 p-3.5 rounded-lg bg-[#111A24] border border-[#233547]">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    <span className="font-semibold text-cyan-300 text-xs">
                      Cuenta Vinculada Actualmente
                    </span>
                  </div>
                  <p className="text-[#F1F5F9] font-medium text-xs">
                    {connectedAccount || "Cuenta de Dropbox"}
                  </p>
                  {connectedEmail && (
                    <p className="text-[11px] text-[#94A3B8] font-mono">{connectedEmail}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Auto-renovación activa</span>
                </div>
              </div>

              {testResult && (
                <div
                  className={`p-2 rounded text-[11px] ${
                    testResult.ok
                      ? "bg-emerald-950/40 border border-emerald-500/30 text-emerald-300"
                      : "bg-rose-950/40 border border-rose-500/30 text-rose-300"
                  }`}
                >
                  {testResult.msg}
                </div>
              )}

              <div className="pt-2 flex items-center justify-between border-t border-[#1C2735]">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="px-3 py-1.5 bg-[#162232] hover:bg-[#1E2E44] border border-[#2B4058] text-cyan-300 rounded font-medium text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isTesting ? "animate-spin" : ""}`} />
                  <span>{isTesting ? "Verificando..." : "Probar Conexión"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="px-2.5 py-1.5 bg-rose-950/30 hover:bg-rose-900/40 border border-rose-500/30 text-rose-300 rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
                  title="Desvincular Dropbox de ANFETA"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>{isDisconnecting ? "Desvinculando..." : "Desvincular Cuenta"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Flujo OAuth de 2 pasos (siempre disponible) */}
          <div className="space-y-3.5">
            <div>
              <p className="text-[#F1F5F9] font-semibold text-xs">
                {hasToken ? "Vincular otra cuenta o renovar permisos:" : "Vincular Cuenta con Dropbox:"}
              </p>
              <p className="text-[#94A3B8] text-[11px] mt-0.5">
                Solicita el permiso directamente a Dropbox en 2 sencillos pasos sin exponer contraseñas.
              </p>
            </div>

            {/* Paso 1 */}
            <div className="p-3.5 rounded-lg bg-[#111A24] border border-[#233547] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#F1F5F9] text-xs flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px] font-bold">
                    1
                  </span>
                  Solicitar permiso en Dropbox
                </span>
                <span className="text-[10px] text-[#94A3B8]">Abre pestaña nueva</span>
              </div>
              <p className="text-[11px] text-[#94A3B8]">
                Haz clic en el botón. En Dropbox, inicia sesión y haz clic en <strong className="text-white">"Permitir"</strong>.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleOpenAuthUrl}
                  className="flex-1 px-3.5 py-2 bg-[#00A8FF] hover:bg-[#1FB6FF] text-[#080B0F] font-bold rounded flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Dropbox y Autorizar</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  title="Copiar enlace de autorización al portapapeles"
                  className="px-2.5 py-2 bg-[#162232] hover:bg-[#1E2E44] border border-[#2B4058] text-cyan-300 rounded flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedUrl ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="text-[10.5px]">{copiedUrl ? "Copiado" : "Copiar Link"}</span>
                </button>
              </div>
            </div>

            {/* Paso 2 */}
            <div className="p-3.5 rounded-lg bg-[#111A24] border border-[#233547] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#F1F5F9] text-xs flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px] font-bold">
                    2
                  </span>
                  Pegar código de autorización
                </span>
                <span className="text-[10px] text-[#94A3B8]">Código de Dropbox</span>
              </div>
              <p className="text-[11px] text-[#94A3B8]">
                Pega aquí el código que te mostró Dropbox y pulsa vincular:
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={codeInputRef}
                    type="text"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    placeholder="Pega el código de autorización aquí..."
                    className="flex-1 h-9 px-3 bg-[#080B0F] border border-[#26323E] rounded text-[#F1F5F9] font-mono text-xs focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={handlePasteCode}
                    className="px-3 h-9 bg-[#162232] hover:bg-[#1E2E44] border border-[#2B4058] text-cyan-300 rounded font-medium text-xs flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                    title="Pegar código desde el portapapeles"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>Pegar</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleExchangeCode}
                  disabled={isExchanging || !authCode.trim()}
                  className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#080B0F] font-bold rounded flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                >
                  {isExchanging ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Canjeando código con Dropbox...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Vincular Cuenta de Dropbox</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Pie del modal */}
        <div className="px-5 py-3 bg-[#080B0F] border-t border-[#26354A] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] text-[#94A3B8]">
            <ShieldCheck className="w-3 h-3 text-cyan-400" />
            <span>Tus credenciales no se comparten con terceros.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#161F2C] hover:bg-[#1E2836] border border-[#26354A] text-[#CBD5E1] hover:text-white text-xs font-semibold rounded cursor-pointer transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
