"use client";
import { Bot } from "lucide-react";
import { normalizePerson } from "@/services/identityNormalizer";

/** Accesos directos a los agentes de Grok (protocolo grokbot://) de cada colaborador. */
export const GROK_BOTS = [
  { name: "Sotelo", id: "92edf09c-b992-4989-8ff2-6f56ea603dd7" },
  { name: "Karla", id: "81f4c7dc-72ac-4e8f-a279-06fc701eecac" },
  { name: "Andrade", id: "ae6e01b6-b3b8-4236-ab86-c57a16b5e97d" },
  { name: "Neftali", id: "b977238d-da9a-4e1f-a388-6cc85d38ad50" },
  { name: "Edwin", id: "18526c68-329d-4187-b1d7-d976ea4d5d0e" },
  { name: "Becerra", id: "1ff75697-7898-4f93-9a71-9d636d8a2ff5" },
  { name: "Acalli", id: "aa1a025c-d202-4835-acbc-27d3c845e7a5" },
  { name: "Robot", id: "c4601473-a870-4dbf-b846-fbba7cd8de7d" },
] as const;

export const BOTS_PANEL_URL = "https://panel-bots-john.vercel.app/";

export const grokBotUrl = (id: string) => `grokbot://app/v1/agent?id=${id}`;

export function BotLinks({ currentUser, scale = 1 }: { currentUser?: string; scale?: number }) {
  const me = currentUser ? normalizePerson(currentUser) : "";
  const fontSize = `${(10 * scale).toFixed(1)}px`;
  return (
    <div
      role="group"
      aria-label="Bots de Grok"
      className="flex flex-wrap items-center gap-1 rounded border border-[#202E42] bg-[#101722] px-1 py-0.5"
    >
      <a
        href={BOTS_PANEL_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize }}
        title="Abrir panel de bots"
        className="flex items-center gap-1 px-1 font-semibold text-violet-300 hover:text-violet-100"
      >
        <Bot className="h-3.5 w-3.5" aria-hidden />
        Bots
      </a>
      {GROK_BOTS.map(({ name, id }) => {
        const mine = me && normalizePerson(name) === me;
        return (
          <a
            key={id}
            href={grokBotUrl(id)}
            style={{ fontSize }}
            title={`Abrir bot de ${name} en Grok`}
            className={`rounded border px-1.5 py-0.5 font-semibold leading-none transition-colors ${
              mine
                ? "border-violet-400 bg-violet-600/30 text-violet-100"
                : "border-violet-900/70 bg-violet-950/40 text-violet-300 hover:border-violet-500 hover:text-white"
            }`}
          >
            {name}
          </a>
        );
      })}
    </div>
  );
}

