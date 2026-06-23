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

    const where: Record<string, unknown> = { isHidden: false };

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

    // Exclude NSFW feeds from global views ("Todos", "No leídos")
    // but allow in "Favoritos" — if user starred it, they want to see it
    // unless a specific feed or category is selected
    const excludeNsfw = !feedId && !feedIds && !onlyStarred;
    let nsfwFeedIds: { id: string }[] = [];
    if (excludeNsfw) {
      nsfwFeedIds = await db.feed.findMany({
        where: { isNsfw: true },
        select: { id: true },
      });
      if (nsfwFeedIds.length > 0) {
        where.feedId = {
          ...(typeof where.feedId === "object" ? where.feedId : {}),
          notIn: nsfwFeedIds.map((f) => f.id),
        };
      }
    }

    // Always fetch NSFW feed IDs for global unread count (badge must always exclude NSFW)
    if (nsfwFeedIds.length === 0) {
      nsfwFeedIds = await db.feed.findMany({
        where: { isNsfw: true },
        select: { id: true },
      });
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

    // Global unread count ALWAYS excludes NSFW feeds
    const unreadCountWhere: Record<string, unknown> = { isRead: false, isHidden: false };
    if (nsfwFeedIds.length > 0) {
      unreadCountWhere.feedId = { notIn: nsfwFeedIds.map((f) => f.id) };
    }

    const unreadCount = await db.article.count({
      where: unreadCountWhere,
    });
    const starredCount = await db.article.count({
      where: { isStarred: true, isHidden: false },
    });

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

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const article = await db.article.findUnique({
      where: { id },
      select: { id: true, isRead: true, feedId: true },
    });

    if (!article) {
      return NextResponse.json({ error: "Articulo no encontrado" }, { status: 404 });
    }

    await db.article.update({
      where: { id },
      data: { isHidden: true },
    });

    return NextResponse.json({
      success: true,
      article: { id: article.id, feedId: article.feedId, wasUnread: !article.isRead },
    });
  } catch (error) {
    console.error("Error deleting article:", error);
    return NextResponse.json(
      { error: "Error al eliminar el articulo" },
      { status: 500 }
    );
  }
}