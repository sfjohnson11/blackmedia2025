import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const videoUrl = searchParams.get("url")

  if (!videoUrl) {
    console.error("CORS Proxy V5: URL parameter is missing.")
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
  }
  console.log(`CORS Proxy V5: Attempting to fetch: ${videoUrl}`)

  try {
    // Pass through Range header if client sends it
    const rangeHeader = request.headers.get("range")
    const upstreamHeaders = new Headers({
      "User-Agent": "v0-proxy-fetcher/1.0.1", // Slightly updated UA
    })
    if (rangeHeader) {
      console.log(`CORS Proxy V5: Forwarding Range header: ${rangeHeader}`)
      upstreamHeaders.set("Range", rangeHeader)
    }

    const upstreamResponse = await fetch(videoUrl, {
      method: "GET",
      headers: upstreamHeaders,
    })

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text().catch(() => "Upstream error body unreadable")
      console.error(
        `CORS Proxy V5: Upstream fetch failed. URL: ${videoUrl}, Status: ${upstreamResponse.status}, Body: ${errorText}`,
      )
      return NextResponse.json(
        { error: `Upstream fetch failed: ${upstreamResponse.statusText}` },
        { status: upstreamResponse.status },
      )
    }

    const contentType = upstreamResponse.headers.get("content-type") || "application/octet-stream"
    const contentLength = upstreamResponse.headers.get("content-length")
    const acceptRanges = upstreamResponse.headers.get("accept-ranges") || "bytes"
    const transferEncoding = upstreamResponse.headers.get("transfer-encoding")

    console.log(
      `CORS Proxy V5: Upstream response. Status: ${upstreamResponse.status}, Content-Type: ${contentType}, Content-Length: ${contentLength || "N/A"}, Accept-Ranges: ${acceptRanges}, Transfer-Encoding: ${transferEncoding || "N/A"}`,
    )

    const readableStream = upstreamResponse.body
    if (!readableStream) {
      console.error("CORS Proxy V5: No readable stream in upstream response body for URL:", videoUrl)
      return NextResponse.json({ error: "Failed to get readable stream from video source." }, { status: 500 })
    }

    // Prepare headers for the client response
    const clientResponseHeaders = new Headers()
    clientResponseHeaders.set("Content-Type", contentType)
    clientResponseHeaders.set("Access-Control-Allow-Origin", "*")
    clientResponseHeaders.set("Accept-Ranges", acceptRanges) // Pass this along

    // Handle Content-Length carefully:
    // - If upstream sent Content-Length AND it's not a partial content response (206), pass it.
    // - If it's a 206 (Partial Content), Content-Length will be for the partial content.
    // - If upstream is using chunked encoding, Content-Length should NOT be set.
    if (contentLength && upstreamResponse.status !== 206 && !transferEncoding) {
      clientResponseHeaders.set("Content-Length", contentLength)
    } else if (contentLength && upstreamResponse.status === 206) {
      // For 206, Content-Length is for the chunk, so it's fine
      clientResponseHeaders.set("Content-Length", contentLength)
    }

    // If upstream uses chunked encoding, reflect that if possible (though Next.js might handle this)
    if (transferEncoding === "chunked") {
      // Note: Next.js server might automatically handle chunked encoding based on the stream
      // and might strip this header. This is more of an informational passthrough.
      // clientResponseHeaders.set("Transfer-Encoding", "chunked");
    }

    // Pass through Content-Range if it's a partial content response
    if (upstreamResponse.status === 206 && upstreamResponse.headers.get("content-range")) {
      clientResponseHeaders.set("Content-Range", upstreamResponse.headers.get("content-range")!)
    }

    return new NextResponse(readableStream, {
      status: upstreamResponse.status, // Pass through the original status (e.g., 200 or 206)
      headers: clientResponseHeaders,
    })
  } catch (error: any) {
    console.error(`CORS Proxy V5: Exception for ${videoUrl}:`, error.message, error.stack)
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
