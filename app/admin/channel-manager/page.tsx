"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, CheckCircle, RefreshCw, Save } from "lucide-react";

type Channel = {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  logo_url?: string | null;
  password_protected?: boolean | null;
};

type Message = {
  type: "success" | "error";
  text: string;
};

export default function ChannelManagerPage() {
  const supabase = createClientComponentClient();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [edited, setEdited] = useState<
    Record<
      string,
      {
        name: string;
        slug: string;
        logo_url: string;
      }
    >
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  // 🔄 Load channels
  useEffect(() => {
    let cancelled = false;

    async function loadChannels() {
      setIsLoading(true);
      setMessage(null);

      try {
        const { data, error } = await supabase
          .from("channels")
          .select("id, name, slug, description, logo_url, password_protected");

        if (error) {
          throw error;
        }

        const sorted = (data || []).sort((a: any, b: any) => {
          const aNum = Number.parseInt(String(a.id), 10);
          const bNum = Number.parseInt(String(b.id), 10);
          return aNum - bNum;
        }) as Channel[];

        if (!cancelled) {
          setChannels(sorted);

          const initial: Record<
            string,
            { name: string; slug: string; logo_url: string }
          > = {};
          sorted.forEach((ch) => {
            initial[ch.id] = {
              name: ch.name ?? "",
              slug: ch.slug ?? "",
              logo_url: ch.logo_url ?? "",
            };
          });
          setEdited(initial);
        }
      } catch (e) {
        console.error("Error loading channels:", e);
        if (!cancelled) {
          setMessage({
            type: "error",
            text: "Failed to load channels. Please try again.",
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadChannels();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // 📝 Track changes
  function updateField(
    channelId: string,
    field: "name" | "slug" | "logo_url",
    value: string
  ) {
    setEdited((prev) => ({
      ...prev,
      [channelId]: {
        ...(prev[channelId] || { name: "", slug: "", logo_url: "" }),
        [field]: value,
      },
    }));
  }

  // 🧮 Have any edits?
  const hasChanges = channels.some((ch) => {
    const current = edited[ch.id];
    if (!current) return false;
    return (
      current.name !== (ch.name ?? "") ||
      current.slug !== (ch.slug ?? "") ||
      current.logo_url !== (ch.logo_url ?? "")
    );
  });

  // 💾 Save edits
  async function saveChanges() {
    if (!hasChanges) {
      setMessage({ type: "success", text: "No changes to save." });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const changed = channels.filter((ch) => {
        const current = edited[ch.id];
        if (!current) return false;
        return (
          current.name !== (ch.name ?? "") ||
          current.slug !== (ch.slug ?? "") ||
          current.logo_url !== (ch.logo_url ?? "")
        );
      });

      for (const ch of changed) {
        const values = edited[ch.id];
        if (!values) continue;

        const { error } = await supabase
          .from("channels")
          .update({
            name: values.name,
            slug: values.slug || null,
            logo_url: values.logo_url || null,
          })
          .eq("id", ch.id);

        if (error) {
          console.error("Error updating channel", ch.id, error);
          throw error;
        }
      }

      // Reload fresh data so UI matches DB
      const { data: refreshed, error: reloadError } = await supabase
        .from("channels")
        .select("id, name, slug, description, logo_url, password_protected");

      if (reloadError) {
        throw reloadError;
      }

      const sorted = (refreshed || []).sort((a: any, b: any) => {
        const aNum = Number.parseInt(String(a.id), 10);
        const bNum = Number.parseInt(String(b.id), 10);
        return aNum - bNum;
      }) as Channel[];

      setChannels(sorted);

      const resetEdited: Record<
        string,
        { name: string; slug: string; logo_url: string }
      > = {};
      sorted.forEach((ch) => {
        resetEdited[ch.id] = {
          name: ch.name ?? "",
          slug: ch.slug ?? "",
          logo_url: ch.logo_url ?? "",
        };
      });
      setEdited(resetEdited);

      setMessage({
        type: "success",
        text: `Updated ${changed.length} channel${
          changed.length === 1 ? "" : "s"
        }.`,
      });
    } catch (e) {
      console.error("Error saving changes:", e);
      setMessage({
        type: "error",
        text: "Failed to save changes. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  // 🔄 Reset to DB values
  function resetChanges() {
    const reset: Record<
      string,
      { name: string; slug: string; logo_url: string }
    > = {};
    channels.forEach((ch) => {
      reset[ch.id] = {
        name: ch.name ?? "",
        slug: ch.slug ?? "",
        logo_url: ch.logo_url ?? "",
      };
    });
    setEdited(reset);
    setMessage(null);
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Channel Manager</h1>
          <p className="text-gray-400">
            Update channel names, slugs, and artwork URLs.
          </p>
        </div>
        <Link href="/admin">
          <Button variant="outline">Back to Admin</Button>
        </Link>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-md flex items-center gap-2 ${
            message.type === "success"
              ? "bg-green-900/20 text-green-400"
              : "bg-red-900/20 text-red-400"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Channels</CardTitle>
          <CardDescription>
            Edit the display name, slug (URL piece), and logo URL for each
            channel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-6">
              {channels.map((ch) => {
                const current = edited[ch.id] || {
                  name: "",
                  slug: "",
                  logo_url: "",
                };

                const changed =
                  current.name !== (ch.name ?? "") ||
                  current.slug !== (ch.slug ?? "") ||
                  current.logo_url !== (ch.logo_url ?? "");

                return (
                  <div
                    key={ch.id}
                    className="border border-slate-700 rounded-lg p-4 bg-slate-900/60"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        Channel {ch.id}
                      </span>
                      {changed && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                          Modified
                        </span>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="flex flex-col gap-1">
                        <Label
                          htmlFor={`name-${ch.id}`}
                          className="text-xs text-slate-300"
                        >
                          Name
                        </Label>
                        <Input
                          id={`name-${ch.id}`}
                          value={current.name}
                          onChange={(e) =>
                            updateField(ch.id, "name", e.target.value)
                          }
                          className={
                            changed && current.name !== (ch.name ?? "")
                              ? "border-amber-500"
                              : ""
                          }
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <Label
                          htmlFor={`slug-${ch.id}`}
                          className="text-xs text-slate-300"
                        >
                          Slug (URL)
                        </Label>
                        <Input
                          id={`slug-${ch.id}`}
                          placeholder="e.g. ch-31-music"
                          value={current.slug}
                          onChange={(e) =>
                            updateField(ch.id, "slug", e.target.value)
                          }
                          className={
                            changed && current.slug !== (ch.slug ?? "")
                              ? "border-amber-500"
                              : ""
                          }
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <Label
                          htmlFor={`logo-${ch.id}`}
                          className="text-xs text-slate-300"
                        >
                          Logo URL
                        </Label>
                        <Input
                          id={`logo-${ch.id}`}
                          placeholder="https://…"
                          value={current.logo_url}
                          onChange={(e) =>
                            updateField(ch.id, "logo_url", e.target.value)
                          }
                          className={
                            changed && current.logo_url !== (ch.logo_url ?? "")
                              ? "border-amber-500"
                              : ""
                          }
                        />
                      </div>
                    </div>

                    {current.logo_url && (
                      <div className="mt-3 text-xs text-slate-400">
                        Preview:
                        <div className="mt-1 h-16 w-28 border border-slate-700 rounded bg-black/50 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={current.logo_url}
                            alt={`Channel ${ch.id} logo preview`}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={resetChanges}
            disabled={isLoading || isSaving || !hasChanges}
          >
            Reset Changes
          </Button>
          <Button
            onClick={saveChanges}
            disabled={isLoading || isSaving || !hasChanges}
            className="flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-2">Notes</h2>
        <ul className="list-disc pl-5 space-y-1 text-gray-300 text-sm">
          <li>Slug is the text used in URLs if you ever link by slug.</li>
          <li>Logo URL should be a public Supabase Storage URL.</li>
          <li>Channel IDs cannot be changed here.</li>
        </ul>
      </div>
    </div>
  );
}
