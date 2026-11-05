import React from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { AdminLayoutClient } from '@/components/admin/AdminLayoutClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sahayak Admin Console | Operations & Governance',
  description: 'Enterprise administration, moderation, safety monitoring, and fair pricing control for Sahayak.',
};

export const instant = false;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();

  const supabase = await getSupabaseServerClient();

  let adminName = 'Super Administrator';
  let adminEmail = 'admin@sahayak.internal';

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // In production/configured environment, redirect to login
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        redirect('/login?redirect=/admin');
      }
    } else {
      adminEmail = user.email || adminEmail;

      // Check role server-side via privileged admin client
      const adminClient = getSupabaseAdminClient();
      if (adminClient) {
        const { data: profile } = await adminClient
          .from('profiles')
          .select('full_name, role, is_suspended')
          .eq('id', user.id)
          .maybeSingle();

        const roleUpper = String(profile?.role || '').toUpperCase();
        if (roleUpper !== 'ADMIN' || profile?.is_suspended) {
          redirect('/');
        }

        if (profile?.full_name) {
          adminName = profile.full_name;
        }
      }
    }
  }

  return (
    <AdminLayoutClient adminName={adminName} adminEmail={adminEmail}>
      {children}
    </AdminLayoutClient>
  );
}

