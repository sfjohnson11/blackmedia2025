import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Allowlist of hostnames this proxy is permitted to fetch from.
 * This prevents the route from being used as an open proxy / SSRF relay
 * (e.g. pointing it at cloud metadata endpoints or internal services).
 *
 * The Supabase project host is derived from NEXT_PUBLIC_SUPABASE_URL.
 * Add any CDN / storage domains you legitimately serve video from.
 */
function buildAllowlist(): Set<string> {
  const hosts = new Set<string>()
  try {
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supaUrl) hosts.add(new URL(supaUrl).hostname)
  } catch {
    // ignore malformed env
  }
  // Add additional trusted media hosts here if needed, e.g.:
  // hosts.add("cdn.blacktruthtv.org")
  return hosts
}

const ALLOWED_HOSTS = buildAllowlist()

function isAllowed(rawUrl: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }
  // Only allow secure http(s) and only allowlisted hosts.
  if (parsed.protocol !== "https:") return false
  return ALLOWED_HOSTS.has(parsed.hostname)
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const videoUrl = searchParams.get("url")

  if (!videoUrl) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
  }

  if (!isAllowed(videoUrl)) {
    return NextResponse.json(
      { error: "URL host not allowed" },
      { status: 403 }
    )
  }

  try {
    const rangeHeader = request.headers.get("range")
    const upstreamHeaders = new Headers({
      "User-Agent": "btv-proxy/1.0",
    })
    if (rangeHeader) {
      upstreamHeaders.set("Range", rangeHeader)
    }

    const upstreamResponse = await fetch(videoUrl, {
      method: "GET",
      headers: upstreamHeaders,
      redirect: "error", // don't follow redirects off the allowlist
    })

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { error: `Upstream fetch failed: ${upstreamResponse.statusText}` },
        { status: upstreamResponse.status },
      )
    }

    const contentType = upstreamResponse.headers.get("content-type") || "application/octet-stream"
    const contentLength = upstreamResponse.headers.get("content-length")
    const acceptRanges = upstreamResponse.headers.get("accept-ranges") || "bytes"
    const transferEncoding = upstreamResponse.headers.get("transfer-encoding")

    const readableStream = upstreamResponse.body
    if (!readableStream) {
      return NextResponse.json({ error: "Failed to get readable stream from video source." }, { status: 500 })
    }

    const clientResponseHeaders = new Headers()
    clientResponseHeaders.set("Content-Type", contentType)
    clientResponseHeaders.set("Access-Control-Allow-Origin", "*")
    clientResponseHeaders.set("Accept-Ranges", acceptRanges)

    if (contentLength && upstreamResponse.status !== 206 && !transferEncoding) {
      clientResponseHeaders.set("Content-Length", contentLength)
    } else if (contentLength && upstreamResponse.status === 206) {
      clientResponseHeaders.set("Content-Length", contentLength)
    }

    if (upstreamResponse.status === 206 && upstreamResponse.headers.get("content-range")) {
      clientResponseHeaders.set("Content-Range", upstreamResponse.headers.get("content-range")!)
    }

    return new NextResponse(readableStream, {
      status: upstreamResponse.status,
      headers: clientResponseHeaders,
    })
  } catch (error: any) {
    return NextResponse.json({ error: "Proxy server error." }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Range",
    },
  })
}
