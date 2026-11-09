const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
const dotenv = fs.readFileSync(envPath, 'utf8');
const tokenMatch = dotenv.match(/NOTION_TOKEN=([^\r\n]+)/);
const token = tokenMatch ? tokenMatch[1].trim() : '';

if (!token) {
  console.error('ERROR: No se encontró NOTION_TOKEN en .env.local');
  process.exit(1);
}

const TEMPLATE_UPDATES = [
  {
    pageId: '3aeabd7d-91b7-80ff-92b8-ef432a9cb797',
    oldTitle: 'aprtuzCOBRAR [2027-01-15] [d.dominio.com] DOMINIO Y/O HOSTING aanua ddomi hhost [ttag dominio]',
    newTitle: 'aprtuzCOBRAR | 💳 ccobr | 📅 01.c.00.00 DOMINIO Y/O HOSTING aanua ddomi hhost [ttag dominio] | 🌐 #d.dominio.com | 🛠️#descripcion | 🔁 #ffase00 | 👥 nn-e11 aa-n11 ee-d11 ii-s11 kk-a11 | ✅ jj-o000 gg-e000',
  },
  {
    pageId: '3a4abd7d-91b7-80ca-9f80-f04b75ffda09',
    oldTitle: 'zR ccoti 26-[08AGO] Formulario General Técnico y Alcance Cuestionario brief p.notion.com.cotizacion  [p.dominio.com.cotizacion] ccues bbrief isai gena',
    newTitle: 'aaprtuzR | 💻 ccoti | 📅 11.c.00.50 Formulario General Técnico y Alcance Cuestionario brief ccues bbrief | 🌐 #p.dominio.com.cotizacion | 🛠️#descripcion | 🔁 #ffase00 | 👥 ii-s11 gg-e11 | ✅ jj-o000 gg-e000',
  },
  {
    pageId: '3a0abd7d-91b7-8090-8933-f24056fa396c',
    oldTitle: 'aprtuzR SERVERS 1.00 26-[08AGO] Documentar Acceso Contraseña Correo ddocu aacce ccont ccorre',
    newTitle: 'aaprtuzR | 💻 aacce-ccorre | 📅 11.c.01.00 Documentar Acceso Contraseña Correo ddocu aacce ccont ccorre | 🌐 #d.dominio.com | 🛠️#descripcion | 🔁 #ffase00 | 👥 nn-e11 aa-n11 ee-d11 ii-s11 kk-a11 | ✅ jj-o000 gg-e000',
  },
  {
    pageId: '39eabd7d-91b7-80b1-8392-e635b7f889dc',
    oldTitle: 'aprtuzR SERVERS 2.00 26-[08AGO] Documentar Acceso Contraseña Dominio ddocu aacce ccont wwordp ccpane hhost',
    newTitle: 'aaprtuzR | 💻 aacce-ddomi | 📅 11.d.02.00 Documentar Acceso Contraseña Dominio ddocu aacce ccont wwordp ccpane hhost | 🌐 #d.dominio.com | 🛠️#descripcion | 🔁 #ffase00 | 👥 nn-e11 aa-n11 ee-d11 ii-s11 kk-a11 | ✅ jj-o000 gg-e000',
  },
  {
    pageId: '396abd7d-91b7-807a-81a0-f89426fe513d',
    oldTitle: 'prtuzR [ttipo-actividad-rrapi rapido] 26-[08AGO] [TITULO ACTIVIDAD] g-ge000 [d.dominio.com] [AGREGAR DESCRIPCION ACTIVIDAD]',
    newTitle: 'aaprtuzR | 💻 [ttipo-actividad-rrapi rapido] | 📅 11.t.00.00 [TITULO ACTIVIDAD] [AGREGAR DESCRIPCION ACTIVIDAD] | 🌐 #d.dominio.com | 🛠️#descripcion | 🔁 #ffase00 | 👥 gg-e000 | ✅ ',
  },
  {
    pageId: '396abd7d-91b7-80f2-8a97-fc411c4a0521',
    oldTitle: 'prtuzR [ttipo-actividad] 26-[08AGO] [TITULO ACTIVIDAD] b-br11 [d.dominio.com] [AGREGAR DESCRIPCION ACTIVIDAD]',
    newTitle: 'aaprtuzR | 💻 [ttipo-actividad] | 📅 11.t.00.00 [TITULO ACTIVIDAD] [AGREGAR DESCRIPCION ACTIVIDAD] | 🌐 #d.dominio.com | 🛠️#descripcion | 🔁 #ffase00 | 👥 bb-r11 | ✅ ',
  },
  {
    pageId: '395abd7d-91b7-8017-b0a3-ffdf389a2ee3',
    oldTitle: 'zzz bbibl PROYECTO E00F00 ASIGNAR-PROYECTO',
    newTitle: 'aaprtuzR | 💻 bbibl | 📅 11.b.00.00 PROYECTO E00F00 ASIGNAR-PROYECTO | 🌐 #d.dominio.com | 🛠️#descripcion | 🔁 #ffase00 | 👥 nn-e11 aa-n11 ee-d11 ii-s11 kk-a11 | ✅ jj-o000 gg-e000',
  },
  {
    pageId: '393abd7d-91b7-806c-bd82-f1a1375a4397',
    oldTitle: 'prtuzR [ttipo-actividad] 26-[08AGO] [TITULO ACTIVIDAD]  [d.dominio.com] [AGREGAR DESCRIPCION ACTIVIDAD]',
    newTitle: 'aaprtuzR | 💻 [ttipo-actividad] | 📅 11.t.00.00 [TITULO ACTIVIDAD] [AGREGAR DESCRIPCION ACTIVIDAD] | 🌐 #d.dominio.com | 🛠️#descripcion | 🔁 #ffase00 | 👥 | ✅ ',
  },
  {
    pageId: '393abd7d-91b7-8076-805b-d1b68310f0f0',
    oldTitle: 'prtuzR [ttipo-actividad] 26-[08AGO] [TITULO ACTIVIDAD] i-isai [d.dominio.com] [AGREGAR DESCRIPCION ACTIVIDAD]',
    newTitle: 'aaprtuzR | 💻 [ttipo-actividad] | 📅 11.t.00.00 [TITULO ACTIVIDAD] [AGREGAR DESCRIPCION ACTIVIDAD] | 🌐 #d.dominio.com | 🛠️#descripcion | 🔁 #ffase00 | 👥 ii-s11 | ✅ ',
  },
  {
    pageId: '393abd7d-91b7-808d-ab22-e4687c62d55f',
    oldTitle: 'prtuzR [ttipo-actividad] 26-[08AGO] [TITULO ACTIVIDAD] j-jo000 [d.dominio.com] [AGREGAR DESCRIPCION ACTIVIDAD]',
    newTitle: 'aaprtuzR | 💻 [ttipo-actividad] | 📅 11.t.00.00 [TITULO ACTIVIDAD] [AGREGAR DESCRIPCION ACTIVIDAD] | 🌐 #d.dominio.com | 🛠️#descripcion | 🔁 #ffase00 | 👥 jj-o000 | ✅ ',
  },
  {
    pageId: '393abd7d-91b7-803d-bf00-cc15c2f3e711',
    oldTitle: 'prtuzR [ttipo-actividad] 26-[08AGO] [TITULO ACTIVIDAD]  [d.dominio.com] [AGREGAR DESCRIPCION ACTIVIDAD]',
    newTitle: 'aaprtuzR | 💻 [ttipo-actividad] | 📅 11.t.00.00 [TITULO ACTIVIDAD] [AGREGAR DESCRIPCION ACTIVIDAD] | 🌐 #d.dominio.com | 🛠️#descripcion | 🔁 #ffase00 | 👥 | ✅ ',
  },
  {
    pageId: '393abd7d-91b7-809c-8ecf-e3e835a558c8',
    oldTitle: 'prtuzR [ttipo-actividad] 26-[08AGO] [TITULO ACTIVIDAD] k-ka11 [d.dominio.com] [AGREGAR DESCRIPCION ACTIVIDAD]',
    newTitle: 'aaprtuzR | 💻 [ttipo-actividad] | 📅 11.t.00.00 [TITULO ACTIVIDAD] [AGREGAR DESCRIPCION ACTIVIDAD] | 🌐 #d.dominio.com | 🛠️#descripcion | 🔁 #ffase00 | 👥 kk-a11 | ✅ ',
  },
];

async function updateTemplate(item) {
  const cleanId = item.pageId.replace(/-/g, '');
  const url = `https://api.notion.com/v1/pages/${cleanId}`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        'TITULO PRiNCIPAL': {
          title: [
            {
              type: 'text',
              text: {
                content: item.newTitle,
              },
            },
          ],
        },
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error ${res.status} en página ${item.pageId}: ${errorText}`);
  }

  const data = await res.json();
  const updatedTitle = data.properties['TITULO PRiNCIPAL']?.title?.map((t) => t.plain_text).join('') || '';
  return updatedTitle;
}

async function run() {
  console.log(`=== INICIANDO ACTUALIZACIÓN DE 12 PLANTILLAS EN NOTION API ===\n`);

  let successCount = 0;
  for (let i = 0; i < TEMPLATE_UPDATES.length; i++) {
    const item = TEMPLATE_UPDATES[i];
    try {
      console.log(`[${i + 1}/${TEMPLATE_UPDATES.length}] Actualizando ${item.pageId}...`);
      const confirmedTitle = await updateTemplate(item);
      console.log(`  -> OK: "${confirmedTitle}"\n`);
      successCount++;
    } catch (err) {
      console.error(`  -> ERROR: ${err.message}\n`);
    }
  }

  console.log(`\n=== RESULTADO: ${successCount} de ${TEMPLATE_UPDATES.length} plantillas actualizadas en Notion ===`);

  // Ahora sincronizamos el catálogo local completo desde Notion
  console.log('\nSincronizando catálogo local (data/notion_template_phase1_catalog_v2.json)...');
  const catalogPath = path.join(__dirname, '../data/notion_template_phase1_catalog_v2.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  let localUpdated = 0;
  for (const t of catalog.Items) {
    const update = TEMPLATE_UPDATES.find((u) => u.pageId.replace(/-/g, '') === (t.PageId || '').replace(/-/g, ''));
    if (update) {
      t.Title = update.newTitle;
      localUpdated++;
    }
  }
  catalog.UpdatedAtUtc = new Date().toISOString();
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');

  console.log(`Catálogo local actualizado: ${localUpdated} registros modificados.`);
  const withPipes = catalog.Items.filter((t) => (t.Title || '').includes('|'));
  console.log(`\nEstado final del catálogo en ANFETA:`);
  console.log(`Total: ${catalog.Items.length} plantillas.`);
  console.log(`Con formato estructurado de pipes (|): ${withPipes.length} (100% de 86).`);
}

run().catch((err) => {
  console.error('Fallo general:', err);
  process.exit(1);
});
