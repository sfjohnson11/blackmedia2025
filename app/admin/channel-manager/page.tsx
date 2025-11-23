"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
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
import Link from "next/link";

type Channel = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  logo_url?: string;
  password_protected?: boolean;
};

type EditedChannel = {
  name: string;
  slug: string;
  logo_url: string;
};

export default function ChannelManager() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [editedChannels, setEditedChannels] = useState<
    Record<string, EditedChannel>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Load all channels
  useEffect(() => {
    async function loadChannels() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("channels")
          .select("*")
          .order("id");

        if (error) throw error;

        // Sort channels by ID numerically
        const sorted = (data || []).sort((a: any, b: any) => {
          const aNum = Number.parseInt(a.id, 10);
          const bNum = Number.parseInt(b.id, 10);
          return aNum - bNum;
        }) as Channel[];

        setChannels(sorted);

        // Initialize edited channels with current values
        const initialEdited: Record<string, EditedChannel> = {};
        sorted.forEach((channel) => {
          initialEdited[channel.id] = {
            name: channel.name ?? "",
            slug: channel.slug ?? "",
            logo_url: channel.logo_url ?? "",
          };
        });
        setEditedChannels(initialEdited);
      } catch (error) {
        console.error("Error loading channels:", error);
        setMessage({
          type: "error",
          text: "Failed to load channels. Please try again.",
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadChannels();
  }, []);

  // Handle field changes
  const handleFieldChange = (
    channelId: string,
    field: keyof EditedChannel,
    value: string
  ) => {
    setEditedChannels((prev) => ({
      ...prev,
      [channelId]: {
        ...(prev[channelId] || { name: "", slug: "", logo_url: "" }),
        [field]: value,
      },
    }));
  };

  // Save changes
  const saveChanges = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      // Find which channels have changed
      const changedChannels = channels.filter((channel) => {
        const edited = editedChannels[channel.id];
        if (!edited) return false;
        return (
          edited.name !== (channel.name ?? "") ||
          edited.slug !== (channel.slug ?? "") ||
          edited.logo_url !== (channel.logo_url ?? "")
        );
      });

      if (changedChannels.length === 0) {
        setMessage({ type: "success", text: "No changes to save." });
        setIsSaving(false);
        return;
      }

      // Update each changed channel
      const updates = changedChannels.map((channel) => {
        const edited = editedChannels[channel.id];
        return supabase
          .from("channels")
          .update({
            name: edited.name,
            slug: edited.slug || null,
            logo_url: edited.logo_url || null,
          })
          .eq("id", channel.id);
      });

      await Promise.all(updates);

      // Refresh channel list
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .order("id");

      if (error) throw error;

      const sorted = (data || []).sort((a: any, b: any) => {
        const aNum = Number.parseInt(a.id, 10);
        const bNum = Number.parseInt(b.id, 10);
        return aNum - bNum;
      }) as Channel[];

      setChannels(sorted);

      // Reset editedChannels to match DB
      const resetEdited: Record<string, EditedChannel> = {};
      sorted.forEach((channel) => {
        resetEdited[channel.id] = {
          name: channel.name ?? "",
          slug: channel.slug ?? "",
          logo_url: channel.logo_url ?? "",
        };
      });
      setEditedChannels(resetEdited);

      setMessage({
        type: "success",
        text: `Successfully updated ${changedChannels.length} channel${
          changedChannels.length !== 1 ? "s" : ""
        }.`,
      });

      // Force refresh cache to ensure changes are visible
      try {
        await fetch("/api/refresh-cache", {
          method: "GET",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });
      } catch (e) {
        console.warn(
          "Failed to refresh cache, changes may not be immediately visible"
        );
      }
    } catch (error) {
      console.error("Error saving changes:", error);
      setMessage({
        type: "error",
        text: "Failed to save changes. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset changes
  const resetChanges = () => {
    const initialEdited: Record<string, EditedChannel> = {};
    channels.forEach((channel) => {
      initialEdited[channel.id] = {
        name: channel.name ?? "",
        slug: channel.slug ?? "",
        logo_url: channel.logo_url ?? "",
      };
    });
    setEditedChannels(initialEdited);
    setMessage(null);
  };

  // Check if any changes have been made
  const hasChanges = channels.some((channel) => {
    const edited = editedChannels[channel.id];
    if (!edited) return false;
    return (
      edited.name !== (channel.name ?? "") ||
      edited.slug !== (channel.slug ?? "") ||
      edited.logo_url !== (channel.logo_url ?? "")
    );
  });

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Channel Manager</h1>
          <p className="text-gray-400">Update channel names and information</p>
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
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Channel Names</CardTitle>
          <CardDescription>
            Edit channel names, slugs, and logo URLs below. Changes will be
            applied throughout the application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {channels.map((channel) => {
                const edited = editedChannels[channel.id] || {
                  name: "",
                  slug: "",
                  logo_url: "",
                };

                const changed =
                  edited.name !== (channel.name ?? "") ||
                  edited.slug !== (channel.slug ?? "") ||
                  edited.logo_url !== (channel.logo_url ?? "");

                return (
                  <div
                    key={channel.id}
                    className="border border-slate-700 rounded-lg p-4 bg-slate-900/60"
                  >
                    <Label
                      htmlFor={`channel-${channel.id}`}
                      className="text-right font-bold block mb-2"
                    >
                      Channel {channel.id}
                    </Label>

                    <div className="grid gap-3 md:grid-cols-3">
                      {/* Name */}
                      <div className="flex flex-col gap-1">
                        <Label
                          htmlFor={`name-${channel.id}`}
                          className="text-xs text-slate-300"
                        >
                          Name
                        </Label>
                        <Input
                          id={`name-${channel.id}`}
                          value={edited.name}
                          onChange={(e) =>
                            handleFieldChange(
                              channel.id,
                              "name",
                              e.target.value
                            )
                          }
                          className={
                            edited.name !== (channel.name ?? "")
                              ? "border-yellow-500"
                              : ""
                          }
                        />
                      </div>

                      {/* Slug */}
                      <div className="flex flex-col gap-1">
                        <Label
                          htmlFor={`slug-${channel.id}`}
                          className="text-xs text-slate-300"
                        >
                          Slug
                        </Label>
                        <Input
                          id={`slug-${channel.id}`}
                          placeholder="e.g. channel-31-music"
                          value={edited.slug}
                          onChange={(e) =>
                            handleFieldChange(
                              channel.id,
                              "slug",
                              e.target.value
                            )
                          }
                          className={
                            edited.slug !== (channel.slug ?? "")
                              ? "border-yellow-500"
                              : ""
                          }
                        />
                      </div>

                      {/* Logo URL */}
                      <div className="flex flex-col gap-1">
                        <Label
                          htmlFor={`logo-${channel.id}`}
                          className="text-xs text-slate-300"
                        >
                          Logo URL
                        </Label>
                        <Input
                          id={`logo-${channel.id}`}
                          placeholder="https://…"
                          value={edited.logo_url}
                          onChange={(e) =>
                            handleFieldChange(
                              channel.id,
                              "logo_url",
                              e.target.value
                            )
                          }
                          className={
                            edited.logo_url !== (channel.logo_url ?? "")
                              ? "border-yellow-500"
                              : ""
                          }
                        />
                      </div>
                    </div>

                    {edited.logo_url && (
                      <div className="mt-3 text-xs text-slate-400">
                        Preview:
                        <div className="mt-1 h-16 w-28 border border-slate-700 rounded bg-black/50 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={edited.logo_url}
                            alt={`Channel ${channel.id} logo preview`}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      </div>
                    )}

                    {changed && (
                      <div className="mt-2 text-[10px] inline-flex px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                        Modified
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
                Saving...
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
        <h2 className="text-xl font-bold mb-4">Tips</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-300">
          <li>Changes will be applied immediately after saving</li>
          <li>You may need to refresh the browser to see changes on other pages</li>
          <li>Channel IDs cannot be changed, only the display names</li>
          <li>Use slug and logo URL to control URLs and artwork per channel</li>
        </ul>
      </div>
    </div>
  );
}
