import { isTrustedOrigin } from '@/lib/security';
import { cookies } from 'next/headers';
import { NextRequest,NextResponse } from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const BACKEND=(process.env.BACKEND_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
const ALLOWED=new Set(['shipments','auth']);
async function proxy(request:NextRequest,params:Promise<{path:string[]}>){
  if(request.method!=='GET'){if(!isTrustedOrigin(request))return NextResponse.json({detail:'Invalid request origin'},{status:403});}
  const session=(await cookies()).get('clearport_session')?.value;
  if(!session)return NextResponse.json({detail:'Not signed in'},{status:401});
  const {path}=await params;
  if(!path?.length || !ALLOWED.has(path[0]) || path.some(s=>s==='.'||s==='..'||s.includes('/')||s.includes('\\'))){
    return NextResponse.json({detail:'Invalid API path'},{status:404});
  }
  if(path[0]==='auth' && path.join('/')!=='auth/me')return NextResponse.json({detail:'Invalid API path'},{status:404});
  const url=`${BACKEND}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;
  const method=request.method;
  const headers:Record<string,string>={Authorization:`Bearer ${session}`};
  const contentType=request.headers.get('content-type');
  if(contentType && method!=='GET')headers['Content-Type']=contentType;
  try{
    const body=(method==='POST'||method==='PATCH') ? Buffer.from(await request.arrayBuffer()) : undefined;
    const upstream=await fetch(url,{method,headers,body,cache:'no-store',signal:AbortSignal.timeout(90000)});
    const bytes=await upstream.arrayBuffer();
    const responseHeaders=new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    for(const h of ['content-type','content-disposition','x-evidence-found','x-evidence-page','x-page-count','x-page-number']){
      const v=upstream.headers.get(h);if(v)responseHeaders.set(h,v);
    }
    return new NextResponse(bytes,{status:upstream.status,headers:responseHeaders});
  }catch{return NextResponse.json({detail:'Cannot contact ClearPort backend. Check that FastAPI is running.'},{status:502});}
}
export async function GET(r:NextRequest,c:{params:Promise<{path:string[]}>}){return proxy(r,c.params);}
export async function POST(r:NextRequest,c:{params:Promise<{path:string[]}>}){return proxy(r,c.params);}
export async function PATCH(r:NextRequest,c:{params:Promise<{path:string[]}>}){return proxy(r,c.params);}
