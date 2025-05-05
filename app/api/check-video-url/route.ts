import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "No URL provided" }, { status: 400 })
  }

  try {
    // Try to fetch the URL with a HEAD request first
    const headResponse = await fetch(url, {
      method: "HEAD",
      headers: {
        Accept: "*/*",
      },
    })

    // If HEAD request succeeds, return the response info
    if (headResponse.ok) {
      const headers: Record<string, string> = {}
      headResponse.headers.forEach((value, key) => {
        headers[key] = value
      })

      return NextResponse.json({
        status: headResponse.status,
        statusText: headResponse.statusText,
        headers,
        url: headResponse.url,
        redirected: headResponse.redirected,
        type: headResponse.type,
        ok: true,
      })
    }

    // If HEAD fails, try a GET request with range header to just get metadata
    const getResponse = await fetch(url, {
      headers: {
        Range: "bytes=0-1024", // Just get the first 1KB
        Accept: "*/*",
      },
    })

    const headers: Record<string, string> = {}
    getResponse.headers.forEach((value, key) => {
      headers[key] = value
    })

    return NextResponse.json({
      status: getResponse.status,
      statusText: getResponse.statusText,
      headers,
      url: getResponse.url,
      redirected: getResponse.redirected,
      type: getResponse.type,
      ok: getResponse.ok,
    })
  } catch (error) {
    // Return error details
    return NextResponse.json(
      {
        error: "Failed to fetch URL",
        message: error instanceof Error ? error.message : String(error),
        ok: false,
      },
      { status: 500 },
    )
  }
}
