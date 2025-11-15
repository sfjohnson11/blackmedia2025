"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
import { ArrowLeft, Copy } from "lucide-react";

type Channel = {
  id: number;
  name: string | null;
};

export default function UpdateChannelImage() {
  const [channelId, setChannelId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [uploadedUrl, setUploadedUrl] = useState<string>("");

  const { toast } = useToast();

  useEffect(() => {
    async function fetchChannels() {
      try {
        const { data, error } = await supabase
          .from("channels")
          .select("id, name")
          .order("id");

        if (error) throw error;
        setChannels(data || []);
      } catch {
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
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setFile(e.target.files[0]);
    }
  };

  const handleCopy = async () => {
    if (uploadedUrl) {
      await navigator.clipboard.writeText(uploadedUrl);
      toast({ title: "Copied!", description: "URL copied to clipboard." });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!channelId || !file) {
      toast({
        title: "Error",
        description: "Select a channel and image first.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const ext = file.name.split(".").pop();
      const fileName = `channel-${channelId}-${Date.now()}.${ext}`;
      const filePath = `channel-images/${fileName}`;

      // Upload
      const { error: uploadError } = await supabase.storage
        .from("channel-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Public URL
      const { data } = supabase.storage
        .from("channel-images")
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;
      setUploadedUrl(publicUrl);

      // Write to DB
      const { error: updateError } = await supabase
        .from("channels")
        .update({ logo_url: publicUrl })
        .eq("id", channelId);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Channel image updated!",
      });

      setFile(null);
      setChannelId("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Upload failed.",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  return (
    <div className="container mx-auto py-8 text-white">
      {/* BACK BUTTON */}
      <div className="mb-4">
        <Link href="/admin">
          <Button variant="outline" className="border-slate-600 bg-slate-900 text-sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin Dashboard
          </Button>
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6">Update Channel Image</h1>

      {/* SUCCESS PANEL */}
      {uploadedUrl && (
        <div className="mb-8 rounded-lg border border-green-500 bg-green-500/10 p-4">
          <h2 className="text-lg font-semibold text-green-300">
            ✅ Upload Successful!
          </h2>

          <p className="mt-1 text-sm text-green-200">
            This image is now LIVE on your channel.
          </p>

          <div className="mt-3">
            <img
              src={uploadedUrl}
              alt="Uploaded"
              className="rounded-md border border-green-600 max-w-md"
            />
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Input value={uploadedUrl} readOnly className="flex-1 bg-slate-900" />
            <Button onClick={handleCopy} className="bg-green-600 hover:bg-green-700">
              <Copy className="h-4 w-4 mr-1" /> Copy
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
        {/* SELECT CHANNEL */}
        <div className="space-y-2">
          <Label>Select Channel</Label>
          <Select value={channelId} onValueChange={setChannelId}>
            <SelectTrigger className="w-full bg-slate-900 border-slate-700">
              <SelectValue placeholder="Select a channel" />
            </SelectTrigger>
            <SelectContent>
              {loadingChannels ? (
                <SelectItem value="loading" disabled>
                  Loading channels…
                </SelectItem>
              ) : (
                channels.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    Channel {c.id} — {c.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* FILE UPLOAD */}
        <div className="space-y-2">
          <Label>Upload Image</Label>
          <Input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="cursor-pointer bg-slate-900"
          />
          <p className="text-sm text-gray-400">Recommended: 1280×720, < 2MB</p>
        </div>

        {/* LIVE PREVIEW BEFORE UPLOAD */}
        {file && (
          <div className="mt-4">
            <p className="text-sm mb-2">Preview before Upload:</p>
            <div className="aspect-video bg-gray-800 rounded-md overflow-hidden">
              <img
                src={URL.createObjectURL(file)}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        <Button type="submit" disabled={loading || !channelId || !file} className="w-full">
          {loading ? "Uploading…" : "Update Channel Image"}
        </Button>
      </form>
    </div>
  );
}
