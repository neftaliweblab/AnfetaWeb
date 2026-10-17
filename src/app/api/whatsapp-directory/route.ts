import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { WhatsappGroupItem, detectGroupDomain, cleanInviteUrl } from "@/lib/whatsappDirectory";

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

export async function GET() {
  const data = readStoredGroups();
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
    const existingMap = new Map<string, WhatsappGroupItem>();
    for (const g of current.groups) {
      existingMap.set(g.id || g.name, g);
    }

    const now = new Date().toISOString();
    const mergedList: WhatsappGroupItem[] = [];

    // Process incoming groups
    for (const item of incoming) {
      if (!item || !item.name) continue;
      const key = item.id || item.name;
      const prev = existingMap.get(key) || Array.from(existingMap.values()).find((x) => x.name.trim().toLowerCase() === item.name.trim().toLowerCase());

      const validInvite = cleanInviteUrl(item.inviteUrl) || prev?.inviteUrl;
      const detectedDomain = item.domain || detectGroupDomain(item.name) || prev?.domain;

      const merged: WhatsappGroupItem = {
        id: item.id || prev?.id || `group_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: String(item.name).trim(),
        domain: detectedDomain,
        inviteUrl: validInvite,
        lastSynced: now,
        unreadCount: typeof item.unreadCount === "number" ? item.unreadCount : prev?.unreadCount,
        notes: item.notes || prev?.notes,
      };

      existingMap.set(merged.id, merged);
      existingMap.set(merged.name, merged);
    }

    // Deduplicate by id and name
    const seen = new Set<string>();
    const finalGroups: WhatsappGroupItem[] = [];
    for (const g of existingMap.values()) {
      if (seen.has(g.id) || seen.has(g.name.toLowerCase())) continue;
      seen.add(g.id);
      seen.add(g.name.toLowerCase());
      finalGroups.push(g);
    }

    // Sort alphabetically by name
    finalGroups.sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));

    writeStoredGroups(finalGroups, now);

    return NextResponse.json(
      {
        success: true,
        count: finalGroups.length,
        lastSynced: now,
        groups: finalGroups,
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
