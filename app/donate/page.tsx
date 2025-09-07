// app/donate/page.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import TopNav from "@/components/top-nav";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const DONATE_URL =
  process.env.NEXT_PUBLIC_DONATE_URL ||
  "https://your-donate-provider.example.com/blacktruth";

const PRESETS = [10, 25, 50, 100];

export default function DonatePage() {
  const [amount, setAmount] = useState<string>("25");
  const [isMonthly, setIsMonthly] = useState<boolean>(false);
  const [coverFees, setCoverFees] = useState<boolean>(true);

  const parsedAmount = useMemo(() => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.floor(n);
  }, [amount]);

  const displayAmount = useMemo(() => {
    // Add a simple 3% fee cover if toggled on (rounded up)
    if (!coverFees || parsedAmount <= 0) return parsedAmount;
    return Math.max(parsedAmount, Math.ceil(parsedAmount * 1.03));
  }, [parsedAmount, coverFees]);

  const checkoutBase = useMemo(() => {
    try {
      return new URL(DONATE_URL);
    } catch {
      return null;
    }
  }, []);

  const go = () => {
    const amt = Math.max(1, displayAmount || 0);
    if (checkoutBase) {
      const url = new URL(checkoutBase.toString());
      url.searchParams.set("amount", String(amt));
      if (isMonthly) url.searchParams.set("recurring", "1");
      if (coverFees) url.searchParams.set("cover_fees", "1");
      window.location.href = url.toString();
    } else {
      alert(
        `Proceeding to ${isMonthly ? "monthly" : "one-time"} donation of $${amt}. (Set NEXT_PUBLIC_DONATE_URL for real checkout.)`
      );
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <TopNav />

      {/* Hero */}
      <section className="px-4 md:px-10 py-10 border-b border-white/10 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.12),rgba(0,0,0,0))]">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="inline-flex items-center text-white/80 hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
          <h1 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight">
            Support Black Truth TV
          </h1>
          <p className="mt-2 text-white/80 max-w-2xl">
            Your gift keeps community-centered programming streaming 24/7—documentaries,
            Freedom School content, music blocks, and live events.
          </p>
        </div>
      </section>

      {/* Donate Card */}
      <section className="px-4 md:px-10 py-10">
        <div className="max-w-3xl mx-auto rounded-xl border border-white/10 bg-zinc-950/70 p-6">
          {/* Amount presets */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((v) => {
              const isActive = Number(amount) === v;
              return (
                <Button
                  key={v}
                  type="button"
                  variant={isActive ? "default" : "secondary"}
                  className={
                    isActive
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-gray-700 hover:bg-gray-600 text-white"
                  }
                  onClick={() => setAmount(String(v))}
                  aria-pressed={isActive}
                >
                  ${v}
                </Button>
              );
            })}
          </div>

          {/* Custom amount */}
          <div className="mt-4 flex items-center gap-3">
            <label htmlFor="custom-amount" className="text-sm text-white/80">
              Custom:
            </label>
            <input
              id="custom-amount"
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-40 bg-black/60 border border-white/15 rounded px-3 py-2 text-white outline-none focus:border-white/30"
              placeholder="25"
            />
            <span className="text-xs text-white/60">USD</span>
          </div>

          {/* Options */}
          <div className="mt-5 grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsMonthly((v) => !v)}
              className={`w-full rounded-lg border px-3 py-2 text-sm font-medium transition ${
                isMonthly
                  ? "bg-red-600 border-red-600 text-white"
                  : "bg-black/50 border-white/15 text-white/80 hover:bg-white/5"
              }`}
              aria-pressed={isMonthly}
            >
              {isMonthly ? "Monthly Gift ✓" : "Make it Monthly"}
            </button>

            <button
              type="button"
              onClick={() => setCoverFees((v) => !v)}
              className={`w-full rounded-lg border px-3 py-2 text-sm font-medium transition ${
                coverFees
                  ? "bg-zinc-800 border-white/15 text-white"
                  : "bg-black/50 border-white/15 text-white/80 hover:bg-white/5"
              }`}
              aria-pressed={coverFees}
            >
              {coverFees ? "Cover Processing Fees ✓" : "Cover Processing Fees"}
            </button>
          </div>

          {/* Summary */}
          <div className="mt-5 rounded-lg bg-black/40 border border-white/10 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-white/80">
                {isMonthly ? "Monthly Amount" : "One-Time Amount"}
              </span>
              <span className="font-semibold">
                ${displayAmount > 0 ? displayAmount : 0}
              </span>
            </div>
            {coverFees && parsedAmount > 0 && (
              <div className="mt-1 text-xs text-white/60">
                Includes a small estimate to cover processing fees.
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700"
              disabled={parsedAmount <= 0}
              onClick={go}
            >
              {isMonthly ? "Start Monthly Support" : "Donate"} $
              {displayAmount > 0 ? displayAmount : 0}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="bg-gray-700 hover:bg-gray-600 text-white"
              onClick={() => setIsMonthly((v) => !v)}
            >
              {isMonthly ? "Switch to One-Time" : "Switch to Monthly"}
            </Button>
          </div>

          <p className="mt-5 text-xs text-white/60">
            Set <code className="text-white/80">NEXT_PUBLIC_DONATE_URL</code> to your live
            checkout (Stripe/PayPal/etc.). Payments are processed securely by your
            provider.
          </p>
        </div>
      </section>

      {/* Other ways / Contact */}
      <section className="px-4 md:px-10 pb-12">
        <div className="max-w-3xl mx-auto rounded-xl border border-white/10 bg-zinc-950/50 p-6">
          <h2 className="text-lg font-semibold">Other Ways to Give</h2>
          <p className="mt-2 text-white/80 text-sm">
            Prefer to contribute by check, ACH, or sponsorship? Email us and we’ll follow up
            with details.
          </p>
          <p className="mt-3">
            <a
              href="mailto:director@sfjfamilyservices.org"
              className="underline text-white"
            >
              director@sfjfamilyservices.org
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
