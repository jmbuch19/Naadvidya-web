import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Refresh the session if expired - required for Server Components
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = (
    path.startsWith('/dashboard') ||
    path.startsWith('/credits') ||
    path.startsWith('/book') ||
    path.startsWith('/session') ||
    path.startsWith('/homework') ||
    path.startsWith('/teacher/') ||
    path.startsWith('/admin')
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('returnTo', path);
    return NextResponse.redirect(url);
  }

  // Role gates for /teacher/* and /admin/*
  if (user && (path.startsWith('/teacher/') || path.startsWith('/admin'))) {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle<{ role: 'owner_admin' | 'teacher' | 'student' }>();

    const role = data?.role;

    if (path.startsWith('/admin') && role !== 'owner_admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    if (path.startsWith('/teacher/') && role !== 'teacher' && role !== 'owner_admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return response;
}
