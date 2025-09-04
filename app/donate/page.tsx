// app/donate/page.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import TopNav from "@/components/top-nav"; // make sure you have components/top-nav.tsx
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const DONATE_URL =
  process.env.NEXT_PUBLIC_DONATE_URL || "https://your-donate-provider.example.com/blacktruth";

export default function DonatePage() {
  const [amount, setAmount] = useState<string>("25");

  const checkoutBase = useMemo(() => {
    // build a base URL we can reuse
    try {
      return new URL(DONATE_URL);
    } catch {
      return null;
    }
  }, []);

  const go = (recurring = false) => {
    const amt = Math.max(1, Number(amount || 0));
    if (checkoutBase) {
      const url = new URL(checkoutBase.toString());
      url.searchParams.set("amount", String(amt));
      if (recurring) url.searchParams.set("recurring", "1");
      window.location.href = url.toString();
    } else {
      // fallback if DONATE_URL isn't a full URL yet
      alert(`Proceeding to ${recurring ? "monthly" : "one-time"} donation of $${amt}`);
    }
  };

  return (
    <div className="min-h-screen">
      <TopNav />
      <div className="px-4 md:px-10 py-10">
        <div className="max-w-3xl mx-auto bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center mb-6">
            <Link href="/" className="mr-4">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Donate</h1>
          </div>

          <p className="text-gray-300 mb-6">
            Your support keeps Black Truth TV streaming 24/7. Choose a quick amount or enter a custom one.
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {["10", "25", "50", "100"].map((v) => (
              <Button
                key={v}
                variant={amount === v ? "default" : "secondary"}
                className={amount === v ? "bg-red-600 hover:bg-red-700" : "bg-gray-700 hover:bg-gray-600 text-white"}
                onClick={() => setAmount(v)}
              >
                ${v}
              </Button>
            ))}
          </div>

          <div className="flex gap-2 mb-6">
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-40 bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white"
              placeholder="Custom"
            />
            <span className="self-center text-gray-400 text-sm">USD</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => go(false)}>
              Donate ${Math.max(1, Number(amount || 0))}
            </Button>
            <Button
              variant="secondary"
              className="bg-gray-700 hover:bg-gray-600 text-white"
              onClick={() => go(true)}
            >
              Give Monthly
            </Button>
          </div>

          <p className="text-xs text-gray-500 mt-6">
            Set <code className="text-gray-300">NEXT_PUBLIC_DONATE_URL</code> to your real checkout link (Stripe/PayPal/etc.).
          </p>
        </div>
      </div>
    </div>
  );
}
