export async function api<T>(url:string, options:RequestInit={}): Promise<T>{
  const response = await fetch(`/api/relay${url}`, {cache:'no-store', ...options});
  if(response.status===401){ window.location.href='/login'; throw new Error('Session expired. Sign in again.'); }
  if(!response.ok){
    let message=`Request failed (${response.status})`;
    try {const payload=await response.json(); message=typeof payload.detail==='string'?payload.detail:message;}catch{}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
export function formatDate(value?:string) {
  if(!value) return '—';
  const normalized=value.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
  const date=new Date(normalized); return isNaN(date.getTime())?value:date.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});
}
export function niceText(value:unknown):string {
  if(value===null || value===undefined || value==='') return 'Not extracted';
  if(Array.isArray(value)) return value.join(', ');
  return String(value);
}
export function fieldLabel(s:string):string {
  return s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}
