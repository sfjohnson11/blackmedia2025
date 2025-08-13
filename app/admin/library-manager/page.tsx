"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  AlertCircle, CheckCircle2, Upload, Loader2, ArrowLeft, ListChecks, PlusCircle
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

import { getSupabaseClient } from "@/utils/supabase/client";
import type { Channel, LibraryItemData } from "@/types";
import { getCurrentUser } from "@/lib/auth-client";

const MEDIA_BUCKET = "library-media";
const THUMBNAIL_BUCKET = "library-thumbnails";

export default function LibraryManagerPage() {
  const supabase = getSupabaseClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"document" | "audio" | "video">("video");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");       // manual URL (optional)
  const [thumbnailUrl, setThumbnailUrl] = useState(""); // manual URL (optional)
  const [content, setContent] = useState(""); // document text (optional)
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [libraryItems, setLibraryItems] = useState<LibraryItemData[]>([]);
  const [view, setView] = useState<"form" | "list">("list");

  // Gate the page to admins only
  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      if (!me || me.role !== "admin") {
        window.location.href = "/login?role=admin";
      }
    })();
  }, []);

  const fetchChannels = useCallback(async () => {
    const { data, error } = await supabase
      .from("channels")
      .select("id, name")
      .order("name");

    if (error) {
      console.error("Error fetching channels:", error);
      setMessage({ type: "error", text: "Failed to load channels." });
    } else {
      setChannels((data as Channel[]) || []);
    }
  }, [supabase]);

  const fetchLibraryItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("library_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching library items:", error);
      setMessage({ type: "error", text: "Failed to load library items." });
    } else {
      setLibraryItems((data as LibraryItemData[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchChannels();
    fetchLibraryItems();
  }, [fetchChannels, fetchLibraryItems]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setType("video");
    setMediaFile(null);
    setThumbnailFile(null);
    setMediaUrl("");
    setThumbnailUrl("");
    setContent("");
    setSelectedChannelId("");
    setMessage(null);
    setProgress(0);
    // Clear native file inputs
    const mediaInput = document.getElementById("mediaFile") as HTMLInputElement | null;
    if (mediaInput) mediaInput.value = "";
    const thumbInput = document.getElementById("thumbnailFile") as HTMLInputElement | null;
    if (thumbInput) thumbInput.value = "";
  };

  const uploadToBucket = async (file: File, bucket: string): Promise<string> => {
    const ext = file.name.split(".").pop() || "bin";
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(key, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(key);
    if (!pub?.publicUrl) throw new Error("Could not get public URL after upload.");
    return pub.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    setProgress(10);

    try {
      // Basic validation
      if (!title.trim()) throw new Error("Title is required.");
      if ((type === "video" || type === "audio") && !mediaFile && !mediaUrl.trim()) {
        throw new Error("For video/audio, provide a file or a direct URL.");
      }
      if (type === "document" && !mediaFile && !mediaUrl.trim() && !content.trim()) {
        throw new Error("For documents, upload a PDF or paste text content.");
      }

      let finalMediaUrl = mediaUrl.trim();
      let finalThumbUrl = thumbnailUrl.trim();
      let fileSizeMb: number | null = null;
      // (Optional) duration could be added later via a media probe

      // Upload media if provided
      if (mediaFile) {
        setProgress(30);
        finalMediaUrl = await uploadToBucket(mediaFile, MEDIA_BUCKET);
        fileSizeMb = Number((mediaFile.size / (1024 * 1024)).toFixed(2));
      }

      // Upload thumb if provided
      if (thumbnailFile) {
        setProgress(60);
        finalThumbUrl = await uploadToBucket(thumbnailFile, THUMBNAIL_BUCKET);
      }

      setProgress(85);

      const payload: Omit<LibraryItemData, "id" | "created_at" | "date_added"> = {
        title: title.trim(),
        description: description.trim() || null,
        type,
        url: finalMediaUrl || null,
        thumbnail_url: finalThumbUrl || null,
        content: type === "document" && !finalMediaUrl ? (content.trim() || null) : null,
        channel_id: selectedChannelId || null,
        file_size_mb: fileSizeMb,
        duration_seconds: null,
      };

      const { data, error } = await supabase
        .from("library_items")
        .insert(payload)
        .select()
        .single();

      if (error) throw new Error(error.message);

      setProgress(100);
      setMessage({ type: "success", text: `Added "${data.title}" to the library.` });
      setLibraryItems((prev) => [data as LibraryItemData, ...prev]);
      resetForm();
      setView("list");
    } catch (err: any) {
      console.error(err);
      setMessage({ type: "error", text: err.message || "Upload failed." });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this library item?")) return;
    setLoading(true);
    const { error } = await supabase.from("library_items").delete().eq("id", id);
    if (error) {
      setMessage({ type: "error", text: `Delete failed: ${error.message}` });
    } else {
      setLibraryItems((prev) => prev.filter((i) => i.id !== id));
      setMessage({ type: "success", text: "Item deleted." });
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link href="/admin" className="mr-4">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Library Manager</h1>
        </div>
        <Button onClick={() => setView(view === "form" ? "list" : "form")} variant="outline">
          {view === "form" ? (
            <>
              <ListChecks className="mr-2 h-4 w-4" /> View List
            </>
          ) : (
            <>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Item
            </>
          )}
        </Button>
      </div>

      {/* Alerts */}
      {message && (
        <Alert
          className={`mb-6 ${
            message.type === "success"
              ? "border-green-500 text-green-700 dark:text-green-400"
              : "border-red-500 text-red-700 dark:text-red-400"
          }`}
          variant={message.type === "error" ? "destructive" : undefined}
        >
          {message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertTitle>{message.type === "success" ? "Success" : "Error"}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Form */}
      {view === "form" && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Library Item</CardTitle>
            <CardDescription>Upload or link media and optionally attach it to a channel.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="type">Type <span className="text-red-500">*</span></Label>
                  <Select value={type} onValueChange={(v) => setType(v as any)} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select media type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="audio">Audio</SelectItem>
                      <SelectItem value="document">Document</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div>
                <Label htmlFor="channel">Associated Channel (optional)</Label>
                <Select value={selectedChannelId} onValueChange={(v) => setSelectedChannelId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {channels.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {type === "document" && (
                <div>
                  <Label htmlFor="content">Document Text (if not uploading a PDF)</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste or type document text here…"
                  />
                  <p className="text-xs text-gray-500 mt-1">Or upload a PDF below.</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="mediaFile">Media File (Video, Audio, or PDF)</Label>
                <Input id="mediaFile" type="file" onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)} />
                <p className="text-xs text-gray-500">Or paste a direct URL:</p>
                <Input
                  id="mediaUrl"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://example.com/media.mp4"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="thumbnailFile">Thumbnail (image)</Label>
                <Input id="thumbnailFile" type="file" accept="image/*" onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)} />
                <p className="text-xs text-gray-500">Or paste a direct URL:</p>
                <Input
                  id="thumbnailUrl"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://example.com/thumb.jpg"
                />
              </div>

              {loading && <Progress value={progress} className="w-full" />}
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm} disabled={loading}>Reset</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Add Item
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* List */}
      {view === "list" && (
        <Card>
          <CardHeader>
            <CardTitle>Existing Library Items</CardTitle>
            <CardDescription>Found: {libraryItems.length}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && libraryItems.length === 0 ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : libraryItems.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No library items yet. Click “Add New Item”.</p>
            ) : (
              <div className="space-y-4">
                {libraryItems.map((item) => (
                  <div key={item.id} className="border p-4 rounded-lg bg-gray-900/50 flex justify-between items-start">
                    <div className="flex-grow">
                      <h3 className="font-semibold text-lg">{item.title}</h3>
                      <p className="text-sm text-gray-400">
                        {item.type}{item.channel_id ? ` • Channel: ${item.channel_id}` : ""}
                      </p>
                      <p className="text-xs text-gray-500 break-all">Media URL: {item.url || "—"}</p>
                      <p className="text-xs text-gray-500 break-all">Thumb URL: {item.thumbnail_url || "—"}</p>
                      <p className="text-xs text-gray-500">Added: {new Date(item.date_added).toLocaleString()}</p>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)} disabled={loading}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
