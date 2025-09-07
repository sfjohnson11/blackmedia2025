// app/debug/standby/page.tsx
import { Suspense } from "react";
import ClientStandby from "./standby-client";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white p-4">Loading…</div>}>
      <ClientStandby />
    </Suspense>
  );
}
