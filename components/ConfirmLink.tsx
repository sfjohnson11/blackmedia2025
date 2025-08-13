// components/ConfirmLink.tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function ConfirmLink({
  href,
  label,
  confirmText = "Type RESET to continue.",
  require = "RESET",
  variant = "destructive",
  className = "w-full",
}: {
  href: string;
  label: string;
  confirmText?: string;
  require?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  className?: string;
}) {
  const router = useRouter();
  return (
    <Button
      className={className}
      variant={variant}
      onClick={() => {
        const v = prompt(confirmText);
        if ((v || "").toUpperCase() === require.toUpperCase()) {
          router.push(href);
        }
      }}
    >
      {label}
    </Button>
  );
}
