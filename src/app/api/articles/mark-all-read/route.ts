import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { feedId } = await request.json();

    const where: Record<string, unknown> = { isRead: false };
    if (feedId) where.feedId = feedId;

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