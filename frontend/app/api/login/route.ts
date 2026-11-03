import { isTrustedOrigin } from '@/lib/security';
import { NextRequest,NextResponse } from 'next/server';
const BACKEND=(process.env.BACKEND_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
export async function POST(request:NextRequest){
  try{
    if(!isTrustedOrigin(request))return NextResponse.json({detail:'Invalid request origin'},{status:403});
    const body=await request.json();
    if(typeof body.email!=='string'||typeof body.password!=='string')return NextResponse.json({detail:'Enter an email and password.'},{status:422});
    const response=await fetch(`${BACKEND}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:body.email,password:body.password}),signal:AbortSignal.timeout(12000),cache:'no-store'});
    const data=await response.json();
    if(!response.ok)return NextResponse.json({detail:data.detail||'Login failed'},{status:response.status});
    if(typeof data.access_token!=='string')return NextResponse.json({detail:'Unexpected login response'},{status:502});
    const out=NextResponse.json({role:data.role});
    out.cookies.set('clearport_session',data.access_token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:60*60*3});
    return out;
  }catch{return NextResponse.json({detail:'Cannot reach the backend. Is FastAPI running on port 8000?'},{status:502});}
}
