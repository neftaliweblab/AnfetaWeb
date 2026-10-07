const pattern=/(?<![\p{L}\p{N}_])(?:sprtuzREVISION|aprtuzREVISION|prtuzREVISION|rtuzREVISION|zREVISION|aads|sseo|wwebs|mmaps|ddise|aapli|pprog|rrede|cchat|rrapi|mmapi|bblib|ccoti|coti|(?:jjohn|john|nneft|nnetf|neft|kkarl|karl|iisai|iisaia|isai|aandr|andr|ggena|gena|ssote|sote|aacal|acal|bbria|bria|eemma|emma)\d*|00)(?![\p{L}\p{N}_])|(?:\d{2}-)?\[\d{2,4}[A-ZÁÉÍÓÚ]+\]|(?:https?:\/\/)?(?:[a-z0-9-]+\.)+(?:com|mx|net|org|io|vip|app|edu|gob|co|ai|dev|info|biz|us|es|online|site)(?![a-z0-9.-])/giu;
export function activityDescription(title:string){return title.replace(pattern,' ').replace(/\s+/g,' ').trim();}
// Preserve structured calendar tokens while replacing only the description.
export function editActivityDescription(original:string,description:string){
 const name=description.trim();if(!name||name.length>1200)throw new Error('Escribe una descripción entre 1 y 1200 caracteres.');

 const tokens=[...original.matchAll(pattern)].map(m=>m[0]);const people=/^(?:jjohn|john|nneft|nnetf|neft|kkarl|karl|iisai|iisaia|isai|aandr|andr|ggena|gena|ssote|sote|aacal|acal|bbria|bria|eemma|emma)\d*$|^00$/i;
 return [...tokens.filter(t=>!people.test(t)),name,...tokens.filter(t=>people.test(t))].join(' ');
}
