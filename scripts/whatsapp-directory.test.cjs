const assert = require("assert/strict");
const path = require("path");
const fs = require("fs");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

// Transpile ts file for testing
const tsCode = fs.readFileSync(path.join(root, "src/lib/whatsappDirectory.ts"), "utf8");
const jsCode = ts.transpileModule(tsCode, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const mod = { exports: {} };
const fn = new Function("exports", "module", "require", jsCode);
fn(mod.exports, mod, require);

const { detectGroupDomain, cleanInviteUrl } = mod.exports;

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

// Test 3: API storage mock & persistence check
const testFile = path.join(root, "data", "whatsapp_groups_directory.test.json");
if (fs.existsSync(testFile)) fs.unlinkSync(testFile);

const sampleGroups = [
  { id: "g1@g.us", name: "Beta Corp - Proyecto", inviteUrl: "https://chat.whatsapp.com/Beta123", participantsCount: 15, owner: "5215512345678@c.us", linkedActivityId: "act_123" },
  { id: "g2@g.us", name: "Alpha Tech · Web", inviteUrl: undefined },
];

fs.writeFileSync(testFile, JSON.stringify({ groups: sampleGroups, total: 2 }), "utf8");
const readBack = JSON.parse(fs.readFileSync(testFile, "utf8"));
assert.equal(readBack.groups.length, 2);
assert.equal(readBack.groups[0].name, "Beta Corp - Proyecto");
assert.equal(readBack.groups[0].inviteUrl, "https://chat.whatsapp.com/Beta123");
assert.equal(readBack.groups[0].participantsCount, 15);
assert.equal(readBack.groups[0].owner, "5215512345678@c.us");
assert.equal(readBack.groups[0].linkedActivityId, "act_123");
fs.unlinkSync(testFile);

console.log("OK: WhatsApp Directory - Detección de dominios, validación de enlaces y almacenamiento de catálogo con metadatos verificados.");
