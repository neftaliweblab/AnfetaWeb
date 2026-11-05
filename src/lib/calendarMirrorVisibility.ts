import {normalizePerson} from '../services/identityNormalizer';
export const mirrorVisibilityKey=(owner:string)=>'anfeta-calendar-copies:'+normalizePerson(owner);
export function isVisualCalendarCopy(activity:{isReviewMirror?:boolean;isHandoffMirror?:boolean;pageId?:string}){return !!(activity.isReviewMirror||activity.isHandoffMirror||/^(?:review|handoff)-mirror-/.test(activity.pageId||''));}
export function calendarCopyVisible(activity:Parameters<typeof isVisualCalendarCopy>[0],showCopies:boolean){return showCopies||!isVisualCalendarCopy(activity);}
