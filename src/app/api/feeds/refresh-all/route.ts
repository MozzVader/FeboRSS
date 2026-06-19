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
          }
        }
      } catch (err) {
        console.error(`Error refreshing ${feed.url}:`, err);
      }
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