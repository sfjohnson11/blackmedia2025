"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, FileText, Music, Video, Filter } from "lucide-react";

type MediaType = "document" | "audio" | "video";

type DbItem = {
  id: string;
  title: string;
  description: string | null;
  type: "video" | "audio" | "document";
  url: string | null;
  thumbnail_url: string | null;
  channel_id: string | null;
  date_added: string | null;
  file_size_mb: number | null;
  duration_seconds: number | null;
};

type Channel = { id: string; name: string };

type LibraryItem = {
  id: string;
  title: string;
  description: string;
  type: MediaType;
  url: string;
  thumbnail: string;
  channelId: string;
  channelName: string;
  dateAdded: string;
  fileSize?: string;
  duration?: string;
};

const formatDuration = (secs?: number | null) => {
  if (!secs || secs <= 0) return undefined;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const getMediaIcon = (type: MediaType) => {
  switch (type) {
    case "document":
      return <FileText className="h-6 w-6" />;
    case "audio":
      return <Music className="h-6 w-6" />;
    case "video":
      return <Video className="h-6 w-6" />;
    default:
      return <FileText className="h-6 w-6" />;
  }
};

export default function LibraryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | MediaType>("all");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // Load channels for name mapping / filter
      const { data: chData } = await supabase.from("channels").select("id, name").order("name", { ascending: true });
      const channelMap = new Map<string, string>(
        (chData || []).map((c: Channel) => [c.id, c.name])
      );
      setChannels(chData || []);

      // Load library items
      const { data, error } = await supabase
        .from("library_items")
        .select("*")
        .order("date_added", { ascending: false });

      if (error) {
        console.error("Load library_items error:", error.message);
        setItems([]);
        setLoading(false);
        return;
      }

      const mapped: LibraryItem[] = (data as DbItem[]).map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description ?? "",
        type: row.type,
        url: row.url || "#",
        thumbnail: row.thumbnail_url || "/placeholder.svg",
        channelId: row.channel_id || "",
        channelName: row.channel_id ? (channelMap.get(row.channel_id) || row.channel_id) : "",
        dateAdded: row.date_added || "",
        fileSize: row.file_size_mb != null ? `${Number(row.file_size_mb).toFixed(2)} MB` : undefined,
        duration: formatDuration(row.duration_seconds),
      }));

      setItems(mapped);
      setLoading(false);
    })();
  }, []);

  const channelOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.channelName).filter(Boolean))).sort(),
    [items]
  );

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab = activeTab === "all" || item.type === activeTab;
    const matchesChannel = !selectedChannel || item.channelName === selectedChannel;

    return matchesSearch && matchesTab && matchesChannel;
  });

  return (
    <div className="container mx-auto px-4 py-8 mt-16">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Media Library</h1>
          <p className="text-gray-400">Access videos, audio, and documents from all channels</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search library..."
            className="pl-10 bg-gray-900 border-gray-700"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <select
            className="bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm"
            value={selectedChannel || ""}
            onChange={(e) => setSelectedChannel(e.target.value || null)}
          >
            <option value="">All Channels</option>
            {channelOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <Button variant="outline" className="flex items-center gap-2 bg-gray-800 border-gray-700">
            <Filter className="h-4 w-4" />
            <span>Filter</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mb-8">
        <TabsList className="bg-gray-900">
          <TabsTrigger value="all" className="data-[state=active]:bg-gray-800">All</TabsTrigger>
          <TabsTrigger value="video" className="data-[state=active]:bg-gray-800">Videos</TabsTrigger>
          <TabsTrigger value="audio" className="data-[state=active]:bg-gray-800">Audio</TabsTrigger>
          <TabsTrigger value="document" className="data-[state=active]:bg-gray-800">Documents</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-lg overflow-hidden">
              <Skeleton className="h-40 w-full" />
              <div className="p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredItems.map((item) => (
            <Link href={`/library/${item.id}`} key={item.id}>
              <div className="bg-gray-900 rounded-lg overflow-hidden transition-transform hover:scale-105 hover:shadow-xl">
                <div className="relative h-40">
                  <Image src={item.thumbnail || "/placeholder.svg"} alt={item.title} fill className="object-cover" />
                  <div className="absolute top-2 right-2 bg-black/70 p-1 rounded-md">{getMediaIcon(item.type)}</div>
                  {item.type === "video" && item.duration && (
                    <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 text-xs rounded-md">
                      {item.duration}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold mb-1 line-clamp-1">{item.title}</h3>
                  <p className="text-sm text-gray-400 mb-2 line-clamp-2">{item.description}</p>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>{item.channelName}</span>
                    <span>{item.type === "document" ? item.fileSize : ""}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-gray-900 mb-4">
            <Search className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No results found</h2>
          <p className="text-gray-400 max-w-md mx-auto">
            We couldn't find any media matching your search. Try adjusting your filters or search terms.
          </p>
        </div>
      )}
    </div>
  );
}
