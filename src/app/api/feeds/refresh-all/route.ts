import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseFeedUrl, isRedditFeed } from "@/lib/rss";

export async function POST() {
  try {
    const feeds = await db.feed.findMany({ select: { id: true, url: true } });
    let totalNew = 0;

    for (const feed of feeds) {
      try {
        const parsed = await parseFeedUrl(feed.url);
        const reddit = isRedditFeed(feed.url);

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
          } else if (reddit) {
            // Reddit feeds: update existing articles missing imageUrl or content
            const updates: { imageUrl?: string; content?: string } = {};
            if (!existing.imageUrl && item.imageUrl) updates.imageUrl = item.imageUrl;
            if (!existing.content && item.content) updates.content = item.content;
            if (updates.imageUrl || updates.content) {
              await db.article.update({ where: { id: existing.id }, data: updates });
            }
          }
        }
      } catch (err) {
        console.error(`Error refreshing ${feed.url}:`, err);
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