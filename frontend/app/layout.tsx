import './globals.css';
import type { Metadata } from 'next';
export const metadata:Metadata={title:'ClearPort AI · Customs review',description:'Review, validate and export verified customs data.'};
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body>{children}</body></html>;
}
