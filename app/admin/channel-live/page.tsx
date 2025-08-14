"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Channel } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import YouTubeEmbed from "@/components/youtube-embed";
import { CheckCircle, Loader2, RefreshCw, Save, Video, XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

const DEFAULT_CHANNEL_ID = 21; // Channel 21 as your live channel

export default function ChannelLiveAdminPage() {
  const router = useRouter();

  // simple client-side admin gate (matches your login approach)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("btv_admin_auth");
    if (token !== "blacktruth_admin_2025") {
      router.replace("/admin/login");
    }
  }, [router]);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(DEFAULT_CHANNEL_ID);
  const [formValue, setFormValue] = useState<{ youtube_channel_id: string; youtube_is_live: boolean }>({
    youtube_channel_id: "",
    youtube_is_live: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const selectedChannel = useMemo(
    () => channels.find((c) => Number.parseInt(String(c.id), 10) === selectedId!),
    [channels, selectedId]
  );

  // load channels (only the fields we need)
  const load = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase
        .from("channels")
        .select("id, name, youtube_channel_id, youtube_is_live")
        .order("id", { ascending: true });

      if (error) throw error;

      const list = (data || []) as Channel[];
      setChannels(list);

      // initialize form from default channel
      const init = list.find((c) => Number.parseInt(String(c.id), 10) === DEFAULT_CHANNEL_ID) || list[0];
      if (init) {
        setSelectedId(Number.parseInt(String(init.id), 10));
        setFormValue({
          youtube_channel_id: init.youtube_channel_id || "",
          youtube_is_live: !!init.youtube_is_live,
        });
      }
    } catch (e: any) {
      setResult({ ok: false, msg: e?.message || "Failed to load channels" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when user switches the channel in the dropdown, sync form
  useEffect(() => {
    if (!selectedChannel) return;
    setFormValue({
      youtube_channel_id: selectedChannel.youtube_channel_id || "",
      youtube_is_live: !!selectedChannel.youtube_is_live,
    });
  }, [selectedChannel]);

  const handleSave = async () => {
    if (selectedId == null) return;
    setSaving(true);
    setResult(null);
    try {
      const { error } = await supabase
        .from("channels")
        .update({
          youtube_channel_id: formValue.youtube_channel_id || null,
          youtube_is_live: formValue.youtube_is_live,
        })
        .eq("id", selectedId);

      if (error) throw error;

      setResult({ ok: true, msg: "Saved settings." });
      // reflect in local list
      setChannels((prev) =>
        prev.map((c) =>
          Number.parseInt(String(c.id), 10) === selectedId
            ? { ...c, youtube_channel_id: formValue.youtube_channel_id, youtube_is_live: formValue.youtube_is_live }
            : c
        )
      );
    } catch (e: any) {
      setResult({ ok: false, msg: e?.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const quickGoLive = async () => {
    if (selectedId == null) return;
    setSaving(true);
    setResult(null);
    try {
      const { error } = await supabase
        .from("channels")
        .update({ youtube_is_live: true })
        .eq("id", selectedId);

      if (error) throw error;

      setResult({ ok: true, msg: "Set LIVE = ON." });
      setFormValue((f) => ({ ...f, youtube_is_live: true }));
      setChannels((prev) =>
        prev.map((c) =>
          Number.parseInt(String(c.id), 10) === selectedId ? { ...c, youtube_is_live: true } : c
        )
      );
    } catch (e: any) {
      setResult({ ok: false, msg: e?.message || "Failed to set LIVE = ON" });
    } finally {
      setSaving(false);
    }
  };

  const quickStopLive = async () => {
    if (selectedId == null) return;
    setSaving(true);
    setResult(null);
    try {
      const { error } = await supabase
        .from("channels")
        .update({ youtube_is_live: false })
        .eq("id", selectedId);

      if (error) throw error;

      setResult({ ok: true, msg: "Set LIVE = OFF." });
      setFormValue((f) => ({ ...f, youtube_is_live: false }));
      setChannels((prev) =>
        prev.map((c) =>
          Number.parseInt(String(c.id), 10) === selectedId ? { ...c, youtube_is_live: false } : c
        )
      );
    } catch (e: any) {
      setResult({ ok: false, msg: e?.message || "Failed to set LIVE = OFF" });
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshPreview = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500); // just a tiny delay so the spinner is visible
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin">
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Channel Live Control</h1>
      </div>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">YouTube Live Settings</CardTitle>
            {formValue.youtube_is_live ? (
              <Badge className="bg-red-600">LIVE</Badge>
            ) : (
              <Badge className="bg-gray-600">OFF</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center text-gray-300">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading channels…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Channel</label>
                  <select
                    value={selectedId ?? ""}
                    onChange={(e) => setSelectedId(Number.parseInt(e.target.value, 10))}
                    className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md"
                  >
                    {channels.map((c) => (
                      <option key={String(c.id)} value={Number.parseInt(String(c.id), 10)}>
                        {`Channel ${c.id} — ${c.name}`}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Defaults to Channel {DEFAULT_CHANNEL_ID}. You can manage any channel that has these fields.
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">YouTube Channel ID (starts with UC…)</label>
                  <input
                    type="text"
                    value={formValue.youtube_channel_id}
                    onChange={(e) => setFormValue((f) => ({ ...f, youtube_channel_id: e.target.value.trim() }))}
                    placeholder="UCxxxxxxxxxxxxxxxx"
                    className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Paste the **Channel ID** (not stream key). The embed will show the current live broadcast for that channel.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Settings
                    </>
                  )}
                </Button>

                <Button
                  onClick={quickGoLive}
                  disabled={saving || !formValue.youtube_channel_id}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Video className="h-4 w-4 mr-2" />
                  Set LIVE = ON
                </Button>

                <Button onClick={quickStopLive} disabled={saving} variant="secondary" className="bg-gray-700">
                  <XCircle className="h-4 w-4 mr-2" />
                  Set LIVE = OFF
                </Button>

                <Button onClick={handleRefreshPreview} variant="outline" className="border-gray-600">
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh Preview
                </Button>
              </div>

              {result && (
                <div
                  className={`mt-3 p-3 rounded-md text-sm flex items-center gap-2 ${
                    result.ok ? "bg-green-900/30 text-green-300" : "bg-red-900/30 text-red-300"
                  }`}
                >
                  {result.ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <span>{result.msg}</span>
                </div>
              )}
            </>
          )}
        </CardContent>

        <CardFooter className="block">
          <div className="text-sm text-gray-400 mb-3">
            {formValue.youtube_is_live ? (
              <span>
                Status: <strong className="text-red-400">LIVE</strong> — viewers on <em>/watch/{selectedId ?? "?"}</em>{" "}
                will see YouTube while this is on.
              </span>
            ) : (
              <span>
                Status: <strong>OFF</strong> — viewers will see the scheduled program (or standby) on{" "}
                <em>/watch/{selectedId ?? "?"}</em>.
              </span>
            )}
          </div>

          {/* Live preview */}
          <div className="bg-gray-900 rounded-md p-3 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Preview</div>
              <div className="text-xs text-gray-400">
                {formValue.youtube_channel_id
                  ? `channel=${formValue.youtube_channel_id}`
                  : "No channel ID set"}
              </div>
            </div>

            {formValue.youtube_is_live && formValue.youtube_channel_id ? (
              <YouTubeEmbed channelId={formValue.youtube_channel_id} title="Preview — Channel Live" muted />
            ) : (
              <div className="text-center text-gray-400 p-8">
                {formValue.youtube_channel_id
                  ? "Live is OFF — this page would show your scheduled program on the watch page."
                  : "Enter a YouTube Channel ID to preview the live embed here."}
              </div>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
