'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function MembershipContent() {
  const searchParams = useSearchParams()
  const cancelled = searchParams.get('cancelled')
  const member = searchParams.get('member')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => setProfile(d.profile))
      .catch(() => {})
  }, [])

  async function checkout() {
    setLoading(true)
    const res = await fetch('/api/stripe/create-checkout', { method: 'POST' })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      alert('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  async function manageSubscription() {
    setLoading(true)
    const res = await fetch('/api/stripe/customer-portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      alert('Something went wrong.')
      setLoading(false)
    }
  }

  const isActive = profile?.membership_status === 'active'
  const isConstructiq = profile?.membership_tier === 'constructiq'

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <Link href="/browse" className="text-yellow-400 text-sm hover:underline">← Back to TV</Link>
        {isActive && !isConstructiq && (
          <button
            onClick={manageSubscription}
            disabled={loading}
            className="text-xs text-gray-400 hover:text-yellow-400 underline"
          >
            Manage subscription
          </button>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Brand stripe */}
        <div className="h-1 rounded mb-8" style={{ background: 'repeating-linear-gradient(90deg, #b8860b 0,#b8860b 20%,#8b1a1a 20%,#8b1a1a 40%,#1a5c2e 40%,#1a5c2e 60%,#b8860b 60%,#b8860b 80%,#000 80%,#000 100%)' }} />

        {member && (
          <div className="bg-green-900/30 border border-green-700 rounded-xl px-5 py-3 mb-8">
            <span className="text-green-400 font-semibold">🎉 Welcome, Member! You now have full access to all channels — and you&apos;re helping keep the network alive.</span>
          </div>
        )}

        {cancelled && (
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl px-5 py-3 mb-8">
            <span className="text-yellow-400 text-sm">No problem — you can join whenever you&apos;re ready. The free tier is still yours.</span>
          </div>
        )}

        {isConstructiq && (
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl px-5 py-3 mb-8">
            <span className="text-yellow-400 font-semibold">✓ Constructiq Family — Construction channels included with your family plan.</span>
          </div>
        )}

        {/* ===== HERO ===== */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200 mb-5">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            Private Members&apos; Network
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-3">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 via-yellow-100 to-white">
              The history they hide.
            </span>
            <br />
            <span className="text-white">For less than a sandwich.</span>
          </h1>
          <p className="text-gray-300 leading-relaxed max-w-xl mx-auto">
            30+ channels of truth-centered programming. Documentaries, lectures,
            music, and live broadcasts the algorithm won&apos;t show you. Built
            independent. Built to last.
          </p>
        </div>

        {/* ===== PRICING ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">

          {/* Free */}
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
            <div className="font-bold text-white text-lg mb-1">Free</div>
            <div className="text-3xl font-bold text-gray-400 mb-4">$0</div>
            <ul className="space-y-2 mb-6">
              {[
                { text: '10 live channels', included: true },
                { text: 'Resistance TV', included: true },
                { text: 'Black History Uncut', included: true },
                { text: 'Black StoryTime', included: true },
                { text: 'Black Truth LIVE', included: true },
                { text: 'All 30+ channels', included: false },
                { text: 'Construction education', included: false },
                { text: 'Freedom School', included: false },
              ].map((f, i) => (
                <li key={i} className={`text-sm flex items-center gap-2 ${f.included ? 'text-gray-300' : 'text-gray-600'}`}>
                  <span>{f.included ? '✓' : '✗'}</span>{f.text}
                </li>
              ))}
            </ul>
            <div className="w-full py-2 text-center text-gray-500 text-sm border border-gray-700 rounded-xl">
              Your current access
            </div>
          </div>

          {/* Member */}
          <div className="bg-gray-900 border-2 border-yellow-500 rounded-2xl p-6 relative shadow-[0_0_50px_-15px_rgba(250,204,21,0.4)]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-yellow-400 text-black rounded-full text-xs font-bold uppercase tracking-widest">
              Full Access
            </div>
            <div className="font-bold text-white text-lg mb-1">Member</div>
            <div className="text-3xl font-bold text-yellow-400 mb-1">
              $9.99<span className="text-base text-gray-400">/mo</span>
            </div>
            <div className="text-xs text-gray-500 mb-4">Cancel anytime · Secure checkout via Stripe</div>
            <ul className="space-y-2 mb-6">
              {[
                'All 30+ live channels',
                'Resistance TV + History channels',
                'Black StoryTime + Sankofa Kids',
                'Construction education channels',
                'Freedom School Channel',
                'Black Truth Music Experience',
                'Politics Then &amp; Now',
                'Teaching Truth TV',
              ].map((f, i) => (
                <li key={i} className="text-sm text-gray-300 flex items-center gap-2">
                  <span className="text-yellow-400">✓</span>
                  <span dangerouslySetInnerHTML={{ __html: f }} />
                </li>
              ))}
            </ul>

            {/* Value reframe right above CTA */}
            {!isActive && !isConstructiq && (
              <p className="text-[11px] text-gray-400 leading-relaxed mb-3 text-center">
                $9.99/mo · 33¢ a day · Less than one streaming service —
                and unlike them, this content can&apos;t be taken down.
              </p>
            )}

            {isActive && !isConstructiq ? (
              <button
                onClick={manageSubscription}
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-bold bg-green-700 text-white disabled:opacity-40"
              >
                {loading ? 'Loading...' : '✓ Active Member — Manage'}
              </button>
            ) : isConstructiq ? (
              <div className="w-full py-3 text-center rounded-xl text-sm font-bold bg-yellow-400/10 text-yellow-400 border border-yellow-500/40">
                Included with Constructiq
              </div>
            ) : (
              <button
                onClick={checkout}
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-bold bg-yellow-400 text-black hover:bg-yellow-300 transition disabled:opacity-40"
              >
                {loading ? 'Loading...' : 'Become a Member — $9.99/mo'}
              </button>
            )}
          </div>
        </div>

        {/* ===== WHERE YOUR MEMBERSHIP GOES ===== */}
        {!isActive && !isConstructiq && (
          <div className="bg-gradient-to-br from-amber-950/40 via-gray-900 to-black border border-amber-500/20 rounded-2xl p-6 mb-8">
            <div className="text-amber-300 text-xs font-bold uppercase tracking-wide mb-2">
              Where your $9.99 goes
            </div>
            <h3 className="text-xl font-bold mb-3">You&apos;re funding the archive — and protecting it.</h3>
            <p className="text-gray-300 text-sm leading-relaxed mb-3">
              Black Truth TV has no corporate parent and no outside advertisers
              shaping the lineup. Member subscriptions pay for the streams, the
              servers, the licensing, and the infrastructure that keeps this
              content online when other platforms would pull it down.
            </p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Independent. Curated. Protected. That&apos;s the deal — and that&apos;s
              why members fund it.
            </p>
          </div>
        )}

        {/* ===== CONSTRUCTIQ NOTE ===== */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-8">
          <div className="text-yellow-400 font-semibold text-sm mb-1">🏗️ Constructiq Family Members</div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Constructiq Family and Family Plus accounts get free access to all construction education channels on Black Truth TV.
            {' '}
            <Link href="https://www.constructiqbysfj.com/family/signup" className="text-yellow-400 hover:underline" target="_blank">
              Create a Constructiq account →
            </Link>
          </p>
        </div>

        {/* ===== FAQ ===== */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-white mb-4">Common questions</h2>
          <div className="space-y-3">
            {[
              {
                q: 'Why is this paid and not free like YouTube?',
                a: 'Free platforms have demonetized, flagged, and removed Black truth-tellers for years. Member-funded means we don&apos;t answer to advertisers, an algorithm, or a coordinated flag campaign. The content stays here because you keep it here.',
              },
              {
                q: 'Can I cancel anytime?',
                a: 'Yes. Cancel from your account settings in one click. You keep access until the end of your billing period — no questions, no retention calls.',
              },
              {
                q: 'What channels do I get for free?',
                a: 'Resistance TV, Black History Uncut, Black PBS, Culture &amp; Revolution, Black StoryTime, Sankofa Kids, Nature &amp; Discovery, The Black Music Vault, Black Truth LIVE, and The Family Channel.',
              },
              {
                q: 'What happens if a platform tries to take this content down?',
                a: 'Black Truth TV operates on independent infrastructure as a private members&apos; network. We have a documented takedown response process for legitimate copyright requests, and the archive is not dependent on YouTube, TikTok, or Facebook to stay online.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'All major credit and debit cards, processed by Stripe. Secure, encrypted, and we never see or store your card details.',
              },
              {
                q: 'Do you have a family plan?',
                a: 'Constructiq Family accounts include free access to construction education channels on Black Truth TV. Visit constructiqbysfj.com to sign up the household.',
              },
              {
                q: 'Is my membership shared with anyone?',
                a: 'No. We don&apos;t sell, rent, or share member data. The community chat is moderated and members-only. Your viewing stays between you and the network.',
              },
            ].map((faq, i) => (
              <div key={i} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                <div className="font-semibold text-sm text-white mb-1">{faq.q}</div>
                <div
                  className="text-sm text-gray-400 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: faq.a }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ===== TRUST FOOTER ===== */}
        <div className="border-t border-gray-800 pt-6 text-center">
          <p className="text-xs text-gray-500 leading-relaxed">
            Operated independently by SF Johnson Consulting &amp; Construction Services.
            <br />
            Secure payments by Stripe · Cancel anytime · DMCA-compliant takedown process in place.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
            <Link href="/about" className="text-gray-400 hover:text-yellow-400">About</Link>
            <Link href="/contact" className="text-gray-400 hover:text-yellow-400">Contact</Link>
            <Link href="/privacy" className="text-gray-400 hover:text-yellow-400">Privacy</Link>
            <Link href="/copyright" className="text-gray-400 hover:text-yellow-400">Copyright / Takedown</Link>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function MembershipPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-yellow-500/20 border-t-yellow-400 rounded-full animate-spin" />
      </div>
    }>
      <MembershipContent />
    </Suspense>
  )
}
