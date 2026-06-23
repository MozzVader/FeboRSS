import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { feedId, categoryId } = await request.json();

    const where: Record<string, unknown> = { isRead: false };
    if (feedId) {
      where.feedId = feedId;
    } else if (categoryId) {
      const feedsInCategory = await db.feed.findMany({
        where: { categoryId },
        select: { id: true },
      });
      where.feedId = { in: feedsInCategory.map((f) => f.id) };
    }

    const result = await db.article.updateMany({
      where,
      data: { isRead: true },
    });

    return NextResponse.json({
      success: true,
      updated: result.count,
    });
  } catch (error) {
    console.error("Error marking all as read:", error);
    return NextResponse.json(
      { error: "Error al marcar como leidos" },
      { status: 500 }
    );
  }
}