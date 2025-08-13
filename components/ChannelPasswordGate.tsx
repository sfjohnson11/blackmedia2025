"use client";
import { useState } from "react";

export default function ChannelPasswordGate({ channelKey }: { channelKey: string }) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/channel-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelKey, passcode }),
    });
    const json = await res.json();
    if (json.ok) {
      window.location.reload();
    } else {
      setError("Incorrect passcode.");
    }
  }

  return (
    <div className="mx-auto mt-12 max-w-sm rounded-2xl border border-gray-700 bg-gray-800 p-6 shadow">
      <h2 className="mb-2 text-xl font-semibold">This channel is protected</h2>
      <p className="mb-4 text-sm text-gray-400">Enter the passcode to continue.</p>
      <form onSubmit={submit}>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Passcode"
          className="mb-3 w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2"
        />
        {error && <div className="mb-3 text-sm text-red-400">{error}</div>}
        <button className="w-full rounded-md bg-red-600 px-3 py-2 text-white hover:bg-red-700">
          Unlock
        </button>
      </form>
    </div>
  );
}
