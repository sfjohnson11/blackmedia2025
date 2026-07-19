"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Card = {
  site: string;
  what: string;
  tag?: string;
  /** Builds a pre-filled search URL. If omitted, `href` is used as-is. */
  url?: (q: {
    f: string; // first name (encoded)
    l: string; // last name (encoded)
    s: string; // state (encoded)
    q: string; // full name (encoded)
    exact: string; // "full name" in quotes (encoded)
  }) => string;
  href?: string;
};

type Section = {
  title: string;
  note?: string;
  copyButton?: boolean;
  cards: Card[];
};

const SECTIONS: Section[] = [
  {
    title: "Start here",
    note: "FamilySearch is run by a nonprofit and is 100% free — the largest free genealogy database in the world. A free account unlocks record images.",
    cards: [
      {
        site: "FamilySearch — Historical Records",
        what: "Billions of birth, death, marriage, and census records",
        url: ({ f, l, s }) =>
          `https://www.familysearch.org/search/record/results?q.givenName=${f}&q.surname=${l}${
            s ? `&q.anyPlace=${s}` : ""
          }`,
      },
      {
        site: "FamilySearch — Full-Text Search",
        what: "AI search of handwritten deeds, wills & probate files",
        url: ({ exact }) =>
          `https://www.familysearch.org/en/search/full-text/results?q.text=${exact}`,
      },
    ],
  },
  {
    title: "Census records",
    cards: [
      {
        site: "1950 U.S. Census — National Archives",
        what: "Official name-searchable census images, no account needed",
        url: ({ q }) => `https://1950census.archives.gov/search/?name=${q}`,
      },
      {
        site: "National Archives Catalog",
        what: "Federal records: land, pensions, courts, and more",
        url: ({ q }) => `https://catalog.archives.gov/search?q=${q}`,
      },
    ],
  },
  {
    title: "Freedmen's Bureau & Reconstruction era",
    note: "For Black family research, these records (1865–1872) are often the bridge across the 1870 \u201cbrick wall\u201d — labor contracts, marriage registers, bank records, and ration rolls that name formerly enslaved people. Use the copy button, then paste the name into these portals.",
    copyButton: true,
    cards: [
      {
        site: "Freedmen's Bureau Portal — Smithsonian NMAAHC",
        what: "Searchable transcriptions of Bureau records",
        href: "https://nmaahc.si.edu/explore/initiatives/freedmens-bureau-records",
      },
      {
        site: "DiscoverFreedmen.org",
        what: "Search 1.8M+ indexed Freedmen's Bureau names",
        href: "https://www.discoverfreedmen.org/",
      },
    ],
  },
  {
    title: "Historic newspapers",
    cards: [
      {
        site: "Chronicling America — Library of Congress",
        what: "Full-text search of U.S. newspapers, 1756–1963",
        url: ({ q, s }) =>
          `https://chroniclingamerica.loc.gov/search/pages/results/?andtext=${q}${
            s ? `&state=${s}` : ""
          }`,
      },
      {
        site: "Library of Congress Collections",
        what: "Photos, maps, manuscripts, and oral histories",
        url: ({ q }) => `https://www.loc.gov/search/?q=${q}`,
      },
    ],
  },
  {
    title: "Cemetery records",
    cards: [
      {
        site: "Find a Grave",
        what: "240M+ memorials with photos, dates & family links",
        url: ({ f, l }) =>
          `https://www.findagrave.com/memorial/search?firstname=${f}&lastname=${l}`,
      },
      {
        site: "BillionGraves",
        what: "GPS-mapped headstone photos worldwide",
        tag: "Free · account for some features",
        url: ({ f, l }) =>
          `https://billiongraves.com/search/results?given_names=${f}&family_names=${l}`,
      },
    ],
  },
  {
    title: "Military service",
    cards: [
      {
        site: "Civil War Soldiers & Sailors — National Park Service",
        what: "6.3M service records, incl. U.S. Colored Troops",
        href: "https://www.nps.gov/civilwar/search-soldiers.htm",
      },
      {
        site: "National Archives — Veterans' Records",
        what: "How to request official military service files",
        href: "https://www.archives.gov/veterans",
      },
    ],
  },
  {
    title: "Books, archives & local records",
    cards: [
      {
        site: "Internet Archive",
        what: "Digitized county histories, yearbooks & directories",
        url: ({ exact }) => `https://archive.org/search?query=${exact}`,
      },
      {
        site: "Digital Public Library of America",
        what: "50M+ items from libraries & museums nationwide",
        url: ({ exact }) => `https://dp.la/search?q=${exact}`,
      },
      {
        site: "AccessGenealogy",
        what: "Free records incl. major Native American collections",
        url: ({ q }) => `https://accessgenealogy.com/?s=${q}`,
      },
      {
        site: "USGenWeb Project",
        what: "Volunteer-run free records for every U.S. county",
        href: "https://usgenweb.org/",
      },
    ],
  },
];

export default function AncestryClient() {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [state, setState] = useState("");
  const [built, setBuilt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — stays empty for humans
  const [subState, setSubState] = useState<
    "idle" | "sending" | "done" | "error"
  >("idle");
  const [subError, setSubError] = useState("");

  const fullName = `${first.trim()} ${last.trim()}`.trim();

  const q = useMemo(
    () => ({
      f: encodeURIComponent(first.trim()),
      l: encodeURIComponent(last.trim()),
      s: encodeURIComponent(state.trim()),
      q: encodeURIComponent(fullName),
      exact: encodeURIComponent(`"${fullName}"`),
    }),
    [first, last, state, fullName]
  );

  function build() {
    if (!fullName) return;
    setBuilt(true);
    setTimeout(() => {
      document
        .getElementById("ancestry-results")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  async function copyName() {
    try {
      await navigator.clipboard.writeText(fullName);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  async function subscribe() {
    if (subState === "sending") return;
    setSubError("");
    setSubState("sending");
    try {
      const res = await fetch("/api/ancestry-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName: first.trim(),
          website, // honeypot
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setSubState("done");
      } else {
        setSubState("error");
        setSubError(data?.error || "Something went wrong — please try again.");
      }
    } catch {
      setSubState("error");
      setSubError("Network error — please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-white">
      <main className="max-w-5xl mx-auto px-4 pt-24 pb-16 space-y-10">
        {/* BACK NAVIGATION */}
        <nav className="flex flex-wrap items-center gap-2 -mt-12 mb-2">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-600/70 bg-slate-800/70 px-4 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 transition"
          >
            ← Back to Member Hub
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/70 bg-slate-900/70 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
          >
            🏠 Home
          </Link>
        </nav>

        {/* HEADER */}
        <section className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
            Free for the People
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Every record has a name.{" "}
            <span className="text-amber-300">Find yours.</span>
          </h1>
          <p className="text-sm md:text-base text-slate-300 max-w-2xl">
            Enter an ancestor&apos;s name once, then open a search on any of the
            free archives below — census rolls, Freedmen&apos;s Bureau papers,
            newspapers, cemeteries, and military records. No paywalls. These are
            real government, library, and nonprofit databases.
          </p>
        </section>

        {/* SEARCH FORM */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 md:p-6 shadow-lg">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <div>
              <label
                htmlFor="anc-first"
                className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5"
              >
                First name
              </label>
              <input
                id="anc-first"
                type="text"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && build()}
                placeholder="e.g. Sarah"
                autoComplete="off"
                className="w-full rounded-lg border border-slate-700 bg-black/60 px-3 py-2.5 text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
            <div>
              <label
                htmlFor="anc-last"
                className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5"
              >
                Last name
              </label>
              <input
                id="anc-last"
                type="text"
                value={last}
                onChange={(e) => setLast(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && build()}
                placeholder="e.g. Johnson"
                autoComplete="off"
                className="w-full rounded-lg border border-slate-700 bg-black/60 px-3 py-2.5 text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
            <div>
              <label
                htmlFor="anc-state"
                className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5"
              >
                State (optional)
              </label>
              <input
                id="anc-state"
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && build()}
                placeholder="e.g. Louisiana"
                autoComplete="off"
                className="w-full rounded-lg border border-slate-700 bg-black/60 px-3 py-2.5 text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
            <button
              onClick={build}
              disabled={!fullName}
              className="rounded-full border border-amber-500/70 bg-amber-500/90 px-5 py-2.5 text-sm font-semibold text-black shadow transition hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Build my searches
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Tip: older records often have spelling variations — try initials,
            nicknames, and phonetic spellings too.
          </p>
        </section>

        {/* EMAIL CAPTURE */}
        <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-950 to-black p-5 md:p-6 shadow-lg">
          {subState === "done" ? (
            <div className="space-y-1">
              <p className="text-lg font-bold text-amber-200">
                You&apos;re on the list. ✊🏾
              </p>
              <p className="text-sm text-slate-300">
                Watch your inbox for research tips and new free tools from
                Black Truth TV — and check out the free channels while
                you&apos;re here.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/90">
                Keep digging with us
              </p>
              <h2 className="text-xl md:text-2xl font-extrabold tracking-tight mt-1">
                Get family research tips + new free tools
              </h2>
              <p className="text-sm text-slate-300 mt-1.5 max-w-2xl">
                Join the Black Truth TV list — research techniques, new record
                collections as we add them, and invites to live events.
              </p>
              <div className="mt-4 flex flex-col sm:flex-row gap-2 max-w-lg">
                {/* Honeypot — hidden from real users */}
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                  placeholder="Website"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && subscribe()}
                  placeholder="Your email address"
                  autoComplete="email"
                  className="flex-1 rounded-lg border border-slate-700 bg-black/60 px-3 py-2.5 text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <button
                  onClick={subscribe}
                  disabled={subState === "sending" || !email.trim()}
                  className="rounded-full border border-amber-500/70 bg-amber-500/90 px-5 py-2.5 text-sm font-semibold text-black shadow transition hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {subState === "sending" ? "Joining…" : "Join free"}
                </button>
              </div>
              {subState === "error" && (
                <p className="text-xs text-red-400 mt-2">{subError}</p>
              )}
              <p className="text-[11px] text-slate-500 mt-2">
                Free to join. No spam — unsubscribe anytime.
              </p>
            </>
          )}
        </section>

        {/* RESULTS */}
        {built && (
          <div id="ancestry-results" className="space-y-10">
            {SECTIONS.map((section) => (
              <section key={section.title} className="space-y-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold whitespace-nowrap">
                    {section.title}
                  </h2>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>
                {section.note && (
                  <p className="text-sm text-slate-400 max-w-3xl">
                    {section.note}
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {section.cards.map((card) => (
                    <a
                      key={card.site}
                      href={card.url ? card.url(q) : card.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block rounded-2xl border border-slate-800 border-l-2 border-l-amber-600/60 bg-slate-900/70 p-4 shadow transition hover:border-amber-400/80 hover:border-l-amber-400"
                    >
                      <p className="font-semibold text-white group-hover:text-amber-200 transition">
                        {card.site}
                      </p>
                      <p className="text-sm text-slate-400 mt-0.5">
                        {card.what}
                      </p>
                      <span className="mt-2.5 inline-block rounded border border-amber-500/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                        {card.tag ?? "Free"}
                      </span>
                    </a>
                  ))}
                </div>
                {section.copyButton && (
                  <button
                    onClick={copyName}
                    className="rounded-full border border-slate-700 bg-slate-800/70 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-amber-400 hover:text-amber-200"
                  >
                    {copied
                      ? `Copied: ${fullName}`
                      : "Copy name to paste into these portals"}
                  </button>
                )}
              </section>
            ))}
          </div>
        )}

        {/* FOOTER */}
        <footer className="border-t border-slate-800 pt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500">
          <p>
            Presented free by{" "}
            <span className="text-amber-300 font-semibold">Black Truth TV</span>{" "}
            · Powered by SF Johnson Consulting · Build. Learn. Preserve.
          </p>
          <a
            href="/request-access"
            className="inline-flex w-max items-center rounded-full border border-amber-500/50 px-4 py-1.5 font-semibold text-amber-300 transition hover:bg-amber-500/10"
          >
            Watch free on Black Truth TV →
          </a>
        </footer>
      </main>
    </div>
  );
}
