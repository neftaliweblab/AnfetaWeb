/** Existing ANFETA data sources. IDs are routing metadata, never credentials. */
export const ANFETA_BASES=[['Revisiones','2eeabd7d-91b7-8193-a131-000b08cd54e2'],['Clientes','2f0abd7d-91b7-810b-b1b8-000b85005b68'],['Dominios','2f0abd7d-91b7-8133-82e8-000b57bceeda'],['Programas y proyectos','796abd7d-91b7-8271-9154-0749f7d58213'],['Cobrar y pagar','2eeabd7d-91b7-815f-b649-000bfdc93a2b'],['Correos Contraseñas','2f1abd7d-91b7-8136-8cc2-000ba807c666']];
export const DOCUMENTATION_SOURCE_ID=ANFETA_BASES.find(([name])=>name==='Correos Contraseñas')![1];
