import Link from 'next/link'

export default function PendingPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-lg text-center">
        <h1 className="text-2xl font-bold text-yellow-400 mb-3">Account Setup</h1>
        <p className="text-gray-400 leading-relaxed mb-6">
          Your account is being set up. Please log in to continue.
        </p>
        <Link
          href="/login"
          className="px-6 py-3 bg-yellow-400 text-black rounded-lg font-bold text-sm uppercase hover:bg-yellow-300 transition"
        >
          Go to Login
        </Link>
      </div>
    </div>
  )
}
