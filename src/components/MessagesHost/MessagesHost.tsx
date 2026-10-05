"use client";

import React, { useState } from "react";
import { MessageSquare, Send, User, Search, Pin } from "lucide-react";
import { MessageItem } from "@/types/anfeta";
import { playTickSound } from "@/utils/soundAndFx";

const SAMPLE_CONVERSATIONS: MessageItem[] = [
  {
    id: "conv-1",
    conversationTitle: "John (Supervisor)",
    conversationPreview: "Revisión lista para el despliegue del fin de semana",
    conversationContactLabel: "John",
    conversationTimeLabel: "14:20",
    avatarText: "JO",
    avatarColor: "#38BDF8",
    isUnread: true,
    unreadCount: 2,
    type: "chat",
    messages: [
      { id: "m1", sender: "John", content: "¿Cómo va la migración de ANFETA a Next.js 15?", timestamp: "14:15", isMe: false },
      { id: "m2", sender: "Yo", content: "Excelente, todos los módulos operando a 60 FPS con 0 ms de latencia.", timestamp: "14:18", isMe: true },
      { id: "m3", sender: "John", content: "Revisión lista para el despliegue del fin de semana", timestamp: "14:20", isMe: false },
    ],
  },
  {
    id: "conv-2",
    conversationTitle: "Karla (Diseño)",
    conversationPreview: "Se actualizaron los tokens de color Dark Mode",
    conversationContactLabel: "Karla",
    conversationTimeLabel: "11:05",
    avatarText: "KA",
    avatarColor: "#F472B6",
    type: "chat",
    messages: [
      { id: "m4", sender: "Karla", content: "Se actualizaron los tokens de color Dark Mode con azul neón #00A8FF", timestamp: "11:05", isMe: false },
    ],
  },
  {
    id: "conv-3",
    conversationTitle: "Notas de Proyecto (General)",
    conversationPreview: "Recordatorio: Sync de base de datos a las 18:00",
    conversationContactLabel: "Sistema",
    conversationTimeLabel: "09:00",
    avatarText: "SYS",
    avatarColor: "#A855F7",
    type: "projects",
    messages: [
      { id: "m5", sender: "Sistema", content: "Recordatorio: Sync de base de datos a las 18:00", timestamp: "09:00", isMe: false },
    ],
  },
];

export function MessagesHost() {
  const [conversations, setConversations] = useState<MessageItem[]>(SAMPLE_CONVERSATIONS);
  const [selectedId, setSelectedId] = useState<string>("conv-1");
  const [inputText, setInputText] = useState("");

  const activeConv = conversations.find((c) => c.id === selectedId) || conversations[0];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg = {
      id: `m_${Date.now()}`,
      sender: "Yo",
      content: inputText.trim(),
      timestamp: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
      isMe: true,
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId
          ? {
              ...c,
              conversationPreview: newMsg.content,
              messages: [...(c.messages || []), newMsg],
            }
          : c
      )
    );

    playTickSound();
    setInputText("");
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-[#080B0F] select-none">
      {/* Left conversation list */}
      <div className="w-72 bg-[#0F141A] border-r border-[#26323E] flex flex-col flex-shrink-0">
        <div className="h-11 px-3 border-b border-[#26323E] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#00A8FF]" />
            <h3 className="text-xs font-bold text-[#F1F5F9]">Bandeja de Mensajes</h3>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#131A22] scrollbar-thin">
          {conversations.map((c) => {
            const isSel = c.id === selectedId;
            return (
              <div
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`p-3 cursor-pointer flex items-start gap-2.5 transition-colors ${
                  isSel ? "bg-[#18212B]" : "hover:bg-[#11161C]"
                }`}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-[#080B0F] flex-shrink-0"
                  style={{ backgroundColor: c.avatarColor }}
                >
                  {c.avatarText}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h4 className="text-xs font-semibold text-[#F1F5F9] truncate">
                      {c.conversationTitle}
                    </h4>
                    <span className="text-[10px] font-mono text-[#64748B]">
                      {c.conversationTimeLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#94A3B8] truncate">
                    {c.conversationPreview}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right chat message thread */}
      <div className="flex-1 flex flex-col h-full bg-[#080B0F]">
        {/* Thread header */}
        <div className="h-11 px-4 bg-[#0F141A] border-b border-[#26323E] flex items-center justify-between">
          <span className="text-xs font-bold text-[#F1F5F9]">
            {activeConv.conversationTitle}
          </span>
          <span className="text-[10px] font-mono text-[#64748B]">
            {activeConv.messages?.length || 0} mensajes
          </span>
        </div>

        {/* Message feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {activeConv.messages?.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.isMe ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-md p-2.5 rounded-lg text-xs ${
                  m.isMe
                    ? "bg-[#00A8FF] text-[#080B0F] font-medium"
                    : "bg-[#131A22] text-[#E2E8F0] border border-[#26323E]"
                }`}
              >
                {m.content}
              </div>
              <span className="text-[9px] font-mono text-[#64748B] mt-0.5 px-1">
                {m.timestamp}
              </span>
            </div>
          ))}
        </div>

        {/* Send message form */}
        <form
          onSubmit={handleSend}
          className="h-12 bg-[#0F141A] border-t border-[#26323E] px-3 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Escribe un mensaje o nota rápida..."
            className="flex-1 h-8 px-3 bg-[#080B0F] text-xs text-[#F1F5F9] rounded border border-[#26323E] focus:outline-none focus:border-[#00A8FF]"
          />
          <button
            type="submit"
            className="p-2 bg-[#00A8FF] hover:bg-[#1FB6FF] text-[#080B0F] rounded font-bold"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
