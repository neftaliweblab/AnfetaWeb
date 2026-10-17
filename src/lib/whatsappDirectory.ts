export interface WhatsappGroupItem {
  id: string;
  name: string;
  domain?: string;
  inviteUrl?: string;
  lastSynced?: string;
  participantsCount?: number;
  unreadCount?: number;
  owner?: string;
  notes?: string;
  linkedActivityId?: string;
  linkedPageId?: string;
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

export function cleanInviteUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (/^https:\/\/chat\.whatsapp\.com\/[a-zA-Z0-9_-]+/i.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}

export interface MergeResult {
  groups: WhatsappGroupItem[];
  addedCount: number;
  updatedCount: number;
  unchangedCount: number;
}

export function mergeWhatsappGroups(
  existingList: WhatsappGroupItem[],
  incomingList: WhatsappGroupItem[]
): MergeResult {
  const existingMap = new Map<string, WhatsappGroupItem>();
  const nameToId = new Map<string, string>();

  for (const g of existingList) {
    if (g.id) existingMap.set(g.id, g);
    if (g.name) nameToId.set(g.name.trim().toLowerCase(), g.id || g.name);
  }

  let addedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  const now = new Date().toISOString();

  for (const item of incomingList) {
    if (!item || !item.name) continue;

    const trimmedName = String(item.name).trim();
    if (!trimmedName) continue;

    let prev: WhatsappGroupItem | undefined = undefined;
    if (item.id && existingMap.has(item.id)) {
      prev = existingMap.get(item.id);
    } else {
      const matchId = nameToId.get(trimmedName.toLowerCase());
      if (matchId && existingMap.has(matchId)) {
        prev = existingMap.get(matchId);
      }
    }

    const detectedDomain = item.domain || detectGroupDomain(trimmedName) || prev?.domain;
    const incomingInvite = cleanInviteUrl(item.inviteUrl);
    // Never wipe out an existing valid invite URL
    const effectiveInvite = incomingInvite || prev?.inviteUrl;

    if (prev) {
      // Check if there are real changes
      const inviteChanged = Boolean(incomingInvite && incomingInvite !== prev.inviteUrl);
      const nameChanged = trimmedName !== prev.name.trim();
      const countChanged = typeof item.participantsCount === "number" && item.participantsCount !== prev.participantsCount;
      const unreadChanged = typeof item.unreadCount === "number" && item.unreadCount !== prev.unreadCount;
      const ownerChanged = Boolean(item.owner && item.owner !== prev.owner);

      const hasUpdates = inviteChanged || nameChanged || countChanged || unreadChanged || ownerChanged;

      if (hasUpdates) {
        const updated: WhatsappGroupItem = {
          ...prev,
          name: trimmedName,
          domain: detectedDomain,
          inviteUrl: effectiveInvite,
          participantsCount: typeof item.participantsCount === "number" ? item.participantsCount : prev.participantsCount,
          owner: item.owner || prev.owner,
          unreadCount: typeof item.unreadCount === "number" ? item.unreadCount : prev.unreadCount,
          lastSynced: now,
        };
        existingMap.set(prev.id || updated.id, updated);
        updatedCount++;
      } else {
        unchangedCount++;
      }
    } else {
      // New group!
      const newId = item.id || `group_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newItem: WhatsappGroupItem = {
        id: newId,
        name: trimmedName,
        domain: detectedDomain,
        inviteUrl: effectiveInvite,
        participantsCount: typeof item.participantsCount === "number" ? item.participantsCount : undefined,
        owner: item.owner,
        unreadCount: typeof item.unreadCount === "number" ? item.unreadCount : 0,
        notes: item.notes,
        lastSynced: now,
      };
      existingMap.set(newId, newItem);
      nameToId.set(trimmedName.toLowerCase(), newId);
      addedCount++;
    }
  }

  const finalGroups = Array.from(existingMap.values());
  finalGroups.sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));

  return {
    groups: finalGroups,
    addedCount,
    updatedCount,
    unchangedCount,
  };
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
  const local = getLocalWhatsappGroups();
  try {
    const res = await fetch("/api/whatsapp-directory", { cache: "no-store" });
    if (!res.ok) return local;
    const data = await res.json();
    if (Array.isArray(data?.groups) && data.groups.length > 0) {
      const merged = mergeWhatsappGroups(local, data.groups);
      saveLocalWhatsappGroups(merged.groups);
      return merged.groups;
    }
    if (local.length > 0) {
      // Sync local to remote in background
      fetch("/api/whatsapp-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: local }),
      }).catch(() => {});
      return local;
    }
  } catch {}
  return local;
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
