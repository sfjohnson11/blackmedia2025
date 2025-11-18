// app/freedom-school/page.tsx
import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import FreedomSchoolClient, {
  type FSAsset,
  classifyType,
} from "./FreedomSchoolClient";

export const metadata: Metadata = {
  title: "Freedom School | Black Truth TV",
  description: "Our virtual classroom is always open.",
};

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function FreedomSchoolPage() {
  let initialAssets: FSAsset[] = [];
  let storageError: string | null = null;

  try {
    const { data, error } = await supabase.storage
      .from("freedom-school")
      .list("", { limit: 1000 });

    if (error) {
      console.error("Error listing freedom-school bucket", error);
      storageError = error.message;
    } else if (data) {
      initialAssets = data
        .filter((f) => !f.name.startsWith(".")) // ignore hidden
        .map((f) => {
          const { data: urlData } = supabase.storage
            .from("freedom-school")
            .getPublicUrl(f.name);

          return {
            name: f.name,
            publicUrl: urlData.publicUrl,
            type: classifyType(f.name),
          } as FSAsset;
        });
    }
  } catch (e: any) {
    console.error("Unexpected error loading Freedom School assets", e);
    storageError = e?.message || "Unexpected error loading Freedom School assets.";
  }

  return (
    <FreedomSchoolClient
      initialAssets={initialAssets}
      storageError={storageError}
    />
  );
}
