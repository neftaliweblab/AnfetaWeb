export interface WhatsappGroupItem {
  id: string;
  name: string;
  domain?: string;
  inviteUrl?: string;
  lastSynced?: string;
  unreadCount?: number;
  notes?: string;
}

const STORAGE_KEY = "anfeta_whatsapp_groups_v1";

export function detectGroupDomain(name: string): string | undefined {
  if (!name) return undefined;
  // Check for domain pattern like domain.com, domain.mx, domain.app, etc.
  const domainMatch = name.match(/\b([a-zA-Z0-9-]+\.(?:com|mx|org|net|io|app|dev|me|tech|co|site|online|store))\b/i);
  if (domainMatch) return domainMatch[1].toLowerCase();

  // Check for project suffix pattern like .webs, .ads, .seo
  const suffixMatch = name.match(/\b([a-zA-Z0-9-]+)\.(webs|ads|seo|app|prog)\b/i);
  if (suffixMatch) return `${suffixMatch[1].toLowerCase()}.${suffixMatch[2].toLowerCase()}`;

  // Check for clean enterprise names in common formats: "[Empresa] - Proyecto" or "Empresa · Proyecto"
  const splitMatch = name.split(/[-–—·|:]/);
  if (splitMatch.length > 1 && splitMatch[0].trim().length >= 3) {
    return splitMatch[0].trim();
  }

  return undefined;
}

export function cleanInviteUrl(url: string): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (/^https:\/\/chat\.whatsapp\.com\/[a-zA-Z0-9_-]+/i.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}

export function getLocalWhatsappGroups(): WhatsappGroupItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalWhatsappGroups(groups: WhatsappGroupItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch {}
}

export async function fetchRemoteWhatsappGroups(): Promise<WhatsappGroupItem[]> {
  try {
    const res = await fetch("/api/whatsapp-directory", { cache: "no-store" });
    if (!res.ok) return getLocalWhatsappGroups();
    const data = await res.json();
    if (Array.isArray(data?.groups)) {
      saveLocalWhatsappGroups(data.groups);
      return data.groups;
    }
  } catch {}
  return getLocalWhatsappGroups();
}

export async function persistWhatsappGroups(groups: WhatsappGroupItem[]): Promise<boolean> {
  saveLocalWhatsappGroups(groups);
  try {
    const res = await fetch("/api/whatsapp-directory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groups }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
