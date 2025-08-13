// components/ClearCacheCard.tsx
"use client";

import { Trash2 } from "lucide-react";

export default function ClearCacheCard() {
  async function clearCache() {
    try {
      // Clear local/session
      localStorage?.clear?.();
      sessionStorage?.clear?.();

      // Clear Service Worker caches (if supported)
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }

      alert("Cache cleared. Please refresh.");
    } catch {
      alert("Cache cleared (local/session). Please refresh.");
    }
  }

  return (
    <div
      className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-colors h-full mt-8 cursor-pointer"
      onClick={clearCache}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Clear Cache</h3>
        <Trash2 className="h-6 w-6 text-red-500" />
      </div>
      <p className="text-gray-300 mb-4">
        Clear browser cache and local storage to fix issues with data not updating properly.
      </p>
      <div className="text-sm text-gray-400">
        Use when news items or other data aren't refreshing
      </div>
    </div>
  );
}
