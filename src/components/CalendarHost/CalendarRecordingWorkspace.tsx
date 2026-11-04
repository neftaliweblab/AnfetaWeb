"use client";
import {useState} from 'react';
import {ScreenRecorder,type RecordingUploadOptions} from '../ResultsViewHost/ScreenRecorder';
import {GlobalPasteModal,type GlobalPasteImagePayload} from '../ResultsViewHost/GlobalPasteModal';
import type {SearchResultRow} from '@/types/anfeta';
export function CalendarRecordingWorkspace({currentUser}:{currentUser:string}){
  const [files,setFiles]=useState<GlobalPasteImagePayload[]>([]);
  const [target,setTarget]=useState<SearchResultRow|null>(null);
  const [options,setOptions]=useState<RecordingUploadOptions>({});
  return <>
    <ScreenRecorder disabled={files.length>0} onReady={async(file,destination,setup)=>{
      setOptions(setup||{});
      setTarget(destination?{id:destination.id,externalId:destination.id,name:destination.title,source:'Notion',type:'PAGE'} as SearchResultRow:null);
      setFiles([file]);return true;
    }}/>
    <GlobalPasteModal isOpen={files.length>0} currentUser={currentUser} initialFiles={files}
      initialDestination="both" initialDomain={options.domain} initialPerson={options.person}
      initialAction={options.attach?'attach':undefined} attachmentOnly={!!target} suggestedTarget={target}
      onClose={()=>{setFiles([]);setTarget(null);setOptions({});}}
      onSuccess={()=>window.dispatchEvent(new Event('anfeta_data_refreshed'))}/>
  </>;
}
