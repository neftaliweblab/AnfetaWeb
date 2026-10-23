import {projectDomains,normalizeProjectDomain} from './whatsappActivityLinks';
import { normalizePerson } from "@/services/identityNormalizer";

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

export function getWhatsappStorageKey(user?: string): string {
  const norm = normalizePerson(user);
  if (norm && norm !== "Sin asignar") {
    return `${STORAGE_KEY}:${norm}`;
  }
  return STORAGE_KEY;
}

export function detectGroupDomain(name: string): string | undefined {
  const exact=projectDomains(name)[0];if(exact)return exact;
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
  try{const parsed=new URL(url.trim());return parsed.protocol==='https:'&&parsed.hostname==='chat.whatsapp.com'&&!parsed.username&&!parsed.password&&/^\/[a-zA-Z0-9_-]+\/?$/.test(parsed.pathname)?parsed.toString():undefined;}catch{return undefined;}
}

export interface MergeResult {
  groups: WhatsappGroupItem[];
  addedCount: number;
  updatedCount: number;
  unchangedCount: number;
}

export function mergeWhatsappGroups(existingList:WhatsappGroupItem[],incomingList:WhatsappGroupItem[],defaultOwner?:string):MergeResult{
 const map=new Map<string,WhatsappGroupItem>();
 const key=(g:WhatsappGroupItem)=>normalizePerson(g.owner||defaultOwner||'')+':'+g.id;
 for(const g of existingList)if(g.id)map.set(key(g),g);
 let addedCount=0,updatedCount=0,unchangedCount=0;
 for(const item of incomingList){
  if(!item||!String(item.name||'').trim())continue;
  const name=String(item.name).trim(),owner=item.owner||defaultOwner;
  const prev=item.id?map.get(key({...item,owner})):Array.from(map.values()).find(g=>normalizePerson(g.owner||defaultOwner||'')===normalizePerson(owner||'')&&g.name.trim().toLowerCase()===name.toLowerCase());
  const next:WhatsappGroupItem={...prev,...item,id:prev?.id||item.id||'group_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),name,owner:item.owner||prev?.owner||(!prev?defaultOwner:undefined),domain:item.domain||detectGroupDomain(name)||prev?.domain,inviteUrl:cleanInviteUrl(item.inviteUrl)||prev?.inviteUrl,notes:item.notes??prev?.notes,linkedActivityId:item.linkedActivityId||prev?.linkedActivityId,linkedPageId:item.linkedPageId||prev?.linkedPageId};
  for(const field of ['participantsCount','unreadCount'] as const)if(item[field]===undefined)next[field]=prev?.[field];
  const changed=!prev||Object.keys(next).some(k=>k!=='lastSynced'&&(next as any)[k]!==(prev as any)[k]);
  if(!prev)addedCount++;else if(changed)updatedCount++;else unchangedCount++;
  map.set(key(next),changed?{...next,lastSynced:new Date().toISOString()}:prev!);
 }
 return {groups:[...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'es',{sensitivity:'base'})),addedCount,updatedCount,unchangedCount};
}

export function getLocalWhatsappGroups(user?: string): WhatsappGroupItem[] {
  if (typeof window === "undefined") return [];
  const key = getWhatsappStorageKey(user);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    // Fallback: check legacy key if user-specific key was empty
    if (key !== STORAGE_KEY) {
      const legacyRaw = localStorage.getItem(STORAGE_KEY);
      if (legacyRaw) {
        const legacyParsed = JSON.parse(legacyRaw);
        if (Array.isArray(legacyParsed) && legacyParsed.length > 0) {
          try {
            localStorage.setItem(key, legacyRaw);
          } catch {}
          return legacyParsed;
        }
      }
    }
  } catch {}
  return [];
}

export function saveLocalWhatsappGroups(groups: WhatsappGroupItem[], user?: string): void {
  if (typeof window === "undefined") return;
  const key = getWhatsappStorageKey(user);
  try {
    localStorage.setItem(key, JSON.stringify(groups));
    // Also maintain legacy key updated for backwards compatibility
    if (!user || normalizePerson(user) === "Neftali" || normalizePerson(user) === "John") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
    }
  } catch {}
}

export async function fetchRemoteWhatsappGroups(user?: string,options:{syncLocal?:boolean}={}): Promise<WhatsappGroupItem[]> {
  const local = getLocalWhatsappGroups(user);
  const norm = normalizePerson(user);

  try {
    // Shared directory across all team members
    const res = await fetch(`/api/whatsapp-directory?all=1`, { cache: "no-store" });
    if (!res.ok) return local;
    const data = await res.json();
    if (Array.isArray(data?.groups) && data.groups.length > 0) {
      const merged = mergeWhatsappGroups(local, data.groups, norm);
      saveLocalWhatsappGroups(merged.groups, user);
      return merged.groups;
    }
    if (local.length > 0 && options.syncLocal!==false) {
      // Sync local to remote in background
      fetch("/api/whatsapp-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: norm, groups: local }),
      }).catch(() => {});
      return local;
    }
  } catch {}
  return local;
}

export async function persistWhatsappGroups(groups: WhatsappGroupItem[], user?: string): Promise<boolean> {
  saveLocalWhatsappGroups(groups, user);
  const norm = normalizePerson(user);
  try {
    const res = await fetch("/api/whatsapp-directory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: norm, groups }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchAllTeamWhatsappGroups(): Promise<{ groups: WhatsappGroupItem[]; total: number }> {
  try {
    const res = await fetch("/api/whatsapp-directory?all=1", { cache: "no-store" });
    if (!res.ok) return { groups: [], total: 0 };
    const data = await res.json();
    if (Array.isArray(data?.groups)) {
      return { groups: data.groups, total: data.groups.length };
    }
  } catch {}
  return { groups: [], total: 0 };
}
