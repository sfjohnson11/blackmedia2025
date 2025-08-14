// app/auth/login/page.tsx
"use client";

import { Suspense } from "react";
import LoginForm from "./_form"; // ⟵ default import (fix)

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <LoginForm />
    </Suspense>
  );
}
