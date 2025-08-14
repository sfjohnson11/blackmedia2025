"use client";

import { Suspense } from "react";
import { LoginForm } from "./_form";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <LoginForm />
    </Suspense>
  );
}
