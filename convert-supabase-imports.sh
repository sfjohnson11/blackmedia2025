#!/usr/bin/env bash
set -euo pipefail

echo "==> Finding files that import auth-helpers-nextjs..."
files=$(grep -rl "auth-helpers-nextjs" --include="*.ts" --include="*.tsx" . \
        | grep -v node_modules || true)

if [ -z "$files" ]; then
  echo "Nothing to convert."
  exit 0
fi

echo "==> Files queued for conversion:"
echo "$files"
echo ""

count=0
skipped=0

for file in $files; do
  if [[ "$file" == "./middleware.ts" ]]; then
    echo "SKIP   $file  (rewrite by hand)"
    skipped=$((skipped+1))
    continue
  fi

  echo "  ↳    $file"

  # Client Components
  sed -i 's|import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";|import { createClient } from "@/utils/supabase/client";|g' "$file"
  sed -i "s|import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';|import { createClient } from '@/utils/supabase/client';|g" "$file"
  sed -i 's|createClientComponentClient()|createClient()|g' "$file"

  # Server Components
  sed -i 's|import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";|import { createClient } from "@/utils/supabase/server";|g' "$file"
  sed -i "s|import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';|import { createClient } from '@/utils/supabase/server';|g" "$file"
  sed -i 's|createServerComponentClient({ cookies })|await createClient()|g' "$file"
  sed -i 's|createServerComponentClient({cookies})|await createClient()|g' "$file"

  # Route Handlers
  sed -i 's|import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";|import { createClient } from "@/utils/supabase/server";|g' "$file"
  sed -i "s|import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';|import { createClient } from '@/utils/supabase/server';|g" "$file"
  sed -i 's|createRouteHandlerClient({ cookies })|await createClient()|g' "$file"
  sed -i 's|createRouteHandlerClient({cookies})|await createClient()|g' "$file"

  count=$((count+1))
done

echo ""
echo "==> Done. Converted: $count    Skipped: $skipped"
