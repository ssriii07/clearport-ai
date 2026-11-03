import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
export default async function WorkspaceLayout({children}:{children:React.ReactNode}){
  if(!(await cookies()).has('clearport_session'))redirect('/login');
  return <Shell>{children}</Shell>;
}
