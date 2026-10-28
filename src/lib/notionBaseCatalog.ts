/** Existing ANFETA data sources. IDs are routing metadata, never credentials. */
export const ANFETA_BASES=[['Revisiones','2eeabd7d-91b7-8193-a131-000b08cd54e2'],['Clientes','2f0abd7d-91b7-810b-b1b8-000b85005b68'],['Dominios','2f0abd7d-91b7-8133-82e8-000b57bceeda'],['Programas y proyectos','796abd7d-91b7-8271-9154-0749f7d58213'],['Cobrar y pagar','2eeabd7d-91b7-815f-b649-000bfdc93a2b'],['Correos Contraseñas','2f1abd7d-91b7-8136-8cc2-000ba807c666']];
export const DOCUMENTATION_SOURCE_ID=ANFETA_BASES.find(([name])=>name==='Correos Contraseñas')![1];

/** Parent database IDs verified read-only against Notion on 2026-10-28. */
export const NOTION_BASE_DATABASE_IDS:Record<string,string>={
  "2eeabd7d-91b7-8193-a131-000b08cd54e2": "2eeabd7d-91b7-8134-8ed5-c537ec14962e",
  "2f0abd7d-91b7-810b-b1b8-000b85005b68": "2f0abd7d-91b7-81a0-993e-d4d3129ea46f",
  "2f0abd7d-91b7-8133-82e8-000b57bceeda": "2f0abd7d-91b7-8194-8d43-d2627adf2212",
  "796abd7d-91b7-8271-9154-0749f7d58213": "3cdabd7d-91b7-835c-af87-81ca85181639",
  "2eeabd7d-91b7-815f-b649-000bfdc93a2b": "2eeabd7d-91b7-81a5-a2ee-c9a20d3d656a",
  "2f1abd7d-91b7-8136-8cc2-000ba807c666": "2f1abd7d-91b7-81f5-bd6e-f2b1ecad4838"
};
