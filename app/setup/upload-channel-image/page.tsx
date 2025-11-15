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
  const [statusText, setStatusText] = useState<string>("");
  const [statusType, setStatusType] = useState<"idle" | "success" | "error">(
    "idle"
  );

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
        setStatusType("error");
        setStatusText("Failed to load channels from database.");
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
      setStatusType("idle");
      setStatusText("");
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

  // 🔧 Upload logo directly into the channel’s bucket
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setStatusType("idle");
    setStatusText("");

    if (!channelId || !file) {
      setStatusType("error");
      setStatusText("Please select a channel and an image file first.");
      toast({
        title: "Error",
        description: "Select a channel and image first.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Determine the correct bucket
      let bucketName = `channel${channelId}`;

      // 🎓 Freedom School → channel id 30
      if (channelId === "30") {
        bucketName = "freedom-school";
      }

      const fileExt = file.name.split(".").pop() || "png";
      const filePath = `logo.${fileExt}`; // predictable per bucket

      // Upload into that bucket (replace old logo)
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      const publicUrl = data?.publicUrl;

      if (!publicUrl) {
        throw new Error("Could not get public URL for uploaded image.");
      }

      // Save into channels table
      const { error: updateError } = await supabase
        .from("channels")
        .update({ logo_url: publicUrl })
        .eq("id", Number(channelId));

      if (updateError) {
        console.error("DB update error:", updateError);
        throw new Error(updateError.message);
      }

      setUploadedUrl(publicUrl);
      setStatusType("success");
      setStatusText(`Image saved for Channel ${channelId} in bucket "${bucketName}".`);

      toast({
        title: "Success",
        description: "Channel image updated successfully.",
      });
    } catch (err: any) {
      console.error("Error updating channel image:", err);
      setStatusType("error");
      setStatusText(err?.message || "Upload failed.");
      toast({
        title: "Error",
        description: err?.message || "Failed to update channel image.",
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

      <h1 className="mb-4 text-2xl font-bold">Update Channel Image</h1>
      <p className="mb-6 text-sm text-slate-300">
        Select a channel, upload a thumbnail, and it will be stored inside the channel’s bucket  
        (e.g. <strong>channel5/logo.png</strong> or <strong>freedom-school/logo.png</strong>).
      </p>

      {/* STATUS BAR */}
      {statusType !== "idle" && (
        <div
          className={`mb-6 rounded-md border px-4 py-3 text-sm ${
            statusType === "success"
              ? "border-emerald-500 bg-emerald-500/10 text-emerald-100"
              : "border-red-500 bg-red-500/10 text-red-100"
          }`}
        >
          {statusText}
        </div>
      )}

      {/* SUCCESS PREVIEW */}
      {uploadedUrl && (
        <div className="mb-8 rounded-lg border border-emerald-500 bg-emerald-500/10 p-4">
          <h2 className="text-lg font-semibold text-emerald-300">
            ✅ Upload Successful
          </h2>
          <div className="mt-3">
            <img
              src={uploadedUrl}
              alt="Channel logo"
              className="max-w-md rounded-md border border-emerald-500"
            />
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Input value={uploadedUrl} readOnly className="flex-1 bg-slate-900 text-xs" />
            <Button onClick={handleCopy} className="bg-emerald-600 hover:bg-emerald-700">
              <Copy className="mr-1 h-4 w-4" />
              Copy URL
            </Button>
          </div>
        </div>
      )}

      {/* FORM */}
      <form onSubmit={handleSubmit} className="max-w-md space-y-6">
        {/* CHANNEL SELECT */}
        <div className="space-y-2">
          <Label>Select Channel</Label>
          <Select
            value={channelId}
            onValueChange={(v) => {
              if (v !== "loading" && v !== "none") setChannelId(v);
            }}
          >
            <SelectTrigger className="w-full border-slate-700 bg-slate-900">
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
                    Channel {ch.id} {ch.name ? ` — ${ch.name}` : ""}
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

        {/* FILE UPLOAD */}
        <div className="space-y-2">
          <Label htmlFor="image-upload">Upload Image</Label>
          <Input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="cursor-pointer bg-slate-900"
          />
          <p className="text-sm text-gray-400">Recommended: 1280×720, under 2MB.</p>
        </div>

        {/* LOCAL PREVIEW */}
        {file && (
          <div>
            <p className="mb-2 text-sm">Preview:</p>
            <div className="aspect-video overflow-hidden rounded-md bg-gray-800">
              <img
                src={URL.createObjectURL(file)}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading || !file || !channelId}
          className="w-full"
        >
          {loading ? "Uploading…" : "Update Channel Image"}
        </Button>
      </form>
    </div>
  );
}
