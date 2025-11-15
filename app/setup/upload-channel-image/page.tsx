"use client";

import React, { useState, useEffect } from "react";
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

export default function UpdateChannelImage() {
  const [channelId, setChannelId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const { toast } = useToast();

  // ✅ Fetch channels when component mounts
  useEffect(() => {
    async function fetchChannels() {
      try {
        const { data, error } = await supabase
          .from("channels")
          .select("id, name")
          .order("id");

        if (error) throw error;
        setChannels(data || []);
      } catch (error) {
        console.error("Error fetching channels:", error);
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
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!channelId) {
      toast({
        title: "Error",
        description: "Please select a channel",
        variant: "destructive",
      });
      return;
    }

    if (!file) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Upload file to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `channel-${channelId}-${Date.now()}.${fileExt}`;
      const filePath = `channel-images/${fileName}`;

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

      // Update channel record with new image URL
      const { error: updateError } = await supabase
        .from("channels")
        .update({ logo_url: publicUrl })
        .eq("id", Number(channelId));

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Channel image updated successfully",
      });

      // Reset form
      setFile(null);
      setChannelId("");

      const fileInput = document.getElementById(
        "image-upload"
      ) as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
    } catch (error) {
      console.error("Error updating channel image:", error);
      toast({
        title: "Error",
        description: "Failed to update channel image",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 text-white">
      <h1 className="mb-6 text-2xl font-bold">Update Channel Image</h1>

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
            <SelectTrigger id="channel" className="w-full">
              <SelectValue placeholder="Select a channel" />
            </SelectTrigger>
            <SelectContent>
              {loadingChannels ? (
                <SelectItem value="loading" disabled>
                  Loading channels...
                </SelectItem>
              ) : channels.length > 0 ? (
                channels.map((channel) => (
                  <SelectItem
                    key={channel.id}
                    value={String(channel.id)} // ✅ Ensure this is a string
                  >
                    Channel {channel.id}
                    {channel.name ? `: ${channel.name}` : ""}
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
            Recommended: 16:9 aspect ratio, at least 1280×720px. Keep under
            2MB if you’re reusing thumbnails.
          </p>
        </div>

        {/* Preview */}
        {file && (
          <div className="mt-4">
            <p className="mb-2 text-sm">Preview:</p>
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
          {loading ? "Uploading..." : "Update Channel Image"}
        </Button>
      </form>
    </div>
  );
}
