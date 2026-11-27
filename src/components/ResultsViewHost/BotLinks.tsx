"use client";
import React, { useState } from "react";
import { Bot } from "lucide-react";
import { normalizePerson } from "@/services/identityNormalizer";

export interface GrokBotEntry {
  short: string;
  name: string;
  id: string;
  title?: string;
}

/** Accesos directos a los agentes de Grok (protocolo grokbot://) de cada colaborador. */
export const GROK_BOTS: GrokBotEntry[] = [
  { short: "S", name: "Sotelo", id: "92edf09c-b992-4989-8ff2-6f56ea603dd7" },
  { short: "K", name: "Karla", id: "81f4c7dc-72ac-4e8f-a279-06fc701eecac" },
  { short: "A", name: "Andrade", id: "ae6e01b6-b3b8-4236-ab86-c57a16b5e97d" },
  { short: "N", name: "Neftali", id: "b977238d-da9a-4e1f-a388-6cc85d38ad50" },
  { short: "E", name: "Edwin", id: "18526c68-329d-4187-b1d7-d976ea4d5d0e" },
  { short: "Be", name: "Becerra", id: "1ff75697-7898-4f93-9a71-9d636d8a2ff5" },
  { short: "Ac", name: "Acalli", id: "aa1a025c-d202-4835-acbc-27d3c845e7a5" },
  { short: "R", name: "Robot", id: "c4601473-a870-4dbf-b846-fbba7cd8de7d" },
  { short: "NR", name: "Notion Robot", id: "419b4f80-28ba-48bd-910a-045696986572" },
  { short: "I", name: "Isaac", id: "4dc7768f-34d2-463b-8c42-4b6abad58a20" },
  { short: "MM", name: "MM", title: "Mente Maestra", id: "2b81be6e-0be6-4955-bf7d-ce0eea685e1c" },
];

export const BOTS_PANEL_URL = "https://panel-bots-john.vercel.app/";

export const grokBotUrl = (id: string) => `grokbot://app/v1/agent?id=${id}`;

export function findGrokBotForPerson(personName?: string | null): GrokBotEntry | null {
  if (!personName) return null;
  const canonical = normalizePerson(personName);
  if (!canonical || canonical === "Sin asignar") return null;
  return GROK_BOTS.find((bot) => normalizePerson(bot.name) === canonical) || null;
}

export function BotLinks({
  currentUser,
  scale = 1,
  compact = false,
}: {
  currentUser?: string;
  scale?: number;
  compact?: boolean;
}) {
  const me = currentUser ? normalizePerson(currentUser) : "";
  const fontSize = `${((compact ? 10 : 10) * scale).toFixed(1)}px`;
  const [activeBotLabel, setActiveBotLabel] = useState<string>("");

  return (
    <div
      role="group"
      aria-label="Bots de Grok"
      className="flex flex-wrap items-center gap-0.5 rounded-lg border border-violet-500/35 bg-[#101722]/90 px-1 py-0.5 shadow-[0_0_8px_rgba(139,92,246,0.14)]"
    >
      <a
        href={BOTS_PANEL_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize }}
        title="Abrir panel completo de Bots"
        className="flex items-center gap-1 rounded px-1.5 py-0.5 font-bold text-violet-200 bg-violet-600/20 border border-violet-400/40 hover:bg-violet-500/35 hover:text-white transition-colors"
      >
        <Bot className="h-3.5 w-3.5 text-violet-300" aria-hidden />
        <span>Bots</span>
      </a>
      {GROK_BOTS.map(({ short, name, id, title }) => {
        const fullName = title || name;
        const mine = me && normalizePerson(name) === me;
        return (
          <a
            key={id}
            href={grokBotUrl(id)}
            style={{ fontSize }}
            onMouseEnter={() => setActiveBotLabel(fullName)}
            onMouseLeave={() => setActiveBotLabel("")}
            onClick={() => setActiveBotLabel(`Abriendo: ${fullName}`)}
            title={`Bot de ${fullName} — Clic para abrir en Grok`}
            aria-label={`Abrir bot de ${fullName} en Grok`}
            className={`flex h-5 min-w-[20px] items-center justify-center rounded px-1 font-bold leading-none transition-all ${
              mine
                ? "bg-violet-500 text-slate-950 shadow-sm ring-1 ring-violet-300"
                : "text-violet-200/85 hover:bg-violet-600/30 hover:text-white border border-transparent hover:border-violet-400/50"
            }`}
          >
            {short}
          </a>
        );
      })}
      {activeBotLabel && (
        <span
          role="status"
          className="ml-1 rounded bg-violet-950/90 border border-violet-500/50 px-1.5 py-0.5 text-[9.5px] font-semibold text-violet-100 whitespace-nowrap"
        >
          {activeBotLabel}
        </span>
      )}
    </div>
  );
}
