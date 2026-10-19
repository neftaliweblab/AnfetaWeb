import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  WhatsappGroupItem,
  detectGroupDomain,
  cleanInviteUrl,
  mergeWhatsappGroups,
} from "@/lib/whatsappDirectory";
import { normalizePerson, PERSON_ALIASES } from "@/services/identityNormalizer";
import { sessionActor } from "@/services/serverAuth";
import { supabaseConfigured, supabaseAdmin } from "@/services/supabaseServer";

const DATA_DIR = path.join(process.cwd(), "data");
const DIRECTORY_FILE = path.join(DATA_DIR, "whatsapp_groups_directory.json");

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

function getUserDirectoryFile(user?: string): string {
  const norm = normalizePerson(user);
  if (!norm || norm === "Sin asignar" || norm === "legacy") {
    return DIRECTORY_FILE;
  }
  const clean = norm.toLowerCase().replace(/[^a-z0-9_]/g, "");
  return path.join(DATA_DIR, `whatsapp_groups_${clean}.json`);
}

function readStoredGroups(user?: string): { groups: WhatsappGroupItem[]; lastSynced?: string } {
  try {
    const filePath = getUserDirectoryFile(user);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return { groups: parsed };
      }
      if (Array.isArray(parsed?.groups)) {
        return { groups: parsed.groups, lastSynced: parsed.lastSynced };
      }
    }

    // Fallback to legacy file if user file does not exist yet
    if (filePath !== DIRECTORY_FILE && fs.existsSync(DIRECTORY_FILE)) {
      const content = fs.readFileSync(DIRECTORY_FILE, "utf-8");
      const parsed = JSON.parse(content);
      const groups = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.groups) ? parsed.groups : [];
      if (groups.length > 0) {
        return { groups, lastSynced: parsed?.lastSynced };
      }
    }
  } catch {}
  return { groups: [] };
}

function readAllStoredGroups(): { groups: WhatsappGroupItem[]; byUser: Record<string, number> } {
  const allGroups: WhatsappGroupItem[] = [];
  const byUser: Record<string, number> = {};

  try {
    if (!fs.existsSync(DATA_DIR)) return { groups: [], byUser: {} };
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.startsWith("whatsapp_groups_") && f.endsWith(".json"));

    for (const f of files) {
      try {
        const full = path.join(DATA_DIR, f);
        const content = fs.readFileSync(full, "utf-8");
        const parsed = JSON.parse(content);
        const list: WhatsappGroupItem[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.groups)
          ? parsed.groups
          : [];

        // Determine owner from filename (e.g. whatsapp_groups_karla.json -> Karla)
        let fileOwner: string | undefined = undefined;
        if (f !== "whatsapp_groups_directory.json") {
          const raw = f.replace(/^whatsapp_groups_/, "").replace(/\.json$/, "");
          fileOwner = normalizePerson(raw);
        }

        for (const item of list) {
          const owner = item.owner || fileOwner || "Neftali";
          allGroups.push({ ...item, owner });
          byUser[owner] = (byUser[owner] || 0) + 1;
        }
      } catch {}
    }
  } catch {}

  // Merge items so duplicates across files are consolidated (preserving best links)
  const merged = mergeWhatsappGroups([], allGroups);
  return { groups: merged.groups, byUser };
}

function writeStoredGroups(groups: WhatsappGroupItem[], user?: string, lastSynced?: string): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const targetFile = getUserDirectoryFile(user);
    const tempFile = `${targetFile}.${Date.now()}.tmp`;
    fs.writeFileSync(
      tempFile,
      JSON.stringify(
        {
          owner: normalizePerson(user),
          groups,
          lastSynced: lastSynced || new Date().toISOString(),
          total: groups.length,
        },
        null,
        2
      ),
      "utf-8"
    );
    fs.renameSync(tempFile, targetFile);

    // Also mirror to legacy DIRECTORY_FILE if user is Neftali or John
    const norm = normalizePerson(user);
    if (!user || norm === "Neftali" || norm === "John") {
      try {
        fs.writeFileSync(DIRECTORY_FILE, JSON.stringify({ groups, lastSynced }, null, 2), "utf-8");
      } catch {}
    }
  } catch (err) {
    console.error("[whatsapp-directory] Error saving groups:", err);
  }
}

async function backupToSupabase(groups: WhatsappGroupItem[], lastSynced: string, ownerName: string): Promise<void> {
  if (!supabaseConfigured()) return;
  try {
    const admin = supabaseAdmin();
    // Try to ensure account row exists in whatsapp_accounts (silently ignore if check constraint)
    try {
      await admin.from("whatsapp_accounts").upsert(
        { owner: ownerName, account_key: `anfeta-key-${ownerName.toLowerCase()}` },
        { onConflict: "owner" }
      );
    } catch {}

    const rows = groups
      .filter((g) => g.id && (g.id.includes("@g.us") || /^[0-9]+(-[0-9]+)?@g\.us$/.test(g.id)))
      .map((g) => ({
        owner: ownerName,
        group_id: g.id,
        name: g.name.slice(0, 1024),
        access_url: g.inviteUrl || null,
        last_seen_at: g.lastSynced || lastSynced,
      }));

    if (rows.length > 0) {
      await admin.from("whatsapp_groups").upsert(rows, { onConflict: "owner,group_id" });
    }
  } catch (err) {
    console.warn("[whatsapp-directory] Supabase backup notice:", err);
  }
}

async function fetchFromSupabase(ownerName?: string): Promise<WhatsappGroupItem[]> {
  if (!supabaseConfigured()) return [];
  try {
    const admin = supabaseAdmin();
    let query = admin.from("whatsapp_groups").select("owner, group_id, name, access_url, last_seen_at");
    if (ownerName && ownerName !== "__all__") {
      query = query.eq("owner", ownerName);
    }
    const { data, error } = await query;
    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((d: any) => ({
        id: d.group_id,
        name: d.name,
        domain: detectGroupDomain(d.name),
        inviteUrl: cleanInviteUrl(d.access_url),
        owner: d.owner || ownerName,
        lastSynced: d.last_seen_at,
      }));
    }
  } catch {}
  return [];
}

export async function GET(req: NextRequest) {
  const userParam = req.nextUrl.searchParams.get("user");
  const isAll = req.nextUrl.searchParams.get("all") === "1" || userParam === "__all__";

  if (isAll) {
    const localAll = readAllStoredGroups();
    let finalGroups = localAll.groups;

    if (supabaseConfigured()) {
      const remoteAll = await fetchFromSupabase("__all__");
      if (remoteAll.length > 0) {
        const merged = mergeWhatsappGroups(finalGroups, remoteAll);
        finalGroups = merged.groups;
      }
    }

    return NextResponse.json(
      {
        groups: finalGroups,
        total: finalGroups.length,
        isAll: true,
        byUser: localAll.byUser,
      },
      {
        headers: {
          ...getCorsHeaders(),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const normUser = normalizePerson(userParam || sessionActor(req) || "Neftali");
  let data = readStoredGroups(normUser);

  if (data.groups.length === 0 && supabaseConfigured()) {
    const remote = await fetchFromSupabase(normUser);
    if (remote.length > 0) {
      data = { groups: remote, lastSynced: remote[0]?.lastSynced };
      writeStoredGroups(remote, normUser, data.lastSynced);
    }
  }

  return NextResponse.json(
    {
      groups: data.groups,
      owner: normUser,
      lastSynced: data.lastSynced,
      total: data.groups.length,
    },
    {
      headers: {
        ...getCorsHeaders(),
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const incoming: any[] = Array.isArray(body?.groups) ? body.groups : Array.isArray(body) ? body : [];
    const userParam = body?.user || req.nextUrl.searchParams.get("user") || sessionActor(req) || "Neftali";
    const normUser = normalizePerson(userParam);

    const current = readStoredGroups(normUser);
    const mergeResult = mergeWhatsappGroups(current.groups, incoming, normUser);
    const now = new Date().toISOString();

    writeStoredGroups(mergeResult.groups, normUser, now);
    await backupToSupabase(mergeResult.groups, now, normUser);

    return NextResponse.json(
      {
        success: true,
        count: mergeResult.groups.length,
        addedCount: mergeResult.addedCount,
        updatedCount: mergeResult.updatedCount,
        unchangedCount: mergeResult.unchangedCount,
        lastSynced: now,
        owner: normUser,
        groups: mergeResult.groups,
      },
      {
        headers: getCorsHeaders(),
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al procesar grupos de WhatsApp.";
    return NextResponse.json({ error: msg }, { status: 500, headers: getCorsHeaders() });
  }
}
