'use client';

import { Suspense, useEffect, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/utils/supabase/client';

// ---------- INNER LOGIN COMPONENT (uses useSearchParams) ----------
function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Read ?error= from the URL (e.g. /login?error=not_admin)
  useEffect(() => {
    const err = searchParams.get('error');
    if (!err) return;

    if (err === 'not_admin') {
      setErrorMsg("You don't have admin access on this account.");
    } else if (err === 'not_logged_in') {
      setErrorMsg('Please log in to continue.');
    } else {
      // generic message if some other error text shows up
      setErrorMsg(err.replace(/_/g, ' '));
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const supabase = getSupabaseClient();

    // 1) Sign in with Supabase
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError || !signInData.user) {
      setErrorMsg(
        signInError?.message ||
          'Unable to sign in. Please check your email and password.'
      );
      setLoading(false);
      return;
    }

    const user = signInData.user;

    // 2) Fetch profile to get role (and trade later if you want)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error(profileError);
      setErrorMsg('Could not load your profile. Please contact support.');
      setLoading(false);
      return;
    }

    const role = profile?.role;

    // 3) Redirect based on role
    if (role === 'admin') {
      router.push('/admin');
    } else {
      // Non-admins go to the main app/home
      router.push('/');
    }

    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at top, #1f3b73 0, #050816 55%, #000 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'rgba(10,20,40,0.9)',
          borderRadius: 16,
          padding: '28px 24px 24px',
          boxShadow: '0 18px 45px rgba(0,0,0,0.65)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            marginBottom: 6,
            textAlign: 'center',
          }}
        >
          Black Truth TV Login
        </h1>
        <p
          style={{
            fontSize: 14,
            opacity: 0.8,
            textAlign: 'center',
            marginBottom: 18,
          }}
        >
          Use your email and password. Admin accounts will be routed to the admin
          dashboard.
        </p>

        {errorMsg && (
          <div
            style={{
              marginBottom: 16,
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(127,29,29,0.2)',
              border: '1px solid rgba(248,113,113,0.5)',
              fontSize: 13,
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <label style={{ fontSize: 13 }}>
            <span style={{ display: 'block', marginBottom: 4 }}>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 10px',
                borderRadius: 8,
                border: '1px solid rgba(148,163,184,0.7)',
                background: 'rgba(15,23,42,0.9)',
                color: '#fff',
                fontSize: 14,
              }}
            />
          </label>

          <label style={{ fontSize: 13 }}>
            <span style={{ display: 'block', marginBottom: 4 }}>Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 10px',
                borderRadius: 8,
                border: '1px solid rgba(148,163,184,0.7)',
                background: 'rgba(15,23,42,0.9)',
                color: '#fff',
                fontSize: 14,
              }}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: '10px 12px',
              borderRadius: 999,
              border: 'none',
              cursor: loading ? 'default' : 'pointer',
              background:
                'linear-gradient(135deg, #FFD700 0%, #fbbf24 35%, #f97316 80%)',
              color: '#111827',
              fontWeight: 700,
              fontSize: 14,
              textTransform: 'uppercase',
              letterSpacing: 0.06,
              boxShadow: '0 10px 25px rgba(180,83,9,0.5)',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------- PAGE EXPORT (wraps useSearchParams in Suspense) ----------
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            background: '#020617',
            color: '#e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
          }}
        >
          Loading login…
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
