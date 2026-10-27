const failures=new Map<string,{message:string;at:number}>();
const key=(id:string)=>id.replace(/^review-mirror-/,'').replace(/-/g,'').toLowerCase();
export function rememberReviewFailure(id:string,error:unknown){if(failures.size>=100)failures.delete(failures.keys().next().value!);failures.set(key(id),{message:error instanceof Error?error.message:String(error||'No se pudo confirmar el envío.'),at:Date.now()});}
export function takeReviewFailure(id:string){const value=failures.get(key(id));failures.delete(key(id));return value&&Date.now()-value.at<300000?value.message:undefined;}
