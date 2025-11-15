"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

type Channel = {
  id: number;
  name: string | null;
};

export default function UpdateChannelImagePage() {
  const [channelId, setChannelId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [uploadedUrl, setUploadedUrl] = useState<string>("");

  const { toast } = useToast();

  // Load channel list once
  useEffect(() => {
    async function fetchChannels() {
      try {
        const { data, error } = await supabase
          .from("channels")
          .select("id, name")
          .order("id");

        if (error) throw error;
        setChannels(data || []);
      } catch (err) {
        console.error("Error fetching channels:", err);
        toast({
          title: "Error",
          description: "Failed to load channels",
          variant: "destructive",
        });
      } finally {
        setLoadingChannels(false);
      }
    }

    fetchChannels();
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setFile(e.target.files[0]);
    }
  };

  const handleCopy = async () => {
    if (!uploadedUrl) return;
    try {
      await navigator.clipboard.writeText(uploadedUrl);
      toast({
        title: "Copied",
        description: "Image URL copied to clipboard.",
      });
    } catch (err) {
      console.error("Clipboard error:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!channelId || !file) {
      toast({
        title: "Error",
        description: "Please select a channel and an image file.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const ext = file.name.split(".").pop();
      const fileName = `channel-${channelId}-${Date.now()}.${ext}`;
      const filePath = `channel-images/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("channel-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from("channel-images")
        .getPublicUrl(filePath);

      const publicUrl = data?.publicUrl;
      if (!publicUrl) {
        throw new Error("Could not get public URL for uploaded image.");
      }

      // Save to channels table
      const { error: updateError } = await supabase
        .from("channels")
        .update({ logo_url: publicUrl })
        .eq("id", Number(channelId));

      if (updateError) throw updateError;

      setUploadedUrl(publicUrl);

      toast({
        title: "Success",
        description: "Channel image updated successfully.",
      });

      // Clear form
      setChannelId("");
      setFile(null);
      const fileInput = document.getElementById(
        "image-upload"
      ) as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
    } catch (err) {
      console.error("Error updating channel image:", err);
      toast({
        title: "Error",
        description: "Failed to update channel image.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 text-white">
      {/* Back to Admin */}
      <div className="mb-4">
        <Link href="/admin">
          <Button
            variant="outline"
            className="border-slate-600 bg-slate-900 text-sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin Dashboard
          </Button>
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">Update Channel Image</h1>

      {/* Success panel */}
      {uploadedUrl && (
        <div className="mb-8 rounded-lg border border-emerald-500 bg-emerald-500/10 p-4">
          <h2 className="text-lg font-semibold text-emerald-300">
            ✅ Upload Successful
          </h2>
          <p className="mt-1 text-sm text-emerald-100">
            This image is now saved on your channel.
          </p>
          <div className="mt-3">
            <img
              src={uploadedUrl}
              alt="Uploaded channel logo"
              className="max-w-md rounded-md border border-emerald-500"
            />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Input
              value={uploadedUrl}
              readOnly
              className="flex-1 bg-slate-900 text-xs"
            />
            <Button
              type="button"
              onClick={handleCopy}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Copy className="mr-1 h-4 w-4" />
              Copy URL
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-md space-y-6">
        {/* Channel selector */}
        <div className="space-y-2">
          <Label htmlFor="channel">Select Channel</Label>
          <Select
            value={channelId}
            onValueChange={(val) => {
              if (val !== "loading" && val !== "none") setChannelId(val);
            }}
          >
            <SelectTrigger
              id="channel"
              className="w-full border-slate-700 bg-slate-900"
            >
              <SelectValue placeholder="Select a channel" />
            </SelectTrigger>
            <SelectContent>
              {loadingChannels ? (
                <SelectItem value="loading" disabled>
                  Loading channels…
                </SelectItem>
              ) : channels.length > 0 ? (
                channels.map((ch) => (
                  <SelectItem key={ch.id} value={String(ch.id)}>
                    Channel {ch.id}
                    {ch.name ? ` — ${ch.name}` : ""}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>
                  No channels found
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* File upload */}
        <div className="space-y-2">
          <Label htmlFor="image-upload">Upload Image</Label>
          <Input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="cursor-pointer bg-slate-900"
          />
          <p className="text-sm text-gray-400">
            Recommended: 16:9, at least 1280×720, under 2MB.
          </p>
        </div>

        {/* Local preview before upload */}
        {file && (
          <div className="mt-4">
            <p className="mb-2 text-sm">Preview before upload:</p>
            <div className="aspect-video overflow-hidden rounded-md bg-gray-800">
              <img
                src={URL.createObjectURL(file)}
                alt="Preview"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading || !channelId || !file}
          className="w-full"
        >
          {loading ? "Uploading…" : "Update Channel Image"}
        </Button>
      </form>
    </div>
  );
}
