"use client";
import type {NotionCalendarActivity} from '@/types/anfeta';
import {TeamAssignmentDialog} from './TeamAssignmentDialog';
export function ReassignActivityModal({activity,onClose,onConfirm}:{activity:NotionCalendarActivity;onClose:()=>void;onConfirm:(updates:any)=>Promise<boolean|void>|void}){
 return <TeamAssignmentDialog activity={activity} mode="handoff" onClose={onClose} onConfirm={(person,copy,note,files)=>onConfirm({handoff:true,person,note,files,leaveVisualCopy:copy})}/>;
}
