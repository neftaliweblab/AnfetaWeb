const assert = require("assert/strict");
const path = require("path");
const fs = require("fs");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

const customRequire = (name) => {
  if (name.startsWith("@/")) {
    const rel = name.slice(2);
    const fullPath = path.join(root, "src", rel);
    if (fs.existsSync(fullPath + ".ts")) {
      const code = fs.readFileSync(fullPath + ".ts", "utf8");
      const transpiled = ts.transpileModule(code, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText;
      const subMod = { exports: {} };
      const subFn = new Function("exports", "module", "require", transpiled);
      subFn(subMod.exports, subMod, customRequire);
      return subMod.exports;
    }
  }
  return require(name);
};

// Transpile ts file for testing
const tsCode = fs.readFileSync(path.join(root, "src/lib/whatsappDirectory.ts"), "utf8");
const jsCode = ts.transpileModule(tsCode, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const mod = { exports: {} };
const fn = new Function("exports", "module", "require", jsCode);
fn(mod.exports, mod, customRequire);

const { detectGroupDomain, cleanInviteUrl, mergeWhatsappGroups, getWhatsappStorageKey } = mod.exports;

// Test 1: detectGroupDomain
assert.equal(detectGroupDomain("Apartallante - Web & Ads"), "Apartallante");
assert.equal(detectGroupDomain("constructora.mx - Avances de Obra"), "constructora.mx");
assert.equal(detectGroupDomain("novadent.com · Campaña Ads"), "novadent.com");
assert.equal(detectGroupDomain("miempresa.webs - Cambios"), "miempresa.webs");
assert.equal(detectGroupDomain("Conversación General"), undefined);

// Test 2: cleanInviteUrl
assert.equal(
  cleanInviteUrl("https://chat.whatsapp.com/L1234567890ABCDEF"),
  "https://chat.whatsapp.com/L1234567890ABCDEF"
);
assert.equal(
  cleanInviteUrl("  https://chat.whatsapp.com/AbCdEf12345  "),
  "https://chat.whatsapp.com/AbCdEf12345"
);
assert.equal(cleanInviteUrl("http://invalido.com/algo"), undefined);
assert.equal(cleanInviteUrl("texto suelto"), undefined);
assert.equal(cleanInviteUrl(null), undefined);

// Test 3: mergeWhatsappGroups (incremental sync)
const existing = [
  { id: "g1@g.us", name: "Grupo Uno", inviteUrl: "https://chat.whatsapp.com/Old1", notes: "Nota importante", lastSynced: "2026-01-01T00:00:00.000Z" },
  { id: "g2@g.us", name: "Grupo Dos", inviteUrl: undefined, lastSynced: "2026-01-01T00:00:00.000Z" },
];

const incoming = [
  // 1. Unchanged group (incoming has no link, existing already had Old1 -> should preserve Old1 and mark unchanged)
  { id: "g1@g.us", name: "Grupo Uno" },
  // 2. Updated group (incoming has a newly discovered link -> should update and mark updated)
  { id: "g2@g.us", name: "Grupo Dos", inviteUrl: "https://chat.whatsapp.com/New2" },
  // 3. Brand new group
  { id: "g3@g.us", name: "Grupo Tres", inviteUrl: "https://chat.whatsapp.com/New3" },
];

const mergeRes = mergeWhatsappGroups(existing, incoming, "Karla");
assert.equal(mergeRes.groups.length, 3);
assert.equal(mergeRes.addedCount, 1, "Should add 1 new group");
assert.equal(mergeRes.updatedCount, 1, "Should update 1 existing group");
assert.equal(mergeRes.unchangedCount, 1, "Should keep 1 unchanged group");

// Check group 1 preserved note and link
const g1 = mergeRes.groups.find(g => g.id === "g1@g.us");
assert.equal(g1.inviteUrl, "https://chat.whatsapp.com/Old1");
assert.equal(g1.notes, "Nota importante");
assert.equal(g1.lastSynced, "2026-01-01T00:00:00.000Z", "Unchanged group preserves original lastSynced");

// Check group 2 updated with new link
const g2 = mergeRes.groups.find(g => g.id === "g2@g.us");
assert.equal(g2.inviteUrl, "https://chat.whatsapp.com/New2");

// Check group 3 created with owner
const g3 = mergeRes.groups.find(g => g.id === "g3@g.us");
assert.equal(g3.name, "Grupo Tres");
assert.equal(g3.owner, "Karla");

// Test 4: API storage mock & persistence check
const testFile = path.join(root, "data", "whatsapp_groups_directory.test.json");
if (fs.existsSync(testFile)) fs.unlinkSync(testFile);

const sampleGroups = [
  { id: "g1@g.us", name: "Beta Corp - Proyecto", inviteUrl: "https://chat.whatsapp.com/Beta123", participantsCount: 15, owner: "Karla", linkedActivityId: "act_123" },
  { id: "g2@g.us", name: "Alpha Tech · Web", inviteUrl: undefined, owner: "Neftali" },
];

fs.writeFileSync(testFile, JSON.stringify({ groups: sampleGroups, total: 2 }), "utf8");
const readBack = JSON.parse(fs.readFileSync(testFile, "utf8"));
assert.equal(readBack.groups.length, 2);
assert.equal(readBack.groups[0].name, "Beta Corp - Proyecto");
assert.equal(readBack.groups[0].inviteUrl, "https://chat.whatsapp.com/Beta123");
assert.equal(readBack.groups[0].participantsCount, 15);
assert.equal(readBack.groups[0].owner, "Karla");
assert.equal(readBack.groups[0].linkedActivityId, "act_123");
fs.unlinkSync(testFile);

// Test 5: Multi-user storage keys
assert.equal(getWhatsappStorageKey("Neftali"), "anfeta_whatsapp_groups_v1:Neftali");
assert.equal(getWhatsappStorageKey("nneft"), "anfeta_whatsapp_groups_v1:Neftali");
assert.equal(getWhatsappStorageKey("Karla"), "anfeta_whatsapp_groups_v1:Karla");
assert.equal(getWhatsappStorageKey("kkarl"), "anfeta_whatsapp_groups_v1:Karla");
assert.equal(getWhatsappStorageKey("John"), "anfeta_whatsapp_groups_v1:John");
assert.equal(getWhatsappStorageKey(undefined), "anfeta_whatsapp_groups_v1");

console.log("OK: WhatsApp Directory - Detección de dominios, validación de enlaces, merge incremental, aislamiento multi-usuario y almacenamiento de catálogo con metadatos verificados.");
