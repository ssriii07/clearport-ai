'use client';
import Link from 'next/link';
import { usePathname,useRouter } from 'next/navigation';
import { useEffect,useState } from 'react';
import {Icon} from '@/components/Icon';
import {api} from '@/lib/api';
import type {Role} from '@/lib/types';
export default function Shell({children}:{children:React.ReactNode}){
  const path=usePathname(),router=useRouter();
  const [user,setUser]=useState<{email:string;role:Role}|null>(null);
  const [menu,setMenu]=useState(false);
  useEffect(()=>{api<{email:string;role:Role}>('/auth/me').then(setUser).catch(()=>{});},[]);
  useEffect(()=>setMenu(false),[path]);
  async function logout(){await fetch('/api/logout',{method:'POST'});router.replace('/login');router.refresh()}
  return <div className="shell"><button type="button" className="mobile-menu" onClick={()=>setMenu(!menu)} aria-label="Toggle sidebar"><Icon name={menu?'close':'menu'} size={23}/></button><aside className={`sidebar ${menu?'show':''}`}><Link href="/shipments" className="brand"><span className="brandmark"><Icon name="layers" size={22}/></span><span>ClearPort <b>AI</b><small>OPERATIONS PLATFORM</small></span></Link><div className="nav-label">WORKSPACE</div><nav className="sidenav"><Link href="/shipments" className={path.startsWith('/shipments')?'active':''}><Icon name="grid" size={19}/> Shipments <Icon name="chevron" size={15}/></Link></nav><div className="sidebar-foot"><div className="sidebar-note"><Icon name="shield" size={18}/><div><strong>Review-first workflow</strong><span>No unchecked export</span></div></div><div className="user-block"><div className="avatar">{user?.email.slice(0,1).toUpperCase()||'U'}</div><div className="user-info"><strong>{user?.role==='manager'?'Documentation manager':'Documentation executive'}</strong><span>{user?.email||'Checking session…'}</span></div><button type="button" title="Sign out" onClick={()=>void logout()} aria-label="Sign out"><Icon name="logout" size={18}/></button></div></div></aside><main className="main"><header className="topbar"><div><span className="top-indicator"/> SECURE DOCUMENT WORKSPACE</div><span className="topbar-right">FICTIONAL DATA <span className="top-separator"/> {user?.role==='manager'?'MANAGER':'EXECUTIVE'}</span></header><div className="content">{children}</div><footer className="footer">ClearPort AI · Isocode technical assessment · All importer data is fictional</footer></main></div>;
}
