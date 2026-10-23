import {invalidateSnapshots} from './notionSnapshotCache';
import {resetDailyFtf} from './ftfDailyReset';
import {rolloverDailyFtf} from './ftfRollover';
export async function prepareDailyFtf(settings:any,actor:string,day:string,now=new Date()){
 const reset=await resetDailyFtf(settings,actor,day,now);
 const rollover=await rolloverDailyFtf(settings,actor,day,now);
 if(reset.reset||rollover.moved)await invalidateSnapshots(settings);
 return {...reset,moved:rollover.moved,remaining:reset.remaining+rollover.remaining,failed:reset.failed+rollover.failed,errors:[...('errors' in reset?reset.errors:[]),...('errors' in rollover?rollover.errors:[])]};
}
