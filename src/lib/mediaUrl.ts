export function mediaUrl(value:unknown){if(typeof value!=='string')return '';try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}}
