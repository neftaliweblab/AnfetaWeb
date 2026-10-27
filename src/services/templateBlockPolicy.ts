const native=new Set(['paragraph','heading_1','heading_2','heading_3','bulleted_list_item','numbered_list_item','to_do','toggle','quote','callout','code','divider','equation','bookmark','embed','table','table_row','table_of_contents','breadcrumb','image','video','audio','pdf','file','column_list','column']);
const converted:Record<string,string>={heading_4:'Encabezado 3, conservando su desplegable y contenido',synced_block:'Contenido independiente del origen o de la copia local',template:'Desplegable independiente',link_preview:'Marcador web',link_to_page:'Enlace a la página o base de origen',child_page:'Desplegable con el contenido independiente de la subpágina',tab:'Desplegable con sus secciones y contenido'};
const restricted:Record<string,string>={child_database:'Una base hija requiere copiar esquema, registros y relaciones mediante los endpoints de bases; no se sustituirá por un bloque vacío.',meeting_notes:'Las notas de reunión requieren su endpoint específico; no se pueden crear con el endpoint general de bloques.',transcription:'Las transcripciones requieren su endpoint específico; no se pueden crear con el endpoint general de bloques.',unsupported:'Notion no expone este tipo de bloque para copiarlo mediante la API (por ejemplo, botones o formularios).'};
export function templateBlockPolicy(type:string):{mode:'native'|'convert'|'restricted'|'unknown';detail:string}{
 if(native.has(type))return {mode:'native',detail:'Copia nativa de contenido y propiedades compatibles'};
 if(converted[type])return {mode:'convert',detail:converted[type]};
 if(restricted[type])return {mode:'restricted',detail:restricted[type]};
 return {mode:'unknown',detail:'Tipo no documentado para esta operación. No se descartará su contenido ni se enviará un bloque inválido a Notion.'};
}
