// app/donate/page.tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

export default function DonatePage() {
  const [amount, setAmount] = useState<string>("25");

  return (
    <div className="pt-24 px-4 md:px-10 min-h-screen">
      <div className="max-w-3xl mx-auto bg-gray-800 border border-gray-700 rounded-lg p-6">
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
            className="w-40 bg-gray-900 border border-gray-700 rounded px-3 py-2"
            placeholder="Custom"
          />
          <span className="self-center text-gray-400 text-sm">USD</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            className="bg-red-600 hover:bg-red-700"
            onClick={() => {
              // TODO: wire to your real payment flow
              alert(`Proceeding to donate $${amount}`);
            }}
          >
            Donate ${Number(amount || 0)}
          </Button>
          <Button
            variant="secondary"
            className="bg-gray-700 hover:bg-gray-600 text-white"
            onClick={() => {
              // TODO: wire to monthly subscription flow
              alert(`Proceeding to subscribe monthly $${amount}`);
            }}
          >
            Give Monthly
          </Button>
        </div>

        <p className="text-xs text-gray-500 mt-6">
          Transactions are processed securely. This is a placeholder UI — connect Stripe/PayPal to enable live payments.
        </p>
      </div>
    </div>
  );
}
