'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
export default function Login(){
  const router=useRouter();
  const [email,setEmail]=useState('executive@clearport.demo');const [password,setPassword]=useState('DemoExec#2026');
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError('');
    try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
      const data=await r.json();if(!r.ok)throw new Error(data.detail||'Sign in failed');router.replace('/shipments');router.refresh();
    }catch(e){setError(e instanceof Error?e.message:'Unable to sign in');}finally{setBusy(false);}
  }
  return <div className="login-wrap"><div className="login-brand"><span className="logo-big"><Icon name="layers" size={29}/></span><span className="eyebrow light">CUSTOMS OPERATIONS, REIMAGINED</span><h1>Clarity in every<br/>shipment.</h1><p>Read the documents. Catch the mismatch. Review with confidence.</p><div className="login-foot">CLEARPORT AI <span>·</span> DOCUMENT INTELLIGENCE</div></div><div className="login-panel"><div className="login-card"><div className="tag">SECURE WORKSPACE</div><h2>Welcome back</h2><p className="muted">Sign in to continue reviewing your shipments.</p><form onSubmit={submit} className="form-stack"><label>Email address<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required autoComplete="username"/></label><label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" required autoComplete="current-password"/></label>{error&&<p className="notice error" role="alert">{error}</p>}<button className="btn primary large" disabled={busy} type="submit">{busy?'Signing in…':'Sign in to workspace'} <Icon name="arrow-right" size={17}/></button></form><div className="demo-hint"><strong>Reviewer demo accounts</strong><button type="button" onClick={()=>{setEmail('executive@clearport.demo');setPassword('DemoExec#2026');}}>Use executive</button><button type="button" onClick={()=>{setEmail('manager@clearport.demo');setPassword('DemoManager#2026');}}>Use manager</button></div><p className="small muted">Fictional demonstration data only. Do not upload client documents to the free AI tier.</p></div></div></div>
}
