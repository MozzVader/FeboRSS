import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const feedId = searchParams.get("feedId");
    const onlyUnread = searchParams.get("unread") === "true";
    const onlyStarred = searchParams.get("starred") === "true";
    const search = searchParams.get("search");
    const cursor = searchParams.get("cursor");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const where: Record<string, unknown> = {};

    if (feedId) where.feedId = feedId;
    const feedIds = searchParams.get("feedIds");
    if (feedIds) where.feedId = { in: feedIds.split(",") };
    if (onlyUnread) where.isRead = false;
    if (onlyStarred) where.isStarred = true;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { summary: { contains: search } },
        { author: { contains: search } },
      ];
    }

    const articles = await db.article.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: limit + 1,
      skip: cursor ? 1 : 0,
      ...(cursor ? { cursor: { id: cursor } } : {}),
      include: { feed: { select: { id: true, title: true, imageUrl: true } } },
    });

    let nextCursor: string | null = null;
    if (articles.length > limit) {
      const next = articles.pop();
      nextCursor = next!.id;
    }

    const unreadCount = await db.article.count({ where: { isRead: false } });
    const starredCount = await db.article.count({ where: { isStarred: true } });

    return NextResponse.json({
      articles: articles.map((a) => ({
        id: a.id,
        feedId: a.feedId,
        feedTitle: a.feed.title,
        feedImageUrl: a.feed.imageUrl,
        title: a.title,
        url: a.url,
        content: a.content,
        summary: a.summary,
        author: a.author,
        imageUrl: a.imageUrl,
        publishedAt: a.publishedAt,
        isRead: a.isRead,
        isStarred: a.isStarred,
      })),
      nextCursor,
      unreadCount,
      starredCount,
    });
  } catch (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json(
      { error: "Error al obtener articulos" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, isRead, isStarred } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (typeof isRead === "boolean") data.isRead = isRead;
    if (typeof isStarred === "boolean") data.isStarred = isStarred;

    const article = await db.article.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, article: { id: article.id } });
  } catch (error) {
    console.error("Error updating article:", error);
    return NextResponse.json(
      { error: "Error al actualizar el articulo" },
      { status: 500 }
    );
  }
}