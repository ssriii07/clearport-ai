'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Icon} from '@/components/Icon';
import {FooterCurves,PaperworkLineArt} from '@/components/Illustrations';
export default function Login(){
 const router=useRouter();const[email,setEmail]=useState('executive@clearport.demo'),[password,setPassword]=useState('DemoExec#2026');
 const[busy,setBusy]=useState(false),[error,setError]=useState(''),[reveal,setReveal]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});const d=await r.json();if(!r.ok)throw new Error(d.detail||'Sign-in failed. Check your credentials and try again.');router.replace('/shipments');router.refresh()}catch(e){setError(e instanceof Error?e.message:'Unable to sign in. Try again.')}finally{setBusy(false)}}
 return <main className="mt-login"><header className="mt-login-brand"><span className="mt-logo" aria-hidden="true"><span/><span/><span/></span><strong>ClearPort AI</strong></header><div className="mt-login-layout">
  <section className="mt-login-intro"><PaperworkLineArt className="mt-login-art"/><h1>Three documents.<br/>One source of truth.</h1><p>AI-powered extraction and cross-checks for faster, safer customs documentation.</p></section>
  <section className="mt-login-box"><div className="mt-login-form"><h2>Sign in to ClearPort AI</h2><p>Continue to your customs workspace.</p><form onSubmit={submit}><label htmlFor="login-email">Email</label><input id="login-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required/><label htmlFor="login-password">Password</label><div className="mt-password"><input id="login-password" type={reveal?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/><button type="button" aria-label={reveal?'Hide password':'Show password'} onClick={()=>setReveal(!reveal)}><Icon name="eye" size={18}/></button></div>{error&&<p className="notice error" role="alert">{error}</p>}<button className="btn primary large mt-login-submit" type="submit" disabled={busy}>{busy?'Signing in…':'Sign in'} <Icon name="arrow-right" size={17}/></button></form><div className="mt-demo"><span>Fictional demo access:</span><button type="button" onClick={()=>{setEmail('executive@clearport.demo');setPassword('DemoExec#2026')}}>Executive</button><button type="button" onClick={()=>{setEmail('manager@clearport.demo');setPassword('DemoManager#2026')}}>Manager</button></div><small>Use fictional documents only. No real client data in this demonstration.</small></div></section>
 </div><FooterCurves/></main>
}
