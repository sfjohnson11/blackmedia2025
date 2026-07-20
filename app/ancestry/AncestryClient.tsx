"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

/* ============================================================
   BLACK TRUTH TV — FREE ANCESTRY SEARCH + FAMILY VAULT (ALPHA)
   Tab 1: Search Free Archives (public, no account needed)
   Tab 2: My Family Vault — save people, records, photos & docs
   Extras: save-to-vault from search cards, printable family
   record, link to the How-To guide at /ancestry/guide
   ============================================================ */

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

type VaultPerson = {
  id: string;
  full_name: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  suffix: string | null;
  relationship: string | null;
  birth_year: string | null;
  death_year: string | null;
  birth_place: string | null;
  notes: string | null;
  created_at: string;
};

type VaultRecord = {
  id: string;
  person_id: string;
  title: string;
  source_name: string | null;
  record_url: string | null;
  notes: string | null;
  file_path: string | null;
  created_at: string;
};

type PendingSave = {
  title: string;
  source: string;
  url: string;
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

const RELATIONSHIPS = [
  "",
  "Mother",
  "Father",
  "Grandmother",
  "Grandfather",
  "Great-grandmother",
  "Great-grandfather",
  "2x Great-grandmother",
  "2x Great-grandfather",
  "Aunt",
  "Uncle",
  "Sister",
  "Brother",
  "Cousin",
  "Other",
];

const SUFFIXES = ["", "Jr.", "Sr.", "II", "III", "IV", "V"];

const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "heic"];

function isImagePath(path: string | null): boolean {
  if (!path) return false;
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTS.includes(ext);
}

export default function AncestryClient() {
  const supabase = createClient();

  /* ---------- tab state ---------- */
  const [tab, setTab] = useState<"search" | "vault">("search");

  /* ---------- search tab state ---------- */
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

  /* ---------- vault state ---------- */
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [people, setPeople] = useState<VaultPerson[]>([]);
  const [records, setRecords] = useState<VaultRecord[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultError, setVaultError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingPerson, setSavingPerson] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);

  // add-person form
  const [pFirst, setPFirst] = useState("");
  const [pMiddle, setPMiddle] = useState("");
  const [pLast, setPLast] = useState("");
  const [pSuffix, setPSuffix] = useState("");
  const [pRel, setPRel] = useState("");
  const [pBirth, setPBirth] = useState("");
  const [pDeath, setPDeath] = useState("");
  const [pPlace, setPPlace] = useState("");
  const [pNotes, setPNotes] = useState("");
  const [showAddPerson, setShowAddPerson] = useState(false);

  // add-record form (attached to expanded person)
  const [rTitle, setRTitle] = useState("");
  const [rSource, setRSource] = useState("");
  const [rUrl, setRUrl] = useState("");
  const [rNotes, setRNotes] = useState("");
  const [rFile, setRFile] = useState<File | null>(null);

  // "save from search" flow
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  const [pendingPersonId, setPendingPersonId] = useState("");
  const [savingPending, setSavingPending] = useState(false);

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

  /* ---------- auth + vault loading ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled) {
          setUserId(user?.id ?? null);
          setAuthChecked(true);
        }
      } catch {
        if (!cancelled) {
          setUserId(null);
          setAuthChecked(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setVaultLoading(true);
      setVaultError("");
      try {
        const [peopleRes, recordsRes] = await Promise.all([
          supabase
            .from("ancestry_people")
            .select(
              "id, full_name, first_name, middle_name, last_name, suffix, relationship, birth_year, death_year, birth_place, notes, created_at"
            )
            .order("created_at", { ascending: true }),
          supabase
            .from("ancestry_records")
            .select(
              "id, person_id, title, source_name, record_url, notes, file_path, created_at"
            )
            .order("created_at", { ascending: true }),
        ]);
        if (cancelled) return;
        if (peopleRes.error) {
          setVaultError(
            "Couldn't load your vault — the tables may not be set up yet."
          );
          console.error("Vault people error:", peopleRes.error);
        } else {
          setPeople((peopleRes.data as VaultPerson[]) ?? []);
        }
        if (!recordsRes.error) {
          setRecords((recordsRes.data as VaultRecord[]) ?? []);
        }
      } finally {
        if (!cancelled) setVaultLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, supabase]);

  /* ---------- search tab actions ---------- */
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

  function startSaveFromSearch(card: Card) {
    const link = card.url ? card.url(q) : card.href ?? "";
    setPendingSave({
      title: fullName ? `${fullName} — ${card.site}` : card.site,
      source: card.site,
      url: link,
    });
    setPendingPersonId(people[0]?.id ?? "");
    setTab("vault");
    setTimeout(() => {
      document
        .getElementById("vault-top")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  /* ---------- vault actions ---------- */
  const composedName = useMemo(() => {
    const base = [pFirst.trim(), pMiddle.trim(), pLast.trim()]
      .filter(Boolean)
      .join(" ");
    return pSuffix ? `${base} ${pSuffix}`.trim() : base;
  }, [pFirst, pMiddle, pLast, pSuffix]);

  async function addPerson() {
    if (!userId || !composedName || savingPerson) return;
    setSavingPerson(true);
    setVaultError("");
    try {
      const { data, error } = await supabase
        .from("ancestry_people")
        .insert({
          user_id: userId,
          full_name: composedName,
          first_name: pFirst.trim() || null,
          middle_name: pMiddle.trim() || null,
          last_name: pLast.trim() || null,
          suffix: pSuffix || null,
          relationship: pRel || null,
          birth_year: pBirth.trim() || null,
          death_year: pDeath.trim() || null,
          birth_place: pPlace.trim() || null,
          notes: pNotes.trim() || null,
        })
        .select()
        .single();
      if (error) {
        console.error("Add person error:", error);
        setVaultError("Couldn't save — please try again.");
        return;
      }
      const created = data as VaultPerson;
      setPeople((prev) => [...prev, created]);
      setPFirst("");
      setPMiddle("");
      setPLast("");
      setPSuffix("");
      setPRel("");
      setPBirth("");
      setPDeath("");
      setPPlace("");
      setPNotes("");
      setShowAddPerson(false);
      setExpandedId(created.id);
      if (pendingSave && !pendingPersonId) setPendingPersonId(created.id);
    } finally {
      setSavingPerson(false);
    }
  }

  async function deletePerson(id: string) {
    if (!userId) return;
    const person = people.find((p) => p.id === id);
    const ok = window.confirm(
      `Remove ${person?.full_name ?? "this person"} and all their saved records from your vault?`
    );
    if (!ok) return;

    // best-effort: remove any attached files from storage first
    const paths = records
      .filter((r) => r.person_id === id && r.file_path)
      .map((r) => r.file_path as string);
    if (paths.length > 0) {
      await supabase.storage.from("vault").remove(paths);
    }

    const { error } = await supabase
      .from("ancestry_people")
      .delete()
      .eq("id", id);
    if (error) {
      console.error("Delete person error:", error);
      setVaultError("Couldn't delete — please try again.");
      return;
    }
    setPeople((prev) => prev.filter((p) => p.id !== id));
    setRecords((prev) => prev.filter((r) => r.person_id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  async function uploadFileIfAny(): Promise<string | null | "error"> {
    if (!rFile || !userId) return null;
    const safeName = rFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage
      .from("vault")
      .upload(path, rFile, { upsert: false });
    if (error) {
      console.error("Upload error:", error);
      setVaultError(
        "The file couldn't be uploaded (10 MB max). The record was not saved — try again or save without the file."
      );
      return "error";
    }
    return path;
  }

  async function addRecord(personId: string) {
    if (!userId || !rTitle.trim() || savingRecord) return;
    setSavingRecord(true);
    setVaultError("");
    try {
      const filePath = await uploadFileIfAny();
      if (filePath === "error") return;

      const { data, error } = await supabase
        .from("ancestry_records")
        .insert({
          user_id: userId,
          person_id: personId,
          title: rTitle.trim(),
          source_name: rSource.trim() || null,
          record_url: rUrl.trim() || null,
          notes: rNotes.trim() || null,
          file_path: filePath,
        })
        .select()
        .single();
      if (error) {
        console.error("Add record error:", error);
        setVaultError("Couldn't save the record — please try again.");
        return;
      }
      setRecords((prev) => [...prev, data as VaultRecord]);
      setRTitle("");
      setRSource("");
      setRUrl("");
      setRNotes("");
      setRFile(null);
    } finally {
      setSavingRecord(false);
    }
  }

  async function savePendingRecord() {
    if (!userId || !pendingSave || !pendingPersonId || savingPending) return;
    setSavingPending(true);
    setVaultError("");
    try {
      const { data, error } = await supabase
        .from("ancestry_records")
        .insert({
          user_id: userId,
          person_id: pendingPersonId,
          title: pendingSave.title,
          source_name: pendingSave.source,
          record_url: pendingSave.url || null,
          notes: null,
          file_path: null,
        })
        .select()
        .single();
      if (error) {
        console.error("Pending save error:", error);
        setVaultError("Couldn't save the finding — please try again.");
        return;
      }
      setRecords((prev) => [...prev, data as VaultRecord]);
      setExpandedId(pendingPersonId);
      setPendingSave(null);
      setPendingPersonId("");
    } finally {
      setSavingPending(false);
    }
  }

  async function deleteRecord(rec: VaultRecord) {
    if (rec.file_path) {
      await supabase.storage.from("vault").remove([rec.file_path]);
    }
    const { error } = await supabase
      .from("ancestry_records")
      .delete()
      .eq("id", rec.id);
    if (error) {
      console.error("Delete record error:", error);
      setVaultError("Couldn't delete the record — please try again.");
      return;
    }
    setRecords((prev) => prev.filter((r) => r.id !== rec.id));
  }

  async function openAttachment(path: string) {
    const { data, error } = await supabase.storage
      .from("vault")
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      console.error("Signed URL error:", error);
      setVaultError("Couldn't open the file — please try again.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function printVault() {
    window.print();
  }

  /* ---------- GEDCOM 5.5.1 export ----------
     Produces a standard .ged file that imports into Ancestry,
     FamilySearch, MyHeritage, Gramps, and every other major
     genealogy tool. Your research is never trapped here. */
  function gedcomEscape(text: string): string[] {
    // Split multi-line text into GEDCOM continuation lines
    return text.replace(/\r/g, "").split("\n");
  }

  function gedcomNote(level: number, text: string | null): string[] {
    if (!text || !text.trim()) return [];
    const lines = gedcomEscape(text.trim());
    const out: string[] = [];
    lines.forEach((line, i) => {
      // GEDCOM lines should stay under ~250 chars; chunk long lines with CONC
      const chunks = line.match(/.{1,200}/g) ?? [""];
      chunks.forEach((chunk, j) => {
        if (i === 0 && j === 0) out.push(`${level} NOTE ${chunk}`);
        else if (j === 0) out.push(`${level + 1} CONT ${chunk}`);
        else out.push(`${level + 1} CONC ${chunk}`);
      });
    });
    return out;
  }

  function exportGedcom() {
    const today = new Date();
    const months = [
      "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
      "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
    ];
    const dateStr = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;

    const lines: string[] = [
      "0 HEAD",
      "1 SOUR BLACKTRUTHTV",
      "2 NAME Black Truth TV Family Vault",
      "2 CORP SF Johnson Consulting",
      "1 DEST ANY",
      `1 DATE ${dateStr}`,
      "1 GEDC",
      "2 VERS 5.5.1",
      "2 FORM LINEAGE-LINKED",
      "1 CHAR UTF-8",
      "1 SUBM @SUB1@",
      "0 @SUB1@ SUBM",
      "1 NAME Black Truth TV Member",
    ];

    // Source records (one per saved record)
    const sourceIdFor = new Map<string, string>();
    records.forEach((rec, idx) => {
      sourceIdFor.set(rec.id, `@S${idx + 1}@`);
    });

    // Individuals
    people.forEach((person, idx) => {
      const id = `@I${idx + 1}@`;
      const given = [person.first_name, person.middle_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      const surname = (person.last_name ?? "").trim();
      // Fall back to splitting full_name if structured parts are missing
      const fallbackParts = person.full_name.split(" ");
      const g = given || fallbackParts.slice(0, -1).join(" ") || person.full_name;
      const s = surname || (fallbackParts.length > 1 ? fallbackParts[fallbackParts.length - 1] : "");

      lines.push(`0 ${id} INDI`);
      lines.push(`1 NAME ${g} /${s}/${person.suffix ? ` ${person.suffix}` : ""}`);
      if (g) lines.push(`2 GIVN ${g}`);
      if (s) lines.push(`2 SURN ${s}`);
      if (person.suffix) lines.push(`2 NSFX ${person.suffix}`);

      if (person.birth_year || person.birth_place) {
        lines.push("1 BIRT");
        if (person.birth_year) lines.push(`2 DATE ${person.birth_year}`);
        if (person.birth_place) lines.push(`2 PLAC ${person.birth_place}`);
      }
      if (person.death_year) {
        lines.push("1 DEAT");
        lines.push(`2 DATE ${person.death_year}`);
      }
      if (person.relationship) {
        lines.push(...gedcomNote(1, `Relationship to submitter: ${person.relationship}`));
      }
      lines.push(...gedcomNote(1, person.notes));

      // Cite this person's records as sources
      recordsFor(person.id).forEach((rec) => {
        const sid = sourceIdFor.get(rec.id);
        if (!sid) return;
        lines.push(`1 SOUR ${sid}`);
        if (rec.record_url) lines.push(`2 PAGE ${rec.record_url}`);
        lines.push(...gedcomNote(2, rec.notes));
      });
    });

    // Source definitions
    records.forEach((rec) => {
      const sid = sourceIdFor.get(rec.id);
      if (!sid) return;
      lines.push(`0 ${sid} SOUR`);
      lines.push(`1 TITL ${rec.title}`);
      if (rec.source_name) lines.push(`1 AGNC ${rec.source_name}`);
    });

    lines.push("0 TRLR");

    const blob = new Blob([lines.join("\r\n")], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `family-vault-${today.toISOString().slice(0, 10)}.ged`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function searchForPerson(person: VaultPerson) {
    const fn =
      person.first_name?.trim() ||
      person.full_name.split(" ")[0] ||
      "";
    const ln =
      person.last_name?.trim() ||
      person.full_name.split(" ").slice(-1)[0] ||
      "";
    setFirst(fn);
    setLast(ln);
    if (person.birth_place) {
      // use the last word(s) as a state hint only if it looks like one word/two
      setState("");
    }
    setBuilt(true);
    setTab("search");
    setTimeout(() => {
      document
        .getElementById("ancestry-results")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  const recordsFor = (personId: string) =>
    records.filter((r) => r.person_id === personId);

  const inputCls =
    "w-full rounded-lg border border-slate-700 bg-black/60 px-3 py-2.5 text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400";
  const labelCls =
    "block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5";

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-white">
      {/* Print styles: hide the app, show only the printable family record */}
      <style>{`
        #vault-print { display: none; }
        @media print {
          body { background: #fff !important; }
          #vault-app { display: none !important; }
          #vault-print {
            display: block !important;
            color: #111 !important;
            font-family: Georgia, 'Times New Roman', serif;
            padding: 24px;
          }
          #vault-print h1 { font-size: 22px; margin: 0 0 4px; }
          #vault-print h2 { font-size: 16px; margin: 18px 0 4px; border-bottom: 1px solid #999; padding-bottom: 2px; }
          #vault-print p, #vault-print li { font-size: 12px; margin: 2px 0; }
          #vault-print .sub { color: #555; }
        }
      `}</style>

      {/* ============ PRINTABLE FAMILY RECORD (print only) ============ */}
      <div id="vault-print">
        <h1>Family Record</h1>
        <p className="sub">
          Preserved in the Black Truth TV Family Vault · blacktruthtv.org ·
          Printed {new Date().toLocaleDateString()}
        </p>
        {people.map((person) => {
          const personRecords = recordsFor(person.id);
          return (
            <div key={person.id}>
              <h2>
                {person.full_name}
                {person.relationship ? ` — ${person.relationship}` : ""}
              </h2>
              <p className="sub">
                {[
                  person.birth_year && `Born ${person.birth_year}`,
                  person.death_year && `Died ${person.death_year}`,
                  person.birth_place,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {person.notes && <p>{person.notes}</p>}
              {personRecords.length > 0 && (
                <ul>
                  {personRecords.map((rec) => (
                    <li key={rec.id}>
                      <strong>{rec.title}</strong>
                      {rec.source_name ? ` (${rec.source_name})` : ""}
                      {rec.notes ? ` — ${rec.notes}` : ""}
                      {rec.record_url ? ` [${rec.record_url}]` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* ============ THE APP (hidden when printing) ============ */}
      <main id="vault-app" className="max-w-5xl mx-auto px-4 pt-24 pb-16 space-y-10">
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
          <Link
            href="/ancestry/guide"
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 transition"
          >
            ❓ How it works
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
            Search real, free archives — census rolls, Freedmen&apos;s Bureau
            papers, newspapers, cemeteries, and military records. Then save what
            you find to your own Family Vault: people, records, photos, and
            documents, stored safely in your Black Truth TV account.
          </p>
        </section>

        {/* TABS */}
        <div className="flex flex-wrap gap-2" id="vault-top">
          <button
            onClick={() => setTab("search")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition border ${
              tab === "search"
                ? "border-amber-500/70 bg-amber-500/90 text-black"
                : "border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800"
            }`}
          >
            🔍 Search Free Archives
          </button>
          <button
            onClick={() => setTab("vault")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition border ${
              tab === "vault"
                ? "border-amber-500/70 bg-amber-500/90 text-black"
                : "border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800"
            }`}
          >
            🌳 My Family Vault
            {people.length > 0 && (
              <span className="ml-2 rounded-full bg-black/30 px-2 py-0.5 text-[10px]">
                {people.length}
              </span>
            )}
          </button>
        </div>

        {/* ===================== SEARCH TAB ===================== */}
        {tab === "search" && (
          <>
            {/* SEARCH FORM */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 md:p-6 shadow-lg">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
                <div>
                  <label htmlFor="anc-first" className={labelCls}>
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
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="anc-last" className={labelCls}>
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
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="anc-state" className={labelCls}>
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
                    className={inputCls}
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
                Tip: older records often have spelling variations — try
                initials, nicknames, and phonetic spellings too. When you find
                something, hit{" "}
                <span className="text-amber-300 font-semibold">
                  ＋ Save to Vault
                </span>{" "}
                on any archive card so it&apos;s never lost.
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
                    Join the Black Truth TV list — research techniques, new
                    record collections as we add them, and invites to live
                    events.
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
                      className={`flex-1 ${inputCls}`}
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
                        <div
                          key={card.site}
                          className="group rounded-2xl border border-slate-800 border-l-2 border-l-amber-600/60 bg-slate-900/70 p-4 shadow transition hover:border-amber-400/80 hover:border-l-amber-400"
                        >
                          <a
                            href={card.url ? card.url(q) : card.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <p className="font-semibold text-white group-hover:text-amber-200 transition">
                              {card.site}
                            </p>
                            <p className="text-sm text-slate-400 mt-0.5">
                              {card.what}
                            </p>
                          </a>
                          <div className="mt-2.5 flex items-center justify-between gap-2">
                            <span className="inline-block rounded border border-amber-500/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                              {card.tag ?? "Free"}
                            </span>
                            <button
                              onClick={() => startSaveFromSearch(card)}
                              className="rounded-full border border-slate-700 bg-black/40 px-3 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-amber-400 hover:text-amber-200"
                              title="Save this finding to your Family Vault"
                            >
                              ＋ Save to Vault
                            </button>
                          </div>
                        </div>
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
          </>
        )}

        {/* ===================== VAULT TAB ===================== */}
        {tab === "vault" && (
          <div className="space-y-6">
            {/* Not signed in */}
            {authChecked && !userId && (
              <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-950 to-black p-6 md:p-8 text-center space-y-4">
                <h2 className="text-2xl font-extrabold tracking-tight">
                  Your family&apos;s story deserves a safe home.
                </h2>
                <p className="text-sm text-slate-300 max-w-xl mx-auto">
                  The Family Vault lets you save every ancestor and every record
                  you find — census pages, Freedmen&apos;s Bureau papers,
                  obituaries, photos of headstones — organized by person, stored
                  in your Black Truth TV account, private to you.
                </p>
                {pendingSave && (
                  <p className="text-xs text-amber-300">
                    Your finding &ldquo;{pendingSave.title}&rdquo; is waiting —
                    sign in and it&apos;ll be ready to save.
                  </p>
                )}
                <div className="flex flex-wrap justify-center gap-3 pt-1">
                  <Link
                    href="/login?redirect=/ancestry"
                    className="inline-flex items-center rounded-full border border-amber-500/70 bg-amber-500/90 px-5 py-2.5 text-sm font-bold text-black hover:bg-amber-400 transition"
                  >
                    Sign in to open your vault
                  </Link>
                  <Link
                    href="/request-access"
                    className="inline-flex items-center rounded-full border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition"
                  >
                    New here? Request free access
                  </Link>
                </div>
              </section>
            )}

            {/* Signed in */}
            {authChecked && userId && (
              <>
                {vaultError && (
                  <div className="rounded-lg border border-red-400/50 bg-red-950/40 px-4 py-3 text-sm text-red-100">
                    {vaultError}
                  </div>
                )}

                {/* Pending save from search */}
                {pendingSave && (
                  <section className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4 md:p-5 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                      Finish saving your finding
                    </p>
                    <p className="text-sm text-white font-semibold">
                      {pendingSave.title}
                      <span className="ml-2 text-xs font-normal text-amber-300/80">
                        from {pendingSave.source}
                      </span>
                    </p>
                    {people.length === 0 ? (
                      <p className="text-xs text-slate-300">
                        Add your first person below — then this finding will be
                        ready to attach to them.
                      </p>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          value={pendingPersonId}
                          onChange={(e) => setPendingPersonId(e.target.value)}
                          className={`sm:max-w-xs ${inputCls}`}
                        >
                          <option value="">— Who is this record about? —</option>
                          {people.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.full_name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={savePendingRecord}
                          disabled={!pendingPersonId || savingPending}
                          className="rounded-full border border-amber-500/70 bg-amber-500/90 px-5 py-2 text-sm font-bold text-black hover:bg-amber-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {savingPending ? "Saving…" : "Save to vault"}
                        </button>
                        <button
                          onClick={() => {
                            setPendingSave(null);
                            setPendingPersonId("");
                          }}
                          className="rounded-full border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition"
                        >
                          Discard
                        </button>
                      </div>
                    )}
                  </section>
                )}

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight">
                      🌳 My Family Vault
                    </h2>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {people.length === 0
                        ? "Start your tree — add your first ancestor below."
                        : `${people.length} ${
                            people.length === 1 ? "person" : "people"
                          } · ${records.length} saved ${
                            records.length === 1 ? "record" : "records"
                          }`}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {people.length > 0 && (
                      <>
                        <button
                          onClick={printVault}
                          className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition"
                          title="Print or save your family record as PDF"
                        >
                          🖨️ Print family record
                        </button>
                        <button
                          onClick={exportGedcom}
                          className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition"
                          title="Download a GEDCOM (.ged) file — the standard format that imports into Ancestry, FamilySearch, MyHeritage, and every major genealogy tool"
                        >
                          ⬇️ Export GEDCOM
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setShowAddPerson((v) => !v)}
                      className="rounded-full border border-amber-500/70 bg-amber-500/90 px-5 py-2 text-sm font-bold text-black hover:bg-amber-400 transition"
                    >
                      {showAddPerson ? "Close" : "＋ Add a person"}
                    </button>
                  </div>
                </div>

                {/* Add person form */}
                {showAddPerson && (
                  <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 md:p-6 shadow-lg space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelCls}>First name *</label>
                        <input
                          type="text"
                          value={pFirst}
                          onChange={(e) => setPFirst(e.target.value)}
                          placeholder="e.g. Sarah"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>
                          Middle name (full, if known)
                        </label>
                        <input
                          type="text"
                          value={pMiddle}
                          onChange={(e) => setPMiddle(e.target.value)}
                          placeholder="e.g. Mae"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>
                          Last name * (maiden name if known)
                        </label>
                        <input
                          type="text"
                          value={pLast}
                          onChange={(e) => setPLast(e.target.value)}
                          placeholder="e.g. Johnson"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Suffix</label>
                        <select
                          value={pSuffix}
                          onChange={(e) => setPSuffix(e.target.value)}
                          className={inputCls}
                        >
                          {SUFFIXES.map((s) => (
                            <option key={s} value={s}>
                              {s || "— None —"}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Relationship to you</label>
                        <select
                          value={pRel}
                          onChange={(e) => setPRel(e.target.value)}
                          className={inputCls}
                        >
                          {RELATIONSHIPS.map((r) => (
                            <option key={r} value={r}>
                              {r || "— Select —"}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>
                          Birth year (approx ok)
                        </label>
                        <input
                          type="text"
                          value={pBirth}
                          onChange={(e) => setPBirth(e.target.value)}
                          placeholder="e.g. 1898 or abt 1900"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Death year</label>
                        <input
                          type="text"
                          value={pDeath}
                          onChange={(e) => setPDeath(e.target.value)}
                          placeholder="e.g. 1967"
                          className={inputCls}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelCls}>
                          Birthplace / where they lived
                        </label>
                        <input
                          type="text"
                          value={pPlace}
                          onChange={(e) => setPPlace(e.target.value)}
                          placeholder="e.g. Ouachita Parish, Louisiana"
                          className={inputCls}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelCls}>
                          Notes / family stories
                        </label>
                        <textarea
                          value={pNotes}
                          onChange={(e) => setPNotes(e.target.value)}
                          rows={3}
                          placeholder="What do you know or remember about them?"
                          className={inputCls}
                        />
                      </div>
                    </div>
                    {composedName && (
                      <p className="text-xs text-slate-400">
                        Will be saved as:{" "}
                        <span className="text-amber-300 font-semibold">
                          {composedName}
                        </span>
                      </p>
                    )}
                    <button
                      onClick={addPerson}
                      disabled={
                        !pFirst.trim() || !pLast.trim() || savingPerson
                      }
                      className="rounded-full border border-amber-500/70 bg-amber-500/90 px-6 py-2.5 text-sm font-bold text-black hover:bg-amber-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingPerson ? "Saving…" : "Save to my vault"}
                    </button>
                  </section>
                )}

                {/* People list */}
                {vaultLoading ? (
                  <p className="text-sm text-slate-400">Loading your vault…</p>
                ) : people.length === 0 && !showAddPerson ? (
                  <section className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
                    Your vault is empty. Click{" "}
                    <span className="text-amber-300 font-semibold">
                      ＋ Add a person
                    </span>{" "}
                    to begin — start with a grandparent and work backwards.
                  </section>
                ) : (
                  <div className="space-y-3">
                    {people.map((person) => {
                      const personRecords = recordsFor(person.id);
                      const isOpen = expandedId === person.id;
                      return (
                        <section
                          key={person.id}
                          className="rounded-2xl border border-slate-800 bg-slate-900/70 shadow overflow-hidden"
                        >
                          {/* Person header */}
                          <button
                            onClick={() =>
                              setExpandedId(isOpen ? null : person.id)
                            }
                            className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-800/50 transition"
                          >
                            <div>
                              <p className="font-bold text-white">
                                {person.full_name}
                                {person.relationship && (
                                  <span className="ml-2 rounded border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                                    {person.relationship}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {[
                                  person.birth_year &&
                                    `b. ${person.birth_year}`,
                                  person.death_year &&
                                    `d. ${person.death_year}`,
                                  person.birth_place,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || "No dates yet"}
                                {" · "}
                                {personRecords.length}{" "}
                                {personRecords.length === 1
                                  ? "record"
                                  : "records"}
                              </p>
                            </div>
                            <span className="text-slate-400 text-lg shrink-0">
                              {isOpen ? "▾" : "▸"}
                            </span>
                          </button>

                          {/* Expanded */}
                          {isOpen && (
                            <div className="border-t border-slate-800 p-4 space-y-4">
                              {/* Hint-style action: search the archives for this person */}
                              <button
                                onClick={() => searchForPerson(person)}
                                className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left text-sm font-semibold text-amber-200 hover:bg-amber-500/20 transition"
                              >
                                🔍 Search the free archives for{" "}
                                {person.full_name} →
                                <span className="block text-xs font-normal text-amber-300/70 mt-0.5">
                                  Opens every archive pre-filled with their
                                  name — census, Freedmen&apos;s Bureau,
                                  newspapers, cemeteries &amp; more
                                </span>
                              </button>

                              {person.notes && (
                                <p className="text-sm text-slate-300 whitespace-pre-wrap rounded-lg bg-black/30 p-3">
                                  {person.notes}
                                </p>
                              )}

                              {/* Records */}
                              {personRecords.length > 0 && (
                                <div className="space-y-2">
                                  <p className={labelCls}>Saved records</p>
                                  {personRecords.map((rec) => (
                                    <div
                                      key={rec.id}
                                      className="rounded-xl border border-slate-800 border-l-2 border-l-amber-600/60 bg-black/30 p-3 flex items-start justify-between gap-3"
                                    >
                                      <div className="min-w-0">
                                        <p className="font-semibold text-white text-sm">
                                          {rec.record_url ? (
                                            <a
                                              href={rec.record_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="hover:text-amber-200 underline underline-offset-2"
                                            >
                                              {rec.title}
                                            </a>
                                          ) : (
                                            rec.title
                                          )}
                                        </p>
                                        {rec.source_name && (
                                          <p className="text-xs text-amber-300/80 mt-0.5">
                                            {rec.source_name}
                                          </p>
                                        )}
                                        {rec.notes && (
                                          <p className="text-xs text-slate-400 mt-1 whitespace-pre-wrap">
                                            {rec.notes}
                                          </p>
                                        )}
                                        {rec.file_path && (
                                          <button
                                            onClick={() =>
                                              openAttachment(
                                                rec.file_path as string
                                              )
                                            }
                                            className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:border-amber-400 hover:text-amber-200 transition"
                                          >
                                            {isImagePath(rec.file_path)
                                              ? "🖼️ View photo"
                                              : "📄 View document"}
                                          </button>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => deleteRecord(rec)}
                                        className="text-xs text-slate-500 hover:text-red-400 transition shrink-0"
                                        title="Delete record"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Add record */}
                              <div className="rounded-xl border border-slate-800 bg-black/20 p-3 space-y-3">
                                <p className={labelCls}>
                                  Log a finding for {person.full_name}
                                </p>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <input
                                    type="text"
                                    value={rTitle}
                                    onChange={(e) => setRTitle(e.target.value)}
                                    placeholder="What is it? e.g. 1920 Census — Monroe, LA *"
                                    className={inputCls}
                                  />
                                  <input
                                    type="text"
                                    value={rSource}
                                    onChange={(e) => setRSource(e.target.value)}
                                    placeholder="Source, e.g. FamilySearch"
                                    className={inputCls}
                                  />
                                  <input
                                    type="url"
                                    value={rUrl}
                                    onChange={(e) => setRUrl(e.target.value)}
                                    placeholder="Link to the record (paste URL)"
                                    className={`sm:col-span-2 ${inputCls}`}
                                  />
                                  <textarea
                                    value={rNotes}
                                    onChange={(e) => setRNotes(e.target.value)}
                                    rows={2}
                                    placeholder="Notes — what does this record show?"
                                    className={`sm:col-span-2 ${inputCls}`}
                                  />
                                  <div className="sm:col-span-2">
                                    <label className={labelCls}>
                                      Attach a photo or document (optional, 10
                                      MB max)
                                    </label>
                                    <input
                                      type="file"
                                      accept="image/*,.pdf,.doc,.docx"
                                      onChange={(e) =>
                                        setRFile(e.target.files?.[0] ?? null)
                                      }
                                      className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-full file:border file:border-slate-600 file:bg-slate-800 file:px-4 file:py-1.5 file:text-xs file:font-semibold file:text-slate-200 hover:file:bg-slate-700 file:cursor-pointer"
                                    />
                                    {rFile && (
                                      <p className="text-[11px] text-amber-300/80 mt-1">
                                        Ready to upload: {rFile.name}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => addRecord(person.id)}
                                  disabled={!rTitle.trim() || savingRecord}
                                  className="rounded-full border border-amber-500/70 bg-amber-500/90 px-5 py-2 text-xs font-bold text-black hover:bg-amber-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {savingRecord ? "Saving…" : "Save record"}
                                </button>
                              </div>

                              {/* Delete person */}
                              <div className="pt-1 text-right">
                                <button
                                  onClick={() => deletePerson(person.id)}
                                  className="text-xs text-slate-500 hover:text-red-400 transition"
                                >
                                  Remove {person.full_name} from vault
                                </button>
                              </div>
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                )}

                {/* Nudge back to search */}
                <p className="text-xs text-slate-500">
                  Need more records?{" "}
                  <button
                    onClick={() => setTab("search")}
                    className="text-amber-300 underline underline-offset-2 hover:text-amber-200"
                  >
                    Search the free archives
                  </button>{" "}
                  and save what you find here. New to this?{" "}
                  <Link
                    href="/ancestry/guide"
                    className="text-amber-300 underline underline-offset-2 hover:text-amber-200"
                  >
                    Read the step-by-step guide
                  </Link>
                  .
                </p>
              </>
            )}
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
