// app/debug/standby/standby-client.tsx
"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const ROOT = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const publicUrl = (bucket: string, key: string) =>
  `${ROOT}/storage/v1/object/public/${bucket}/${key.replace(/^\.?\//, "")}`;

function getStandbyUrlForChannel(ch: number) {
  return publicUrl(`channel${ch}`, "standby_blacktruthtv.mp4");
}

export default function ClientStandby() {
  const search = useSearchParams();
  const chParam = search?.get("ch") || "1";
  const ch = useMemo(() => {
    const n = Number(chParam.replace(/^0+/, "") || "0");
    return Number.isFinite(n) && n > 0 ? n : 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chParam]);

  const standby = getStandbyUrlForChannel(ch);
  const [src, setSrc] = useState(standby);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-black text-white p-4 space-y-4">
      <h1 className="text-xl font-bold">Standby Debug</h1>
      <div className="text-sm text-white/70">
        Channel: <b>{ch}</b> • URL: <code className="break-all">{src}</code>
      </div>

      <div className="w-full aspect-video bg-black grid place-items-center">
        {err ? (
          <div className="text-red-400">Error: {err}</div>
        ) : (
          <video
            className="w-full h-full"
            src={src}
            autoPlay
            muted
            playsInline
            controls
            onError={() =>
              setErr("Video failed to load (URL/permissions/MIME/CORS/range).")
            }
          >
            <source src={src} type="video/mp4" />
          </video>
        )}
      </div>

      <div className="text-xs text-white/60">
        Try <code>/debug/standby?ch=4</code>.
      </div>
    </div>
  );
}
