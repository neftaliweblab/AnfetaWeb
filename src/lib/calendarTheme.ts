export const calendarThemes={
  soft:{background:'#080b0f',lines:'#293e52',hours:'#b8d6e8'},
  blue:{background:'#0c1725',lines:'#3d6687',hours:'#bdeaff'},
  contrast:{background:'#05080b',lines:'#658ba6',hours:'#e2f7ff'}
};
export function parseCalendarTheme(raw:string|null){
  const fallback=calendarThemes.soft;
  try{const value=JSON.parse(raw||'null');if(!value)return fallback;return {background:/^#[\da-f]{6}$/i.test(value.background)?value.background:fallback.background,lines:/^#[\da-f]{6}$/i.test(value.lines)?value.lines:fallback.lines,hours:/^#[\da-f]{6}$/i.test(value.hours)?value.hours:fallback.hours};}catch{return fallback;}
}
