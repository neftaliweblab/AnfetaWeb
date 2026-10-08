"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { readApiJson } from "@/lib/readApiJson";
import { Paperclip, Mic, Square, Trash2, Loader2, Play, Pause, Volume2, Image as ImageIcon, FileText } from "lucide-react";

export function GeneralMessages() {
  const [threads, setThreads] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [current, setCurrent] = useState("");
  const [selected, setSelected] = useState(() => {
    if (typeof window === "undefined") return "";
    const id = new URLSearchParams(window.location.search).get("thread") || "";
    return /^[a-f0-9-]{36}$/i.test(id) ? id : "";
  });
  const [messages, setMessages] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [archived, setArchived] = useState(false);
  const [more, setMore] = useState(false);
  const [newThread, setNewThread] = useState(false);

  // Adjuntos & Audio
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string; type: string; size?: number }>>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const drafts = useRef(new Map<string, string>());
  const [threadFilter, setThreadFilter] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);

  const draftKey = (thread: string) => current + ":" + thread;
  const rememberDraft = () => {
    if (current) drafts.current.set(draftKey(newThread ? "new" : selected), text);
  };

  const openThread = (id: string) => {
    rememberDraft();
    historyLoaded.current = false;
    setMessages([]);
    setSelected(id);
    setText(drafts.current.get(draftKey(id)) || "");
    setAttachments([]);
    setNewThread(false);
    setError("");
    setMore(false);
  };

  const selectedRef = useRef(selected);
  const historyLoaded = useRef(false);
  selectedRef.current = selected;

  const list = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await readApiJson(await fetch("/api/messages", { signal, cache: "no-store" }));
      if (signal?.aborted) return;
      setThreads(data.items);
      setPeople(data.people);
      setCurrent(data.currentId);
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : "No se pudieron cargar los hilos.");
    }
  }, []);

  const read = useCallback(
    async (signal?: AbortSignal, before?: number) => {
      if (!selected) return;
      try {
        const data = await readApiJson(
          await fetch("/api/messages?thread=" + selected + (before ? "&before=" + before : ""), {
            signal,
            cache: "no-store",
          })
        );
        if (signal?.aborted || selectedRef.current !== selected) return;
        if (before) historyLoaded.current = true;
        setMessages((old) => {
          const entries = new Map(old.map((m) => [m.id, m]));
          for (const m of data.items) entries.set(m.id, m);
          return [...entries.values()].sort((a, b) => a.id - b.id);
        });
        if (before || !historyLoaded.current) setMore(data.hasMore);
        if (data.items.length && !before && !document.hidden) {
          await readApiJson(
            await fetch("/api/messages", {
              method: "POST",
              signal,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "read",
                input: { thread: selected, lastRead: data.items[data.items.length - 1].id },
              }),
            })
          );
          void list(signal);
        }
      } catch (e) {
        if (!signal?.aborted) setError(e instanceof Error ? e.message : "No se pudo leer la conversación.");
      }
    },
    [selected, list]
  );

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (document.hidden || pending) return;
      pending = true;
      try {
        await list(controller.signal);
        if (selected) await read(controller.signal);
      } finally {
        pending = false;
      }
    };
    void refresh();
    const timer = setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [list, read, selected]);

  // Manejo de grabación de audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          setAttachments((prev) => [
            ...prev,
            {
              name: `Nota_Voz_${new Date().toISOString().replace(/[:.]/g, "-")}.webm`,
              url: base64Data,
              type: "audio/webm",
              size: audioBlob.size,
            },
          ]);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      setError("No se pudo acceder al micrófono.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  // Manejo de subida de archivos
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      if (file.size > 2 * 1024 * 1024) {
        setError(`El archivo "${file.name}" supera los 2 MB.`);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            url: reader.result as string,
            type: file.type || "application/octet-stream",
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Construir mensaje final con adjuntos codificados limpiamente
  const buildFinalMessageBody = (rawText: string) => {
    let finalBody = rawText.trim();
    if (attachments.length > 0) {
      const attachInfo = attachments
        .map((a) => {
          if (a.type.startsWith("audio/")) {
            return `\n🎙️ [Audio: ${a.name}]\n${a.url}`;
          }
          if (a.type.startsWith("image/")) {
            return `\n🖼️ [Imagen: ${a.name}]\n${a.url}`;
          }
          return `\n📎 [Archivo: ${a.name}]\n${a.url}`;
        })
        .join("\n");
      finalBody = finalBody ? `${finalBody}\n${attachInfo}` : attachInfo.trim();
    }
    return finalBody;
  };

  async function change(action: string, input: any) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await readApiJson(
        await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, input }),
        })
      );
      if (action === "create") {
        drafts.current.delete(draftKey("new"));
        setRecipients([]);
        historyLoaded.current = false;
        setMessages([]);
        setSelected(data.thread);
        setNewThread(false);
        setTopic("");
        setText("");
        setAttachments([]);
      }
      if (action === "send") {
        drafts.current.delete(draftKey(selected));
        setText("");
        setAttachments([]);
        await read();
      }
      await list();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el mensaje.");
    } finally {
      setBusy(false);
    }
  }

  // Renderizador inteligente de contenido de mensajes (detecta audios, imágenes y enlaces)
  const renderMessageContent = (body: string) => {
    const lines = body.split("\n");
    const elements: React.ReactNode[] = [];
    let currentText = "";

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:audio/")) {
        if (currentText) {
          elements.push(
            <p key={`txt-${idx}`} className="text-sm whitespace-pre-wrap break-words">
              {currentText}
            </p>
          );
          currentText = "";
        }
        elements.push(
          <div key={`audio-${idx}`} className="my-2 p-2 rounded bg-[#16202C] border border-[#26354A] flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-[#38BDF8] shrink-0" />
            <audio controls src={trimmed} className="w-full h-8 max-w-xs" />
          </div>
        );
      } else if (trimmed.startsWith("data:image/")) {
        if (currentText) {
          elements.push(
            <p key={`txt-${idx}`} className="text-sm whitespace-pre-wrap break-words">
              {currentText}
            </p>
          );
          currentText = "";
        }
        elements.push(
          <div key={`img-${idx}`} className="my-2 max-w-sm rounded overflow-hidden border border-[#26354A]">
            <img src={trimmed} alt="Adjunto" className="w-full h-auto max-h-60 object-contain bg-black/40" />
          </div>
        );
      } else {
        currentText = currentText ? `${currentText}\n${line}` : line;
      }
    });

    if (currentText) {
      elements.push(
        <p key="txt-last" className="text-sm whitespace-pre-wrap break-words">
          {currentText}
        </p>
      );
    }

    return elements;
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#080B0F] text-slate-200">
      {error && (
        <p role="alert" className="m-3 border border-red-800 bg-red-950 p-3 rounded text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        {/* Panel lateral: Hilos */}
        <aside className="w-full md:w-72 max-h-56 md:max-h-none overflow-auto p-3 border-r border-slate-800">
          <button
            disabled={!current || busy}
            onClick={() => {
              rememberDraft();
              setNewThread(true);
              setText(drafts.current.get(draftKey("new")) || "");
              setAttachments([]);
            }}
            className="rounded bg-sky-800 px-3 py-2 text-sm disabled:opacity-40 w-full font-medium hover:bg-sky-700 transition-colors cursor-pointer"
          >
            Nueva conversación
          </button>
          <label className="block text-xs my-3 select-none">
            <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Mostrar archivadas
          </label>
          <input
            aria-label="Buscar conversaciones"
            value={threadFilter}
            onChange={(e) => setThreadFilter(e.target.value)}
            placeholder="Buscar asunto o participante…"
            className="mb-2 w-full rounded bg-slate-900 border border-slate-800 p-2 text-xs focus:outline-none focus:border-sky-500"
          />
          <label className="mb-3 block text-xs select-none">
            <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} /> Solo sin leer
          </label>
          {threads
            .filter(
              (t) =>
                (archived || t.status !== "archived") &&
                (!onlyUnread || t.unread) &&
                [t.title, ...(t.members || []).map((id: string) => people.find((p) => p.id === id)?.name || "")]
                  .join(" ")
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .toLowerCase()
                  .includes(threadFilter.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim())
            )
            .map((t) => (
              <button
                key={t.id}
                disabled={busy}
                onClick={() => openThread(t.id)}
                className={
                  "block w-full text-left border rounded p-3 mb-2 text-xs transition-colors cursor-pointer " +
                  (selected === t.id ? "border-sky-700 bg-slate-800" : "border-slate-800 hover:bg-slate-900")
                }
              >
                <strong>
                  {t.unread ? "● " : ""}
                  {t.title}
                </strong>
                {t.status === "attention" && <span className="text-amber-300"> · Atención</span>}
                <p className="truncate text-slate-400 mt-1">{t.last_text}</p>
              </button>
            ))}
          {threads.length >= 200 && (
            <p className="text-xs text-amber-300">Se muestran las 200 conversaciones más recientes.</p>
          )}
        </aside>

        {/* Panel central: Conversación */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col p-3">
          {newThread ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const finalBody = buildFinalMessageBody(text);
                if (finalBody) {
                  void change("create", { title: topic, text: finalBody, members: recipients });
                }
              }}
              className="space-y-3"
            >
              <h3 className="font-semibold text-sm">Nueva conversación</h3>
              <input
                required
                maxLength={200}
                aria-label="Asunto"
                placeholder="Asunto"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full rounded bg-slate-900 border border-slate-800 p-3 text-sm focus:outline-none focus:border-sky-500"
              />
              <fieldset className="rounded border border-slate-800 p-3">
                <legend className="text-sm">Participantes ({recipients.length})</legend>
                <div className="flex flex-wrap gap-2">
                  {people
                    .filter((p) => p.id !== current)
                    .map((p) => (
                      <label
                        key={p.id}
                        className={
                          "flex items-center gap-2 rounded border px-3 py-2 text-sm cursor-pointer select-none " +
                          (recipients.includes(p.id)
                            ? "border-cyan-800 bg-cyan-950/40 text-cyan-200"
                            : "border-slate-700 text-slate-300")
                        }
                      >
                        <input
                          type="checkbox"
                          disabled={busy || (!recipients.includes(p.id) && recipients.length >= 19)}
                          checked={recipients.includes(p.id)}
                          onChange={(e) =>
                            setRecipients((old) => (e.target.checked ? [...old, p.id] : old.filter((id) => id !== p.id)))
                          }
                        />
                        {p.name}
                      </label>
                    ))}
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Selecciona una o varias personas. Solo los participantes pueden leer este hilo.
                </p>
              </fieldset>
              <textarea
                required={attachments.length === 0}
                disabled={busy}
                maxLength={4000}
                aria-label="Mensaje inicial"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escribe el mensaje inicial..."
                className="w-full rounded bg-slate-900 border border-slate-800 p-3 text-sm focus:outline-none focus:border-sky-500"
              />

              {/* Botonera de Adjuntos en Nueva Conversación */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  multiple
                  className="hidden"
                  accept="image/*,application/pdf,text/*"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:text-white cursor-pointer"
                >
                  <Paperclip className="w-3.5 h-3.5 text-sky-400" />
                  <span>Adjuntar</span>
                </button>
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs cursor-pointer ${
                    isRecording
                      ? "bg-red-950 border-red-700 text-red-200 animate-pulse"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                  }`}
                >
                  {isRecording ? <Square className="w-3.5 h-3.5 text-red-400" /> : <Mic className="w-3.5 h-3.5 text-sky-400" />}
                  <span>{isRecording ? `Grabando (${recordingSeconds}s)...` : "Nota de voz"}</span>
                </button>
              </div>

              {/* Lista de adjuntos en borrador */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {attachments.map((att, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#16202C] border border-[#26354A] text-xs text-cyan-300"
                    >
                      {att.type.startsWith("image/") ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                      <span className="max-w-[150px] truncate">{att.name}</span>
                      <button type="button" onClick={() => removeAttachment(i)} className="text-slate-400 hover:text-red-400 cursor-pointer">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                disabled={busy || !recipients.length || !topic.trim() || (!text.trim() && !attachments.length)}
                className="rounded bg-sky-800 hover:bg-sky-700 px-4 py-2 font-medium text-sm disabled:opacity-40 cursor-pointer"
              >
                Crear y enviar
              </button>
            </form>
          ) : selected ? (
            <>
              <header className="pb-3 border-b border-slate-800">
                <h3 className="font-semibold text-sm">{threads.find((t) => t.id === selected)?.title || "Conversación"}</h3>
                <p className="text-xs text-slate-400">
                  {(threads.find((t) => t.id === selected)?.members || [])
                    .map((id: string) => people.find((p) => p.id === id)?.name || "Persona del equipo")
                    .join(" · ")}
                </p>
              </header>
              <div className="flex gap-2 py-2 text-xs">
                <button
                  onClick={() => void change("status", { thread: selected, status: "attention" })}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-amber-300 cursor-pointer"
                >
                  Marcar atención
                </button>
                <button
                  onClick={() => void change("status", { thread: selected, status: "open" })}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-cyan-300 cursor-pointer"
                >
                  Activar
                </button>
                <button
                  onClick={() => void change("status", { thread: selected, status: "archived" })}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 cursor-pointer"
                >
                  Archivar
                </button>
              </div>
              <div className="flex-1 overflow-auto space-y-2 py-2">
                {more && (
                  <button onClick={() => void read(undefined, messages[0]?.id)} className="text-xs text-cyan-300 cursor-pointer">
                    Cargar mensajes anteriores
                  </button>
                )}
                {messages.map((m) => (
                  <article key={m.id} className="rounded border border-slate-800 bg-slate-900/50 p-3">
                    <p className="text-xs text-cyan-300 mb-1">
                      {people.find((p) => p.id === m.author_id)?.name || "Persona del equipo"} ·{" "}
                      {new Date(m.created_at).toLocaleString("es-MX")}
                    </p>
                    {renderMessageContent(m.body)}
                  </article>
                ))}
              </div>

              {/* Vista previa de adjuntos listos para enviar */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-2">
                  {attachments.map((att, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#16202C] border border-[#26354A] text-xs text-cyan-300"
                    >
                      {att.type.startsWith("image/") ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                      <span className="max-w-[180px] truncate">{att.name}</span>
                      <button type="button" onClick={() => removeAttachment(i)} className="text-slate-400 hover:text-red-400 cursor-pointer">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const finalBody = buildFinalMessageBody(text);
                  if (finalBody && !busy) {
                    void change("send", { thread: selected, text: finalBody });
                  }
                }}
                className="flex flex-col gap-2 pt-2 border-t border-slate-800"
              >
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    disabled={busy || !current}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        const finalBody = buildFinalMessageBody(text);
                        if (finalBody && !busy) void change("send", { thread: selected, text: finalBody });
                      }
                    }}
                    maxLength={4000}
                    aria-label="Mensaje"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="flex-1 min-w-0 rounded bg-slate-900 border border-slate-800 p-2.5 text-xs focus:outline-none focus:border-sky-500"
                    placeholder="Escribe un mensaje… (Ctrl+Enter para enviar)"
                  />
                  <button
                    disabled={busy || (!text.trim() && !attachments.length)}
                    className="rounded bg-sky-800 hover:bg-sky-700 px-4 font-medium text-xs disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    {busy ? "Guardando…" : "Enviar"}
                  </button>
                </div>

                {/* Barra de herramientas para adjuntos y micrófono */}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      multiple
                      className="hidden"
                      accept="image/*,application/pdf,text/*"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                      title="Adjuntar imagen o archivo"
                    >
                      <Paperclip className="w-3 h-3 text-sky-400" />
                      <span>Adjuntar</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded border cursor-pointer ${
                        isRecording
                          ? "bg-red-950 border-red-700 text-red-200 animate-pulse"
                          : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white"
                      }`}
                      title={isRecording ? "Detener grabación" : "Grabar nota de voz"}
                    >
                      {isRecording ? <Square className="w-3 h-3 text-red-400" /> : <Mic className="w-3 h-3 text-sky-400" />}
                      <span>{isRecording ? `Grabando ${recordingSeconds}s` : "Nota de voz"}</span>
                    </button>
                  </div>
                  <span className="text-[10px]">Borrador persistente durante la sesión</span>
                </div>
              </form>
            </>
          ) : (
            <p className="text-slate-400 text-sm">Selecciona una conversación o crea una nueva.</p>
          )}
        </div>
      </div>
    </section>
  );
}
