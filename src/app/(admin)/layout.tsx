import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { getSession, SESSION_COOKIE } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = getSession(token);
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AdminHeader viewOnly={session.role !== 'admin'} />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
