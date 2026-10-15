"use client";

import React, { useState } from "react";
import { Lock, Shield, User, KeyRound, AlertCircle, ArrowRight } from "lucide-react";
import { PERSON_ALIASES, PERSON_METADATA } from "@/services/identityNormalizer";

interface LoginModalProps {
  sharedMode?:boolean;
  onSuccess: (userTag: string, options?: {sharedMode?:boolean}) => void;
}

const USERS = [
  { tag: "jjohn", name: "John", role: "Supervisor / Dirección" },
  { tag: "nneft", name: "Neftali", role: "Desarrollo & Automatización" },
  { tag: "kkarl", name: "Karla", role: "Diseño & Web" },
  { tag: "iisai", name: "Isaias", role: "SEO & Contenido" },
  { tag: "ssote", name: "Sotelo", role: "Cobranza & Operaciones" },
  { tag: "aacal", name: "Acalli", role: "Diseño & Multimedia" },
  { tag: "aandr", name: "Andrade", role: "ADS & Campañas" },
  { tag: "bbria", name: "Brian", role: "Desarrollo Web" },
  { tag: "ggena", name: "Genaro", role: "Desarrollo & Sistemas" },
];

export function LoginModal({ onSuccess,sharedMode=true }: LoginModalProps) {

  const [selectedUser, setSelectedUser] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("anfeta_last_user") || localStorage.getItem("anfeta_active_user");
        if (saved && USERS.some(u => u.tag === saved || u.name.toLowerCase() === saved.toLowerCase())) {
          const match = USERS.find(u => u.tag === saved || u.name.toLowerCase() === saved.toLowerCase());
          if (match) return match.tag;
        }
      } catch {}
    }
    return "nneft";
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e:React.FormEvent) => {
    e.preventDefault();if(loading)return;setError('');setLoading(true);
    try{
      const response=await fetch('/api/auth',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({user:selectedUser,password}),
        signal:AbortSignal.timeout(30000),
      });
      let data: any = null;
      try {
        data = await response.json();
      } catch {
        if (response.status === 504) {
          throw new Error('El servidor tardó en responder. Por favor intenta de nuevo.');
        }
        throw new Error(`Error en el servidor (HTTP ${response.status}).`);
      }
      if(!response.ok)throw new Error(data?.error || 'No se pudo iniciar sesión.');
      localStorage.removeItem('anfeta_auth_session');
      try { localStorage.setItem('anfeta_last_user', selectedUser); } catch {}
      onSuccess(data.user||'',{sharedMode:data.sharedMode===true});
    }catch(error){
      const raw = error instanceof Error ? error.message : 'No se pudo iniciar sesión.';
      let msg = raw;
      if (raw.includes('signal timed out') || raw.includes('aborted') || (error instanceof DOMException && error.name === 'TimeoutError')) {
        msg = 'Tiempo de espera agotado al conectar con el servidor. Intenta de nuevo.';
      } else if (raw.includes('is not valid JSON')) {
        msg = 'Error de conexión con el servidor. Intenta de nuevo.';
      }
      setError(msg);
    }finally{
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 select-none">
      <div className="w-full max-w-md rounded-2xl bg-[#0F141A] border border-[#26323E] shadow-[0_0_50px_rgba(0,168,255,0.25)] p-6 flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-[#162235] border border-[#38BDF8]/40 flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.3)]">
            <Lock className="w-7 h-7 text-[#38BDF8]" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#00A8FF] via-[#38BDF8] to-[#4ADE80]">
              ACCESO A ANFETA
            </h1>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Portal corporativo seguro de productividad y operaciones
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-950/50 border border-rose-600/50 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* User selector */}
          {!sharedMode&&<div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#38BDF8]" />
              Colaborador:
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full bg-[#080B0F] border border-[#26323E] text-slate-100 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition-colors"
            >
              {USERS.map((u) => (
                <option key={u.tag} value={u.tag}>
                  {u.name} — ({u.role})
                </option>
              ))}
            </select>
          </div>}
          {sharedMode&&<p className="text-xs text-slate-400">Ingresa con la clave compartida. Después podrás elegir tu persona.</p>}

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#38BDF8]" />
              Clave de acceso:
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Escribe la clave corporativa..."
              autoFocus
              className="w-full bg-[#080B0F] border border-[#26323E] text-slate-100 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition-colors"
            />
            <p className="text-[10px] text-slate-500 italic">
              {sharedMode?'Usa la clave de acceso corporativa compartida.':'Usa la contraseña de tu cuenta del equipo.'}
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-[#00A8FF] to-[#0284C7] hover:from-[#38BDF8] hover:to-[#0369A1] text-white font-bold text-xs shadow-lg shadow-cyan-950/50 hover:shadow-cyan-500/25 transition-all disabled:opacity-50"
          >
            {loading ? (
              <span>Verificando credenciales...</span>
            ) : (
              <>
                <span>Ingresar al Sistema</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-[#1C2633] pt-3">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-emerald-400" /> Sesión encriptada
          </span>
          <span className="font-mono">ANFETA v2.0 Live</span>
        </div>
      </div>
    </div>
  );
}
