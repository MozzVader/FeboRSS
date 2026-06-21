import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseFeedUrl, isRedditFeed } from "@/lib/rss";

/** Delay helper — Reddit rate limits aggressively (429) */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST() {
  try {
    const feeds = await db.feed.findMany({ select: { id: true, url: true, title: true, notifyEnabled: true } });
    let totalNew = 0;
    const newPerFeed: { feedId: string; feedTitle: string; notifyEnabled: boolean; count: number }[] = [];

    // Separate Reddit feeds to stagger them with delays
    const redditFeeds = feeds.filter((f) => isRedditFeed(f.url));
    const otherFeeds = feeds.filter((f) => !isRedditFeed(f.url));

    // Process non-Reddit feeds first (no delay needed)
    for (const feed of otherFeeds) {
      try {
        const result = await processFeed(feed);
        totalNew += result.newCount;
        if (result.newCount > 0) {
          newPerFeed.push({ feedId: feed.id, feedTitle: feed.title, notifyEnabled: feed.notifyEnabled, count: result.newCount });
        }
      } catch (err) {
        await handleFeedError(feed, err);
      }
    }

    // Process Reddit feeds with staggered delays (3s between each)
    for (let i = 0; i < redditFeeds.length; i++) {
      const feed = redditFeeds[i];
      try {
        if (i > 0) await sleep(3000);
        const result = await processFeed(feed);
        totalNew += result.newCount;
        if (result.newCount > 0) {
          newPerFeed.push({ feedId: feed.id, feedTitle: feed.title, notifyEnabled: feed.notifyEnabled, count: result.newCount });
        }
      } catch (err) {
        await handleFeedError(feed, err);
      }
    }

    // Cleanup: delete read+unstarred articles older than 30 days, and hidden articles
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      await db.article.deleteMany({
        where: {
          OR: [
            { isRead: true, isStarred: false, createdAt: { lt: thirtyDaysAgo } },
            { isHidden: true, createdAt: { lt: thirtyDaysAgo } },
          ],
        },
      });
    } catch (err) {
      console.error("Error during cleanup:", err);
    }

    return NextResponse.json({ success: true, newArticles: totalNew, newPerFeed });
  } catch (error) {
    console.error("Error refreshing all feeds:", error);
    return NextResponse.json(
      { error: "Error al actualizar los feeds" },
      { status: 500 }
    );
  }
}

type FeedRow = { id: string; url: string; title: string; notifyEnabled: boolean };

async function processFeed(feed: FeedRow) {
  const parsed = await parseFeedUrl(feed.url);
  let newCount = 0;

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
      newCount++;
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

  return { newCount };
}

async function handleFeedError(feed: FeedRow, err: unknown) {
  const message = err instanceof Error ? err.message : "Error desconocido";
  console.error(`Error refreshing ${feed.url}:`, err);
  await db.feed.update({
    where: { id: feed.id },
    data: { lastError: message, lastRefresh: new Date() },
  }).catch(() => {});
}