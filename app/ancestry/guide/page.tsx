// app/ancestry/guide/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to Use the Family Vault | Black Truth TV",
  description:
    "A step-by-step guide to searching free archives and saving your family history in the Black Truth TV Family Vault.",
};

const STEPS: { title: string; emoji: string; body: string[] }[] = [
  {
    emoji: "1️⃣",
    title: "Start with what you know",
    body: [
      "Before you search anything, write down what your family already knows. Full names (including maiden names), roughly when people were born, and where they lived. Ask the oldest people in your family — they are your best record.",
      "Don't worry about being exact. \u201cGrandma Sarah, born around 1930, somewhere in Louisiana\u201d is enough to start.",
    ],
  },
  {
    emoji: "2️⃣",
    title: "Search the free archives",
    body: [
      "On the Ancestry page, stay on the \u201c🔍 Search Free Archives\u201d tab. Type in an ancestor's first name, last name, and state if you know it. Then press \u201cBuild my searches.\u201d",
      "A list of archive cards appears — census records, Freedmen's Bureau papers, newspapers, cemetery records, military records, and more. Click any card and it opens that archive in a new tab with your ancestor's name already filled in.",
      "These are real, free government and library archives. You never have to pay to search them.",
    ],
  },
  {
    emoji: "3️⃣",
    title: "Save people to your Family Vault",
    body: [
      "Click the \u201c🌳 My Family Vault\u201d tab. If you're not signed in, sign in first (or request free access — it takes a minute).",
      "Click \u201c＋ Add a person.\u201d Enter their name, how they're related to you, their birth and death years if you know them, where they lived, and any family stories you remember. Then click \u201cSave to my vault.\u201d",
      "Start with a grandparent and work backwards, one generation at a time. That's how the professionals do it.",
    ],
  },
  {
    emoji: "4️⃣",
    title: "Save the records you find",
    body: [
      "Found something in an archive? Two ways to save it:",
      "Quick way: on any archive card in the search tab, click \u201c＋ Save to Vault.\u201d Pick which person the record is about, and it's saved with the link.",
      "Detailed way: in your vault, click a person's name to open them, then use \u201cLog a finding.\u201d Give the record a name (like \u201c1920 Census — Monroe, LA\u201d), where you found it, paste the link, and add notes about what it shows.",
    ],
  },
  {
    emoji: "5️⃣",
    title: "Attach photos and documents",
    body: [
      "When logging a finding, you can attach a file — a photo of a headstone, a scanned obituary, a screenshot of a census page, or a family photo. Click \u201cChoose file,\u201d pick it from your phone or computer, and save.",
      "Files can be up to 10 MB each. Photos, PDFs, and Word documents all work.",
      "Your files are private. Only you can see your vault.",
    ],
  },
  {
    emoji: "6️⃣",
    title: "Print your family record",
    body: [
      "Once you've saved a few people, click \u201c🖨️ Print family record\u201d at the top of your vault. It creates a clean, printable version of everything — every person, every record, every note.",
      "Tip: in the print window, choose \u201cSave as PDF\u201d to keep a digital copy or share it with family. Print copies make beautiful gifts at reunions.",
    ],
  },
];

const TIPS: string[] = [
  "Spelling was loose in old records. Try \u201cSara,\u201d \u201cSarah,\u201d and \u201cSarrah.\u201d Try initials. Census takers wrote what they heard.",
  "The 1870 census is the first to list most Black Americans by full name. To reach further back, use the Freedmen's Bureau records (1865–1872) — labor contracts, marriage registers, and bank records that name formerly enslaved people.",
  "Women often appear under maiden names in early records and married names later. Search both.",
  "Save everything, even \u201cmaybes.\u201d A record that doesn't make sense today may be the missing piece next month. Use the notes field to write why you think it matters.",
  "Talk to your elders THIS WEEK. Records can wait — memories can't. Save their stories in the notes field of each person.",
];

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-white">
      <main className="max-w-3xl mx-auto px-4 pt-24 pb-16 space-y-10">
        {/* NAV */}
        <nav className="flex flex-wrap items-center gap-2 -mt-12 mb-2">
          <Link
            href="/ancestry"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-600/70 bg-slate-800/70 px-4 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 transition"
          >
            ← Back to Ancestry Search
          </Link>
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/70 bg-slate-900/70 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
          >
            Member Hub
          </Link>
        </nav>

        {/* HEADER */}
        <section className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
            Step-by-Step Guide
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            How to find your people —{" "}
            <span className="text-amber-300">and keep them forever.</span>
          </h1>
          <p className="text-sm md:text-base text-slate-300">
            Never done family research before? Perfect — this guide assumes
            nothing. Six steps, no experience needed, no credit card, ever.
          </p>
        </section>

        {/* STEPS */}
        <section className="space-y-4">
          {STEPS.map((step) => (
            <div
              key={step.title}
              className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 shadow"
            >
              <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                <span className="text-xl">{step.emoji}</span>
                {step.title}
              </h2>
              <div className="mt-2.5 space-y-2.5">
                {step.body.map((para, i) => (
                  <p
                    key={i}
                    className="text-sm text-slate-300 leading-relaxed"
                  >
                    {para}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* RESEARCH TIPS */}
        <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-950 to-black p-5 md:p-6">
          <h2 className="text-lg font-bold text-amber-200">
            ✊🏾 Tips for Black family research
          </h2>
          <ul className="mt-3 space-y-2.5">
            {TIPS.map((tip, i) => (
              <li
                key={i}
                className="text-sm text-slate-300 leading-relaxed flex gap-2.5"
              >
                <span className="text-amber-400 shrink-0">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ALPHA FEEDBACK */}
        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 md:p-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/90">
            You&apos;re an early tester 🧪
          </p>
          <h2 className="text-lg font-bold text-white">
            Found a problem? Have an idea? Tell us.
          </h2>
          <p className="text-sm text-slate-300">
            The Family Vault is brand new and you&apos;re one of the first
            people using it. If something doesn&apos;t work, confuses you, or
            you wish it did something it doesn&apos;t — that&apos;s exactly
            what we need to hear. No detail is too small.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href="mailto:info@sfjohnsonconsulting.com?subject=Family%20Vault%20Feedback"
              className="inline-flex items-center rounded-full border border-amber-500/70 bg-amber-500/90 px-5 py-2.5 text-sm font-bold text-black hover:bg-amber-400 transition"
            >
              ✉️ Email your feedback
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center rounded-full border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition"
            >
              Contact page
            </Link>
          </div>
        </section>

        {/* START CTA */}
        <section className="text-center py-4">
          <Link
            href="/ancestry"
            className="inline-flex items-center rounded-full border border-amber-500/70 bg-amber-500/90 px-8 py-3 text-base font-bold text-black hover:bg-amber-400 transition"
          >
            🌳 Start your Family Vault →
          </Link>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-slate-800 pt-5 text-xs text-slate-500 text-center">
          Presented free by{" "}
          <span className="text-amber-300 font-semibold">Black Truth TV</span> ·
          Powered by SF Johnson Consulting · Build. Learn. Preserve.
        </footer>
      </main>
    </div>
  );
}
