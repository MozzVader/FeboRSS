import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { feeds } = body as {
      feeds: { id: string; categoryId: string | null; position: number }[];
    };

    if (!feeds || !Array.isArray(feeds)) {
      return NextResponse.json(
        { error: "Se requiere un array de feeds" },
        { status: 400 }
      );
    }

    for (const feed of feeds) {
      await db.feed.update({
        where: { id: feed.id },
        data: {
          categoryId: feed.categoryId,
          position: feed.position,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error moving feeds:", error);
    return NextResponse.json(
      { error: "Error al mover feeds" },
      { status: 500 }
    );
  }
}