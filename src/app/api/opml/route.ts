import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ─── GET: Export OPML ────────────────────────────────────────────────
export async function GET() {
  try {
    const categories = await db.category.findMany({
      orderBy: { position: "asc" },
      include: { feeds: { orderBy: { position: "asc" } } },
    });

    const uncategorizedFeeds = await db.feed.findMany({
      where: { categoryId: null },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    });

    function escapeXml(str: string): string {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    }

    let bodyLines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<opml version="2.0">',
      "  <head>",
      `    <title>FeboRSS Subscriptions</title>`,
      `    <dateCreated>${new Date().toISOString()}</dateCreated>`,
      "  </head>",
      "  <body>",
    ];

    for (const cat of categories) {
      bodyLines.push(`    <outline text="${escapeXml(cat.name)}" title="${escapeXml(cat.name)}">`);
      for (const feed of cat.feeds) {
        bodyLines.push(`      <outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(feed.title)}" xmlUrl="${escapeXml(feed.url)}" htmlUrl="${escapeXml(feed.siteUrl || "")}" />`);
      }
      bodyLines.push("    </outline>");
    }

    for (const feed of uncategorizedFeeds) {
      bodyLines.push(`    <outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(feed.title)}" xmlUrl="${escapeXml(feed.url)}" htmlUrl="${escapeXml(feed.siteUrl || "")}" />`);
    }

    bodyLines.push("  </body>", "</opml>");

    const xml = bodyLines.join("\n");

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": 'attachment; filename="feborss-subscriptions.opml"',
      },
    });
  } catch (error) {
    console.error("Error exporting OPML:", error);
    return NextResponse.json(
      { error: "Error al exportar OPML" },
      { status: 500 }
    );
  }
}

// ─── POST: Import OPML ───────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    const xml = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");

    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      return NextResponse.json(
        { error: "Archivo OPML inválido" },
        { status: 400 }
      );
    }

    // Collect categories and feeds from OPML structure
    // OPML format: <outline> can contain nested <outline type="rss"> for feeds
    // Categories are <outline> that contain other <outline> elements
    let imported = 0;
    let skipped = 0;

    const bodyOutlines = doc.querySelectorAll("body > outline");

    for (const outline of bodyOutlines) {
      const isRss =
        outline.getAttribute("type") === "rss" ||
        outline.getAttribute("xmlUrl");

      if (isRss) {
        // Top-level feed (no category)
        const xmlUrl = outline.getAttribute("xmlUrl");
        if (xmlUrl) {
          const result = await importFeed(xmlUrl, null);
          if (result.imported) imported++;
          else skipped++;
        }
      } else {
        // Category — create category first, then import its feeds
        const catName = outline.getAttribute("text") || outline.getAttribute("title") || "Imported";
        const category = await db.category.create({
          data: { name: catName },
        });

        const feedOutlines = outline.querySelectorAll(
          ":scope > outline[type=rss], :scope > outline[xmlUrl]"
        );

        for (const feedOutline of feedOutlines) {
          const feedUrl = feedOutline.getAttribute("xmlUrl");
          if (feedUrl) {
            const result = await importFeed(feedUrl, category.id);
            if (result.imported) imported++;
            else skipped++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: imported + skipped,
    });
  } catch (error) {
    console.error("Error importing OPML:", error);
    return NextResponse.json(
      { error: "Error al importar OPML" },
      { status: 500 }
    );
  }
}

async function importFeed(
  url: string,
  categoryId: string | null
): Promise<{ imported: boolean }> {
  // Check if already exists
  const existing = await db.feed.findUnique({ where: { url } });
  if (existing) return { imported: false };

  // Try to parse the feed to get its title
  const { parseFeedUrl } = await import("@/lib/rss");
  try {
    const parsed = await parseFeedUrl(url);

    await db.feed.create({
      data: {
        title: parsed.title,
        url,
        siteUrl: parsed.siteUrl,
        description: parsed.description,
        imageUrl: parsed.imageUrl,
        categoryId,
        articles: {
          create: parsed.items.slice(0, 50).map((item) => ({
            title: item.title,
            url: item.url,
            content: item.content,
            summary: item.summary,
            author: item.author,
            imageUrl: item.imageUrl,
            publishedAt: item.publishedAt,
          })),
        },
      },
    });

    return { imported: true };
  } catch {
    // Feed URL invalid or unreachable — skip
    return { imported: false };
  }
}
