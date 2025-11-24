// app/admin/breaking-news/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type Slot = "lead" | "second" | "cta";

type BreakingCard = {
  id: number;
  slot: Slot;
  heading: string | null;
  subheading: string | null;
  body: string | null;
};

const SLOT_LABELS: Record<Slot, { title: string; tag: string }> = {
  lead: { title: "Today’s Lead Story", tag: "A-Block • Open of the Show" },
  second: { title: "Second Story / Deep Dive", tag: "B-Block • Historical Context" },
  cta: { title: "Closing Notes & Call to Action", tag: "C-Block • What Viewers Can Do" },
};

export default function AdminBreakingNewsPage() {
  const supabase = createClientComponentClient();

  const [cards, setCards] = useState<BreakingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function ensureDefaults(existing: BreakingCard[]) {
    const bySlot = new Map<Slot, BreakingCard>();
    existing.forEach((c) => {
      if (c.slot === "lead" || c.slot === "second" || c.slot === "cta") {
        bySlot.set(c.slot, c);
      }
    });

    const toInsert: { slot: Slot; heading: string; subheading: string; body: string }[] = [];

    if (!bySlot.get("lead")) {
      toInsert.push({
        slot: "lead",
        heading: "Democracy on Trial",
        subheading: "Main headline for tonight’s A-block.",
        body: "Edit this text to set your lead story. Example: \"Democracy on Trial: The criminal cases, the courts, and the consequences for our communities.\"",
      });
    }
    if (!bySlot.get("second")) {
      toInsert.push({
        slot: "second",
        heading: "History Segment / Deep Dive",
        subheading: "Connect today’s news to past struggles.",
        body: "Use this card for your history segment: COINTELPRO, civil rights, voting rights, or past administrations.",
      });
    }
    if (!bySlot.get("cta")) {
      toInsert.push({
        slot: "cta",
        heading: "What Viewers Can Do",
        subheading: "Action steps, resources, and follow-ups.",
        body: "Drop your calls to action here: register to vote, support legal defense funds, follow the Black Political Podcast, share the stream, etc.",
      });
    }

    if (toInsert.length === 0) {
      return existing;
    }

    const { data, error } = await supabase
      .from("breaking_news_cards")
      .insert(toInsert)
      .select("*");

    if (error) {
      console.error("Error inserting default breaking_news_cards:", error);
      return existing;
    }

    return [...existing, ...(data as BreakingCard[])];
  }

  async function loadCards() {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data, error } = await supabase
        .from("breaking_news_cards")
        .select("id, slot, heading, subheading, body")
        .order("slot", { ascending: true });

      if (error) throw error;

      const loaded = (data || []) as BreakingCard[];
      const withDefaults = await ensureDefaults(loaded);

      // Make sure cards are in the desired slot order
      const ordered = ["lead", "second", "cta"].flatMap((slot) =>
        withDefaults.filter((c) => c.slot === slot),
      ) as BreakingCard[];

      setCards(ordered);
    } catch (e: any) {
      console.error("Error loading breaking_news_cards:", e);
      setErrorMsg(e?.message || "Failed to load breaking news cards.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateCard(id: number, field: keyof BreakingCard, value: string) {
    setCards((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              [field]: value,
            }
          : c,
      ),
    );
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = cards.map((c) => ({
        id: c.id,
        slot: c.slot,
        heading: c.heading,
        subheading: c.subheading,
        body: c.body,
      }));

      const { error } = await supabase
        .from("breaking_news_cards")
        .upsert(payload, { onConflict: "id" });

      if (error) throw error;

      setSuccessMsg("Breaking News cards saved successfully.");
    } catch (e: any) {
      console.error("Error saving breaking_news_cards:", e);
      setErrorMsg(e?.message || "Failed to save cards.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Breaking News Card Editor</h1>
          <p className="mt-1 text-sm text-gray-300">
            Control the three main cards that display on the{" "}
            <span className="font-semibold text-amber-300">Breaking News Hub</span>{" "}
            (Channel 21 page).
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            Public page: <code className="text-amber-300">/breaking-news</code>
          </p>
        </div>

        <Link href="/admin">
          <Button variant="outline" className="border-gray-600 bg-gray-900 text-xs">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Button>
        </Link>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="mb-4 rounded border border-red-500 bg-red-900/40 p-3 text-sm text-red-100">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 rounded border border-emerald-500 bg-emerald-900/40 p-3 text-sm text-emerald-100">
          {successMsg}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex flex-col items-center gap-2 py-10 text-sm text-gray-300">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading breaking news cards…
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {cards.map((card) => {
            const slotInfo =
              SLOT_LABELS[card.slot as Slot] ??
              ({ title: card.slot, tag: "" } as { title: string; tag: string });

            return (
              <div
                key={card.id}
                className="rounded-xl border border-gray-700 bg-gray-900/70 p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">
                      {slotInfo.tag}
                    </p>
                    <h2 className="text-lg font-semibold">{slotInfo.title}</h2>
                  </div>
                  <span className="rounded-full border border-gray-600 px-3 py-1 text-xs text-gray-200">
                    Slot: <span className="font-mono">{card.slot}</span>
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Heading */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">
                      Heading / Title
                    </label>
                    <input
                      type="text"
                      value={card.heading || ""}
                      onChange={(e) => updateCard(card.id, "heading", e.target.value)}
                      className="mt-1 w-full rounded border border-gray-600 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                      placeholder="Main line for this block…"
                    />
                  </div>

                  {/* Subheading */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">
                      Subheading / Label
                    </label>
                    <input
                      type="text"
                      value={card.subheading || ""}
                      onChange={(e) => updateCard(card.id, "subheading", e.target.value)}
                      className="mt-1 w-full rounded border border-gray-600 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                      placeholder="One short line under the title…"
                    />
                  </div>

                  {/* Body */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">
                      Body / Description
                    </label>
                    <textarea
                      value={card.body || ""}
                      onChange={(e) => updateCard(card.id, "body", e.target.value)}
                      rows={4}
                      className="mt-1 w-full rounded border border-gray-600 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                      placeholder="Write what you’ll say on-air or what viewers should know…"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Save button */}
          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save All Changes
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
