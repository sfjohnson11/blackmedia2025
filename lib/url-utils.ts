export function getFullUrl(path: string): string {
  if (!path) return ''
  if (path.startsWith('http')) return path

  const baseUrl = 'https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public'
  const cleanPath = path.replace(/^\/+/g, '').replace(/\/+/g, '/')

  return `${baseUrl}/${cleanPath}`
}
