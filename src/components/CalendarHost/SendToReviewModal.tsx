"use client";
import type {NotionCalendarActivity} from '@/types/anfeta';
import {TeamAssignmentDialog} from './TeamAssignmentDialog';
export function SendToReviewModal({activity,onClose,onConfirm}:{activity:NotionCalendarActivity;currentUser:string;onClose:()=>void;onConfirm:(person:string,copy:boolean)=>Promise<boolean|void>|void}){
 return <TeamAssignmentDialog activity={activity} mode="review" onClose={onClose} onConfirm={(person,copy)=>onConfirm(person,copy)}/>;
}
