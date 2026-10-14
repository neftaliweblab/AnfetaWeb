import {createHash} from 'node:crypto';
// Parallel Notion queries can return identical rows in a different order.
// Hash each full row, then sort hashes; preserve duplicate multiplicity.
export function indexContentVersion(items:any[]){const rows=items.map(item=>createHash('sha256').update(JSON.stringify(item)).digest('hex')).sort();return createHash('sha256').update(rows.join('\n')).digest('hex');}
export function stableIndexRows(items:any[]){const key=(row:any)=>String(row.source||'')+'\0'+String(row.externalId||row.id||row.path||row.name||'');return [...items].sort((a,b)=>{const left=key(a),right=key(b);return left<right?-1:left>right?1:0;});}
