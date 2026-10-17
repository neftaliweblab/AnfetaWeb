import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { WhatsappGroupItem, detectGroupDomain, cleanInviteUrl, mergeWhatsappGroups } from "@/lib/whatsappDirectory";
import { supabaseConfigured, supabaseAdmin } from "@/services/supabaseServer";

const DIRECTORY_FILE = path.join(process.cwd(), "data", "whatsapp_groups_directory.json");

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

function readStoredGroups(): { groups: WhatsappGroupItem[]; lastSynced?: string } {
  try {
    if (fs.existsSync(DIRECTORY_FILE)) {
      const content = fs.readFileSync(DIRECTORY_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return { groups: parsed };
      }
      if (Array.isArray(parsed?.groups)) {
        return { groups: parsed.groups, lastSynced: parsed.lastSynced };
      }
    }
  } catch {}
  return { groups: [] };
}

function writeStoredGroups(groups: WhatsappGroupItem[], lastSynced?: string): void {
  try {
    const dir = path.dirname(DIRECTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempFile = `${DIRECTORY_FILE}.${Date.now()}.tmp`;
    fs.writeFileSync(
      tempFile,
      JSON.stringify(
        {
          groups,
          lastSynced: lastSynced || new Date().toISOString(),
          total: groups.length,
        },
        null,
        2
      ),
      "utf-8"
    );
    fs.renameSync(tempFile, DIRECTORY_FILE);
  } catch (err) {
    console.error("[whatsapp-directory] Error saving groups:", err);
  }
}

async function backupToSupabase(groups: WhatsappGroupItem[], lastSynced: string): Promise<void> {
  if (!supabaseConfigured()) return;
  try {
    const admin = supabaseAdmin();
    const rows = groups
      .filter((g) => g.id && (g.id.includes("@g.us") || /^[0-9]+(-[0-9]+)?@g\.us$/.test(g.id)))
      .map((g) => ({
        owner: "John",
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

async function fetchFromSupabase(): Promise<WhatsappGroupItem[]> {
  if (!supabaseConfigured()) return [];
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin.from("whatsapp_groups").select("group_id, name, access_url, last_seen_at");
    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((d: any) => ({
        id: d.group_id,
        name: d.name,
        domain: detectGroupDomain(d.name),
        inviteUrl: cleanInviteUrl(d.access_url),
        lastSynced: d.last_seen_at,
      }));
    }
  } catch {}
  return [];
}

export async function GET() {
  let data = readStoredGroups();
  if (data.groups.length === 0 && supabaseConfigured()) {
    const remote = await fetchFromSupabase();
    if (remote.length > 0) {
      data = { groups: remote, lastSynced: remote[0]?.lastSynced };
      writeStoredGroups(remote, data.lastSynced);
    }
  }
  return NextResponse.json(data, {
    headers: {
      ...getCorsHeaders(),
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const incoming: any[] = Array.isArray(body?.groups) ? body.groups : Array.isArray(body) ? body : [];

    const current = readStoredGroups();
    const mergeResult = mergeWhatsappGroups(current.groups, incoming);
    const now = new Date().toISOString();

    writeStoredGroups(mergeResult.groups, now);
    await backupToSupabase(mergeResult.groups, now);

    return NextResponse.json(
      {
        success: true,
        count: mergeResult.groups.length,
        addedCount: mergeResult.addedCount,
        updatedCount: mergeResult.updatedCount,
        unchangedCount: mergeResult.unchangedCount,
        lastSynced: now,
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
