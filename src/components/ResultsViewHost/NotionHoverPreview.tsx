"use client";
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SearchResultRow } from '@/types/anfeta';
import { calendarDisplayTitle, calendarDomain } from '@/services/calendarPresentation';
import { hoverPreviewBounds, previewPageId, loadNotionPreview, invalidateNotionPreview } from '@/lib/notionPreviewResource';
import { NotionPreviewBlock, type PreviewBlock } from './NotionPreviewBlock';
import { ActivityTitleFieldEditor } from '../ActivityTitleFieldEditor';
import { Edit3 } from 'lucide-react';

interface Props {
  item: SearchResultRow | null;
  anchorRect: DOMRect | null;
  isOpen: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

interface State {
  id: string;
  blocks: PreviewBlock[];
  content: string;
  loading: boolean;
  error: string;
}

export function NotionHoverPreview({ item, anchorRect, isOpen, onMouseEnter, onMouseLeave }: Props) {
  const id = previewPageId(item);
  const [state, setState] = useState<State>({ id: '', blocks: [], content: '', loading: false, error: '' });
  const [revision, setRevision] = useState(0);
  const [viewport, setViewport] = useState({ width: 1200, height: 800 });
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [overrideTitle, setOverrideTitle] = useState('');
  const overlayOpen = useRef(false);

  useEffect(() => {
    setOverrideTitle('');
    setIsEditingTitle(false);
  }, [id]);

  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    const changed = (e: Event) => {
      const pageId = String((e as CustomEvent).detail?.pageId || '').replace(/-/g, '');
      if (pageId === id) {
        invalidateNotionPreview(id);
        setRevision(n => n + 1);
      }
    };
    window.addEventListener('anfeta_page_content_changed', changed);
    return () => window.removeEventListener('anfeta_page_content_changed', changed);
  }, [id]);

  useEffect(() => {
    if (!isOpen || !id) return;
    const controller = new AbortController();
    let active = true;
    setState({ id, blocks: [], content: '', loading: true, error: '' });
    loadNotionPreview(id, controller.signal)
      .then(data => {
        if (active && !controller.signal.aborted) {
          setState({ id, blocks: data.blocks, content: data.content, loading: false, error: '' });
        }
      })
      .catch(error => {
        if (active && !controller.signal.aborted) {
          setState({
            id,
            blocks: [],
            content: '',
            loading: false,
            error: error instanceof Error ? error.message : 'No se pudo cargar la vista previa.',
          });
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id, isOpen, revision]);

  if (!isOpen || !item || !anchorRect || !id || typeof document === 'undefined') return null;

  const current = state.id === id ? state : { id, blocks: [], content: '', loading: true, error: '' };
  const rawName = overrideTitle || item.name || '';
  const title = calendarDisplayTitle(rawName),
    domain = calendarDomain(rawName, item.domainChip || item.domain || '');
  const bounds = hoverPreviewBounds(anchorRect, viewport.width, viewport.height);

  return createPortal(
    <section
      role="region"
      aria-label="Vista previa de Notion"
      onMouseEnter={onMouseEnter}
      onMouseLeave={() => {
        if (!overlayOpen.current && !isEditingTitle) onMouseLeave();
      }}
      style={{
        position: 'fixed',
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        maxHeight: bounds.height,
        zIndex: 9999,
      }}
      className="flex flex-col overflow-hidden rounded-xl border border-purple-500/60 bg-[#180E2B] text-slate-100 shadow-2xl"
    >
      <header className="shrink-0 border-b border-purple-800 bg-[#21123B] px-4 py-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-xs text-purple-300">Vista previa de Notion · {domain}</p>
          <button
            type="button"
            onClick={() => {
              setIsEditingTitle(v => !v);
              overlayOpen.current = true;
            }}
            className="flex items-center gap-1 rounded bg-purple-900/60 border border-purple-600/50 px-2 py-0.5 text-[11px] text-purple-200 hover:bg-purple-800 transition-colors"
            title="Editar título por campos (prefijo, mes, dominio, código, descripción)"
          >
            <Edit3 size={11} />
            <span>{isEditingTitle ? 'Ocultar edición' : 'Editar título'}</span>
          </button>
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold">{title}</h3>
      </header>

      {isEditingTitle &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={() => {
              setIsEditingTitle(false);
              overlayOpen.current = false;
            }}
          >
            <div
              className="w-full max-w-4xl max-h-[92vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <ActivityTitleFieldEditor
                pageId={id}
                initialTitle={rawName}
                onSaveSuccess={newTitle => {
                  item.name = newTitle;
                  setOverrideTitle(newTitle);
                  setIsEditingTitle(false);
                  overlayOpen.current = false;
                  setRevision(n => n + 1);
                  try {
                    window.dispatchEvent(
                      new CustomEvent('anfeta_item_renamed', {
                        detail: { id, newName: newTitle },
                      })
                    );
                  } catch {}
                }}
                onCancel={() => {
                  setIsEditingTitle(false);
                  overlayOpen.current = false;
                }}
              />
            </div>
          </div>,
          document.body
        )}

      <div
        className="min-h-0 flex-1 overflow-y-auto p-4 select-text"
        style={{ maxHeight: Math.max(40, bounds.height - (isEditingTitle ? 420 : 120)) }}
      >
        {current.loading ? (
          <p role="status" className="text-sm text-purple-200">
            Cargando contenido…
          </p>
        ) : current.error ? (
          <div role="alert">
            <p className="text-sm text-rose-200">{current.error}</p>
            <button
              type="button"
              onClick={() => {
                invalidateNotionPreview(id);
                setRevision(n => n + 1);
              }}
              className="mt-2 rounded border border-purple-500 px-3 py-1 text-sm"
            >
              Reintentar
            </button>
          </div>
        ) : current.blocks.length ? (
          current.blocks.map((block, index) => (
            <NotionPreviewBlock
              key={id + ':' + (block.id || index)}
              block={block}
              index={index}
              pageTitle={title}
              onOverlayChange={open => {
                overlayOpen.current = open;
                onMouseEnter();
              }}
            />
          ))
        ) : current.content ? (
          <p className="whitespace-pre-wrap text-sm">{current.content}</p>
        ) : (
          <p className="text-sm text-purple-200">Esta página no tiene contenido disponible.</p>
        )}
      </div>
      <footer className="shrink-0 border-t border-purple-900 px-4 py-2 text-xs text-purple-300">
        Desplázate para ver el contenido · El clic en la fila abre Detalles
      </footer>
    </section>,
    document.body
  );
}
