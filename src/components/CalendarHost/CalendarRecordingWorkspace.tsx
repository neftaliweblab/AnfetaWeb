"use client";
import {useState} from 'react';
import {ScreenRecorder} from '../ResultsViewHost/ScreenRecorder';
import {GlobalPasteModal,type GlobalPasteImagePayload} from '../ResultsViewHost/GlobalPasteModal';
import type {SearchResultRow} from '@/types/anfeta';
export function CalendarRecordingWorkspace({currentUser}:{currentUser:string}){
 const [files,setFiles]=useState<GlobalPasteImagePayload[]>([]),[target,setTarget]=useState<SearchResultRow|null>(null);
 return <><ScreenRecorder disabled={files.length>0} onReady={async(file,destination)=>{setTarget(destination?{id:destination.id,externalId:destination.id,name:destination.title,source:'Notion',type:'PAGE'} as SearchResultRow:null);setFiles([file]);return true;}}/><GlobalPasteModal isOpen={files.length>0} currentUser={currentUser} initialFiles={files} initialDestination="both" suggestedTarget={target} onClose={()=>{setFiles([]);setTarget(null);}} onSuccess={()=>window.dispatchEvent(new Event('anfeta_data_refreshed'))}/></>;
}
