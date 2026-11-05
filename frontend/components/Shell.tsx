'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useEffect,useState} from 'react';
import {Icon} from '@/components/Icon';
import {FooterCurves} from '@/components/Illustrations';
import {api} from '@/lib/api';
import type {Role} from '@/lib/types';
export default function Shell({children}:{children:React.ReactNode}){
 const path=usePathname(),router=useRouter();const [user,setUser]=useState<{email:string;role:Role}|null>(null);const[open,setOpen]=useState(false);
 useEffect(()=>{api<{email:string;role:Role}>('/auth/me').then(setUser).catch(()=>{});},[]);useEffect(()=>setOpen(false),[path]);
 const current=path.match(/^\/shipments\/(SHP-[A-Za-z0-9-]+)/)?.[1];
 async function logout(){await fetch('/api/logout',{method:'POST'});router.replace('/login');router.refresh()}
 return <div className="mt-shell"><header className="mt-header"><Link className="mt-header-brand" href="/shipments"><span className="mt-logo" aria-hidden="true"><span/><span/><span/></span><strong>ClearPort AI</strong></Link>
 <button className="mt-menu-toggle" type="button" aria-label={open?'Close navigation':'Open navigation'} aria-expanded={open} onClick={()=>setOpen(!open)}><Icon name={open?'close':'menu'} size={21}/></button>
 <nav aria-label="Main navigation" className={`mt-nav ${open?'mt-open':''}`} onClick={e=>{if((e.target as HTMLElement).closest('a'))setOpen(false)}}><Link className={path==='/shipments'?'active':''} href="/shipments">Shipments</Link><Link className="mt-mobile-nav-only" href="/shipments/new">New shipment</Link>{current&&<><Link href={`/shipments/${current}`} className={`mt-mobile-nav-only ${path===`/shipments/${current}`?'active':''}`}>Overview</Link><Link href={`/shipments/${current}/upload`} className={`mt-mobile-nav-only ${path.endsWith('/upload')?'active':''}`}>Uploads</Link><Link href={`/shipments/${current}/review`} className={`mt-mobile-nav-only ${path.endsWith('/review')?'active':''}`}>Review</Link><Link href={`/shipments/${current}/checks`} className={`mt-mobile-nav-only ${path.endsWith('/checks')?'active':''}`}>Checks</Link><Link href={`/shipments/${current}/history`} className={`mt-mobile-nav-only ${path.endsWith('/history')?'active':''}`}>History</Link><Link href={`/shipments/${current}/export`} className={`mt-mobile-nav-only ${path.endsWith('/export')?'active':''}`}>Approval & export</Link></>}</nav>
 <div className="mt-user"><span className="mt-demo-flag" title="This workspace uses fictional sample data">Demo</span><span className="mt-user-bubble" aria-hidden="true">{user?.email.slice(0,1).toUpperCase()||'C'}</span><span className="mt-user-role">{user?.role==='manager'?'Manager':'Executive'}</span><button type="button" title="Sign out" aria-label="Sign out" onClick={()=>void logout()}><Icon name="logout" size={17}/></button></div></header>
 <div className="mt-main"><div className="mt-content">{children}</div><FooterCurves/></div></div>;
}
