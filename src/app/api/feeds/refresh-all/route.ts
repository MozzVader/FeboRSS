import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseFeedUrl } from "@/lib/rss";

export async function POST() {
  try {
    const feeds = await db.feed.findMany({ select: { id: true, url: true } });
    let totalNew = 0;

    for (const feed of feeds) {
      try {
        const parsed = await parseFeedUrl(feed.url);

        for (const item of parsed.items) {
          const existing = await db.article.findUnique({
            where: { feedId_url: { feedId: feed.id, url: item.url } },
          });
          if (!existing) {
            await db.article.create({
              data: {
                feedId: feed.id,
                title: item.title,
                url: item.url,
                content: item.content,
                summary: item.summary,
                author: item.author,
                imageUrl: item.imageUrl,
                publishedAt: item.publishedAt,
              },
            });
            totalNew++;
          } else {
            // Backpatch: update existing articles with missing/incorrect data
            const updates: { imageUrl?: string; content?: string } = {};
            const existingHasHtml = existing.content && /<\w+[^>]*>/.test(existing.content);
            const newHasHtml = item.content && /<\w+[^>]*>/.test(item.content);

            if (!existingHasHtml && newHasHtml) updates.content = item.content;
            if (!existing.imageUrl && item.imageUrl) updates.imageUrl = item.imageUrl;

            if (updates.imageUrl || updates.content) {
              await db.article.update({ where: { id: existing.id }, data: updates });
            }
          }
        }

        // Clear error on successful refresh
        await db.feed.update({
          where: { id: feed.id },
          data: { lastError: null, lastRefresh: new Date() },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        console.error(`Error refreshing ${feed.url}:`, err);
        await db.feed.update({
          where: { id: feed.id },
          data: { lastError: message, lastRefresh: new Date() },
        }).catch(() => {});
      }
    }

    // Cleanup: delete read articles older than 30 days (except starred)
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      await db.article.deleteMany({
        where: {
          isRead: true,
          isStarred: false,
          createdAt: { lt: thirtyDaysAgo },
        },
      });
    } catch (err) {
      console.error("Error during cleanup:", err);
    }

    return NextResponse.json({ success: true, newArticles: totalNew });
  } catch (error) {
    console.error("Error refreshing all feeds:", error);
    return NextResponse.json(
      { error: "Error al actualizar los feeds" },
      { status: 500 }
    );
  }
}