import { isTrustedOrigin } from '@/lib/security';
import { NextRequest, NextResponse } from 'next/server';
export async function POST(request:NextRequest){if(!isTrustedOrigin(request))return NextResponse.json({detail:'Invalid request origin'},{status:403});const response=NextResponse.json({ok:true});response.cookies.set('clearport_session','',{httpOnly:true,maxAge:0,path:'/'});return response;}
