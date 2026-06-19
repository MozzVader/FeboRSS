import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseFeedUrl } from "@/lib/rss";

export async function POST(request: NextRequest) {
  try {
    const { feedId } = await request.json();

    if (!feedId) {
      return NextResponse.json(
        { error: "feedId requerido" },
        { status: 400 }
      );
    }

    const feed = await db.feed.findUnique({ where: { id: feedId } });
    if (!feed) {
      return NextResponse.json(
        { error: "Feed no encontrado" },
        { status: 404 }
      );
    }

    const parsed = await parseFeedUrl(feed.url);

    let newCount = 0;

    for (const item of parsed.items) {
      const existing = await db.article.findUnique({
        where: { feedId_url: { feedId, url: item.url } },
      });
      if (!existing) {
        await db.article.create({
          data: {
            feedId,
            title: item.title,
            url: item.url,
            content: item.content,
            summary: item.summary,
            author: item.author,
            imageUrl: item.imageUrl,
            publishedAt: item.publishedAt,
          },
        });
        newCount++;
      } else {
        // Backpatch: update existing articles with missing/incorrect data
        const updates: { imageUrl?: string; content?: string } = {};
        const existingHasHtml = existing.content && /<\w+[^>]*>/.test(existing.content);
        const newHasHtml = item.content && /<\w+[^>]*>/.test(item.content);

        // Update content if existing has no HTML but the feed now provides HTML
        if (!existingHasHtml && newHasHtml) updates.content = item.content;
        // Update imageUrl if missing
        if (!existing.imageUrl && item.imageUrl) updates.imageUrl = item.imageUrl;

        if (updates.imageUrl || updates.content) {
          await db.article.update({ where: { id: existing.id }, data: updates });
        }
      }
    }

    return NextResponse.json({
      success: true,
      newArticles: newCount,
      total: parsed.items.length,
    });
  } catch (error: unknown) {
    console.error("Error refreshing feed:", error);
    const message =
      error instanceof Error ? error.message : "Error al actualizar el feed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}