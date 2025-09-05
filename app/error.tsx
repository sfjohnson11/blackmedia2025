// app/error.tsx
"use client";

export default function RootError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  return (
    <div className="min-h-[60vh] grid place-items-center bg-black text-white px-6">
      <div className="max-w-lg text-center">
        <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
        <p className="text-sm text-white/70 mb-4">
          {error?.message || "We hit a snag while rendering this page."}
        </p>
        <button
          className="rounded bg-yellow-400 text-black px-4 py-2 font-semibold"
          onClick={() => reset()}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
