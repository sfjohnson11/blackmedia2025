import Link from 'next/link'

export default function OnDemandPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-lg text-center">
        <div className="text-6xl mb-6">🎬</div>
        <h1 className="text-3xl font-bold text-yellow-400 mb-3">On-Demand Coming Soon</h1>
        <p className="text-gray-400 leading-relaxed mb-6">
          On-demand streaming is currently in development. Right now you have access to 30+ live channels
          with our membership plan. On-demand will be available at a premium tier soon.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/browse"
            className="px-6 py-3 bg-yellow-400 text-black rounded-lg font-bold text-sm uppercase hover:bg-yellow-300 transition"
          >
            Watch Live TV →
          </Link>
          <Link
            href="/membership"
            className="px-6 py-3 border border-yellow-500/40 text-yellow-400 rounded-lg text-sm hover:bg-yellow-400/10 transition"
          >
            View Membership
          </Link>
        </div>
      </div>
    </div>
  )
}
