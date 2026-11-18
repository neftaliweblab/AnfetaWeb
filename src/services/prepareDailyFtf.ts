import {invalidateSnapshots} from './notionSnapshotCache';
import {resetDailyFtf} from './ftfDailyReset';
import {rolloverDailyFtf} from './ftfRollover';

export async function prepareDailyFtf(settings:any,actor:string,day:string,now=new Date()){
 const errors:string[]=[];
 let resetTotal=0,movedTotal=0,failedTotal=0;
 let resetRemaining=0,rolloverRemaining=0;
 let lastReset:any={reset:0,remaining:0,failed:0};

 for(let step=0;step<15;step++){
  const res=await resetDailyFtf(settings,actor,day,now);
  lastReset=res;
  resetTotal+=res.reset||0;
  failedTotal+=res.failed||0;
  resetRemaining=res.remaining||0;
  if('errors' in res && Array.isArray(res.errors))errors.push(...res.errors);
  if('skipped' in res && res.skipped || !res.remaining || !res.reset)break;
 }

 for(let step=0;step<15;step++){
  const roll=await rolloverDailyFtf(settings,actor,day,now);
  movedTotal+=roll.moved||0;
  failedTotal+=roll.failed||0;
  rolloverRemaining=roll.remaining||0;
  if('errors' in roll && Array.isArray(roll.errors))errors.push(...roll.errors);
  if('skipped' in roll && roll.skipped || !roll.remaining || !roll.moved)break;
 }

 if(resetTotal||movedTotal)await invalidateSnapshots(settings);
 return {
  ...lastReset,
  reset:resetTotal,
  moved:movedTotal,
  remaining:resetRemaining+rolloverRemaining,
  failed:failedTotal,
  errors,
 };
}
