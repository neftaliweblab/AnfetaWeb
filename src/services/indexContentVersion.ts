import {createHash} from 'node:crypto';
// Parallel Notion queries can return identical rows in a different order.
// Hash each full row, then sort hashes; preserve duplicate multiplicity.
export function indexContentVersion(items:any[]){const rows=items.map(item=>createHash('sha256').update(JSON.stringify(item)).digest('hex')).sort();return createHash('sha256').update(rows.join('\n')).digest('hex');}
