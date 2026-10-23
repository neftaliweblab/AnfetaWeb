"use client";
import {useEffect,useRef} from 'react';
import {subscribeNotionPages} from '@/lib/notionPageWatchHub';
export function useNotionPageWatch(owner:string,rows:any[],enabled:boolean,onStates:(states:any[])=>boolean|void|string[],calendar=false){
  const latest=useRef({rows,onStates});latest.current={rows,onStates};
  useEffect(()=>{
    if(!enabled||!owner)return;
    return subscribeNotionPages(owner,{rows:()=>latest.current.rows,onStates:states=>latest.current.onStates(states),calendar});
  },[owner,enabled,calendar]);
}
