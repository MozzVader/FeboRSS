import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Cleanup old articles:
 * - Delete articles that are read AND not starred AND older than 30 days
 * - Unread articles and starred articles are preserved indefinitely
 */
export async function POST() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db.article.deleteMany({
      where: {
        isRead: true,
        isStarred: false,
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error("Error cleaning up articles:", error);
    return NextResponse.json(
      { error: "Error al limpiar articulos" },
      { status: 500 }
    );
  }
}
