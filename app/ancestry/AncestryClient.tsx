"use client";

import { useMemo, useState } from "react";

type Card = {
  site: string;
  what: string;
  tag?: string;
  url?: (q: {
    f: string;
    l: string;
    s: string;
    q: string;
    exact: string;
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
    note: "FamilySearch is run by a nonprofit and is 100% free - the largest free genealogy database in the world. A free account unlocks record images.",
    cards: [
      {
        site: "FamilySearch - Historical Records",
        what: "Billions of birth, death, marriage, and census records",
        url: ({ f, l, s }) =>
          "https://www.familysearch.org/search/record/results?q.givenName=" +
          f +
          "&q.surname=" +
          l +
          (s ? "&q.anyPlace=" + s : ""),
      },
      {
        site: "FamilySearch - Full-Text Search",
        what: "AI search of handwritten deeds, wills & probate files",
        url: ({ exact }) =>
          "https://www.familysearch.org/en/search/full-text/results?q.text=" +
          exact,
      },
    ],
  },
  {
    title: "Census records",
    cards: [
      {
        site: "1950 U.S. Census - National Archives",
        what: "Official name-searchable census images, no account needed",
        url: ({ q }) => "https://1950census.archives.gov/search/?name=" + q,
      },
      {
        site: "National Archives Catalog",
        what: "Federal records: land, pensions, courts, and more",
        url: ({ q }) => "https://catalog.archives.gov/search?q=" + q,
      },
    ],
  },
  {
    title: "Freedmen's Bureau & Reconstruction era",
    note: "For Black family research, these records (1865-1872) are often the bridge across the 1870 'brick wall' - labor contracts, marriage registers, bank records, and ration rolls that name formerly enslaved people. Use the copy button, then paste the name into these portals.",
    copyButton: true,
    cards: [
      {
        site: "Freedmen's Bureau Portal - Smithsonian NMAAHC",
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
        site: "Chronicling America - Library of Congress",
        what: "Full-text search of U.S. newspapers, 1756-1963",
        url: ({ q, s }) =>
          "https://chroniclingamerica.loc.gov/search/pages/results/?andtext=" +
          q +
          (s ? "&state=" + s : ""),
      },
      {
        site: "Library of Congress Collections",
        what: "Photos, maps, manuscripts, and oral histories",
        url: ({ q }) => "https://www.loc.gov/search/?q=" + q,
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
          "https://www.findagrave.com/memorial/search?firstname=" +
          f +
          "&lastname=" +
          l,
      },
      {
        site: "BillionGraves",
        what: "GPS-mapped headstone photos worldwide",
        tag: "Free / account for some features",
        url: ({ f, l }) =>
          "https://billiongraves.com/search/results?given_names=" +
          f +
          "&family_names=" +
          l,
      },
    ],
  },
  {
    title: "Military service",
    cards: [
      {
        site: "Civil War Soldiers & Sailors - National Park Service",
        what: "6.3M service records, incl. U.S. Colored Troops",
        href: "https://www.nps.gov/civilwar/search-soldiers.htm",
      },
      {
        site: "National Archives - Veterans' Records",
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
        url: ({ exact }) => "https://archive.org/search?query=" + exact,
      },
      {
        site: "Digital Public Library of America",
        what: "50M+ items from libraries & museums nationwide",
        url: ({ exact }) => "https://dp.la/search?q=" + exact,
      },
      {
        site: "AccessGenealogy",
        what: "Free records incl. major Native American collections",
        url: ({ q }) => "https://accessgenealogy.com/?s=" + q,
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
  const [website, setWebsite] = useState("");
  const [subState, setSubState] = useState("idle");
  const [subError, setSubError] = useState("");

  const fullName = (first.trim() + " " + last.trim()).trim();

  const q = useMemo(
    () => ({
      f: encodeURIComponent(first.trim()),
      l: encodeURIComponent(last.trim()),
      s: encodeURIComponent(state.trim()),
      q: encodeURIComponent(fullName),
      exact: encodeURIComponent('"' + fullName + '"'),
    }),
    [first, last, state, fullName]
  );

  function build() {
    if (!fullName) return;
    setBuilt(true);
    setTimeout(() => {
      const el = document.getElementById("ancestry-results");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  async function copyName() {
    try {
      await navigator.clipboard.writeText(fullName);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
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
          email: email,
          firstName: first.trim(),
          website: website,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data && data.ok) {
        setSubState("done");
      } else {
        setSubState("error");
        setSubError(
          (data && data.error) || "Something went wrong - please try again."
        );
      }
    } catch {
      setSubState("error");
      setSubError("Network error - please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-white">
      <main className="max-w-5xl mx-auto px-4 pt-24 pb-16 space-y-10">
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
            free archives below - census rolls, Freedmen&apos;s Bureau papers,
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") build();
                }}
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") build();
                }}
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") build();
                }}
                placeholder="e.g. Louisiana"
                autoComplete="off"
                className="w-full rounded-lg border border-slate-700 bg-black/60 px-3 py-2.5 text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
            <button
              onClick={build}
              disabled={!fullName}
