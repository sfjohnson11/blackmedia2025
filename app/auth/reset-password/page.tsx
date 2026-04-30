'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

function ResetPasswordContent() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Handle the hash fragment from the reset link
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    const type = hashParams.get('type')

    if (type === 'recovery' && accessToken) {
      // Set the session manually from the URL tokens
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      }).then(({ error }) => {
        if (error) {
          setError('Reset link is invalid or expired. Please request a new one.')
        } else {
          setReady(true)
        }
        setChecking(false)
      })
    } else {
      // Also listen for PASSWORD_RECOVERY event
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (event === 'PASSWORD_RECOVERY') {
            setReady(true)
            setChecking(false)
          }
        }
      )
      setChecking(false)
      return () => subscription.unsubscribe()
    }
  }, [supabase])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    await supabase.auth.signOut()
    setTimeout(() => router.push('/login'), 2000)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-yellow-400 mb-2">Password Updated!</h1>
          <p className="text-gray-400 text-sm">Redirecting you to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-gray-900 border border-gray-700 rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-yellow-400 mb-2 text-center">Reset Your Password</h1>
        <p className="text-gray-400 text-sm text-center mb-6">Enter your new password below.</p>

        {checking && (
          <div className="text-center py-4">
            <div className="w-8 h-8 border-2 border-yellow-500/20 border-t-yellow-400 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Verifying reset link...</p>
          </div>
        )}

        {!checking && !ready && (
          <div className="bg-red-950/40 border border-red-700 rounded-lg px-4 py-3 text-sm text-red-400 mb-4">
            Reset link is invalid or expired.{' '}
            <a href="/login" className="underline text-yellow-400">Request a new one.</a>
          </div>
        )}

        {!checking && ready && (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">New Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="At least 6 characters"
                className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-yellow-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="Repeat your new password"
                className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-yellow-500"
              />
            </div>

            {error && (
              <div className="bg-red-950/40 border border-red-700 rounded-lg px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-yellow-400 text-black rounded-lg font-bold text-sm uppercase hover:bg-yellow-300 transition disabled:opacity-40"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-yellow-500/20 border-t-yellow-400 rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
