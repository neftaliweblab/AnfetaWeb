import {readApiJson} from './readApiJson';
export async function loadAccountPreferences(){return readApiJson(await fetch('/api/workspace',{cache:'no-store'}));}
export async function saveAccountPreferences(patch:Record<string,any>,expectedRevision?:number){return readApiJson(await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patch,expectedRevision})}));}
