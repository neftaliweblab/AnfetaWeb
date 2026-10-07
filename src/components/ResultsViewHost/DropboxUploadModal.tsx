"use client";
import {GlobalPasteModal} from './GlobalPasteModal';
import {detectUpload} from '@/lib/drxUploadPlan';
export function DropboxUploadModal({isOpen,onClose,defaultTargetDir='',onUploadSuccess,currentUser='',defaultDomain=''}:{isOpen:boolean;onClose:()=>void;defaultTargetDir?:string;onUploadSuccess:(item:any)=>void;currentUser?:string;defaultDomain?:string}){return <GlobalPasteModal isOpen={isOpen} onClose={onClose} onSuccess={onUploadSuccess} currentUser={currentUser} initialDestination="dropbox" initialDomain={defaultDomain||detectUpload(defaultTargetDir).domain}/>;}
