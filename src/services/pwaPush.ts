import webpush from 'web-push';
import {durableStep,operationKey} from './reliableOperations';
import {supabaseAdmin} from './supabaseServer';
import {readUserState,updateUserState} from './userState';
import {CalendarSettings} from './notionCalendar';
export function pushConfigured(){return Boolean(process.env.ANFETA_VAPID_PUBLIC_KEY&&process.env.ANFETA_VAPID_PRIVATE_KEY&&process.env.ANFETA_VAPID_CONTACT);}
export function validateSubscription(value:any){const url=new URL(value?.endpoint||'');if(url.protocol!=='https:'||url.port||url.username||url.password||!['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(url.hostname))throw new Error('Proveedor de notificaciones no admitido.');if(!/^[A-Za-z0-9_-]{80,100}$/.test(value.keys?.p256dh||'')||!/^[A-Za-z0-9_-]{20,30}$/.test(value.keys?.auth||''))throw new Error('Suscripción de notificaciones inválida.');return {endpoint:url.href,keys:{p256dh:value.keys.p256dh,auth:value.keys.auth}};}
export async function sendPwaPush(settings:CalendarSettings,user:string,message:{title:string;body:string;tag:string;url?:string},delivery?:{key:string;profileId:string}){
 const result={sent:0,failed:0,skipped:0};if(!pushConfigured())return {...result,skipped:1};
 let state:any;
 if(delivery){const q=await supabaseAdmin().from('user_preferences').select('values').eq('user_id',delivery.profileId).maybeSingle();if(q.error)throw Error('No se pudieron consultar las suscripciones push.');state={values:q.data?.values||{}};}else state=await readUserState(settings,user);
 const subscriptions=state.values.pushSubscriptions||[];if(!subscriptions.length)return {...result,skipped:1};
 webpush.setVapidDetails(process.env.ANFETA_VAPID_CONTACT!,process.env.ANFETA_VAPID_PUBLIC_KEY!,process.env.ANFETA_VAPID_PRIVATE_KEY!);const expired=new Set<string>();
 for(const raw of subscriptions){try{const subscription=validateSubscription(raw);let sentNow=false;const send=async()=>{await webpush.sendNotification(subscription,JSON.stringify(message),{TTL:3600,timeout:8000});sentNow=true;return {accepted:true};};if(delivery)await durableStep(operationKey('push',delivery.key,subscription.endpoint),send);else await send();if(sentNow)result.sent++;else result.skipped++;}catch(error:any){result.failed++;if(error.statusCode===404||error.statusCode===410)expired.add(raw.endpoint);console.warn('[ANFETA push] No se confirmó la entrega.');}}
 if(expired.size&&!delivery)await updateUserState(settings,user,{pushSubscriptions:subscriptions.filter((s:any)=>!expired.has(s.endpoint))},state.revision);
 return result;
}
