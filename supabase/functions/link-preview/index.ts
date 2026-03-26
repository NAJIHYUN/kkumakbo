const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeUrl(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function toAbsoluteUrl(base: string, value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return trimmed;
  }
}

function readMeta(html: string, key: string) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    const normalized = normalizeUrl(url);
    if (!normalized) {
      return Response.json({ error: "url is required" }, { status: 400, headers: corsHeaders });
    }

    const response = await fetch(normalized, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; ScoreboxLinkPreview/1.0)",
      },
    });

    const contentType = response.headers.get("content-type") || "";
    if (contentType.startsWith("image/")) {
      return Response.json(
        {
          url: normalized,
          title: "",
          image: normalized,
        },
        { headers: corsHeaders },
      );
    }

    const html = await response.text();
    const image = toAbsoluteUrl(normalized, readMeta(html, "og:image"));
    const title = readMeta(html, "og:title") || readMeta(html, "twitter:title");

    return Response.json(
      {
        url: normalized,
        title,
        image: image || "",
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "unexpected error" },
      { status: 500, headers: corsHeaders },
    );
  }
});
