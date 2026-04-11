import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/auth/auth-service';

export default async function MainLayout({ children }: { children: ReactNode }) {
  const user = await getAuthUser();
  
  if (!user) {
    redirect('/login');
  }

  return <>{children}</>;
}
