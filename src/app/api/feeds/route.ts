import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseFeedUrl } from "@/lib/rss";

export async function GET() {
  try {
    const feeds = await db.feed.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
      include: {
        _count: {
          select: { articles: { where: { isRead: false } } },
        },
      },
    });

    return NextResponse.json(
      feeds.map((f) => ({
        id: f.id,
        title: f.title,
        url: f.url,
        siteUrl: f.siteUrl,
        description: f.description,
        imageUrl: f.imageUrl,
        position: f.position,
        categoryId: f.categoryId,
        createdAt: f.createdAt,
        unreadCount: f._count.articles,
        lastError: f.lastError,
        lastRefresh: f.lastRefresh,
      }))
    );
  } catch (error) {
    console.error("Error fetching feeds:", error);
    return NextResponse.json(
      { error: "Error al obtener feeds" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url, categoryId } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL requerida" }, { status: 400 });
    }

    const existing = await db.feed.findUnique({ where: { url } });
    if (existing) {
      return NextResponse.json(
        { error: "Este feed ya existe" },
        { status: 409 }
      );
    }

    const parsed = await parseFeedUrl(url);

    const feed = await db.feed.create({
      data: {
        title: parsed.title,
        url,
        siteUrl: parsed.siteUrl,
        description: parsed.description,
        imageUrl: parsed.imageUrl,
        categoryId: categoryId || null,
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

    return NextResponse.json({ id: feed.id, title: feed.title });
  } catch (error: unknown) {
    console.error("Error adding feed:", error);
    const message =
      error instanceof Error ? error.message : "Error al agregar el feed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    await db.feed.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting feed:", error);
    return NextResponse.json(
      { error: "Error al eliminar el feed" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, title, url } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (typeof title === "string" && title.trim()) data.title = title.trim();
    if (typeof url === "string" && url.trim()) {
      // Check if another feed already has this URL
      const existing = await db.feed.findFirst({ where: { url: url.trim(), id: { not: id } } });
      if (existing) {
        return NextResponse.json({ error: "Otro feed ya tiene esa URL" }, { status: 409 });
      }
      data.url = url.trim();
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No se proporcionaron cambios" }, { status: 400 });
    }

    const feed = await db.feed.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      feed: { id: feed.id, title: feed.title, url: feed.url },
    });
  } catch (error) {
    console.error("Error updating feed:", error);
    return NextResponse.json(
      { error: "Error al actualizar el feed" },
      { status: 500 }
    );
  }
}