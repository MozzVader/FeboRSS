import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const categories = await db.category.findMany({
      orderBy: { position: "asc" },
      include: {
        _count: { select: { feeds: true } },
        feeds: {
          orderBy: { position: "asc" },
          include: {
            _count: { select: { articles: { where: { isRead: false } } } },
          },
        },
      },
    });

    return NextResponse.json(
      categories.map((c) => ({
        id: c.id,
        name: c.name,
        position: c.position,
        createdAt: c.createdAt,
        feedCount: c._count.feeds,
        feeds: c.feeds.map((f) => ({
          id: f.id,
          title: f.title,
          url: f.url,
          siteUrl: f.siteUrl,
          description: f.description,
          imageUrl: f.imageUrl,
          position: f.position,
          createdAt: f.createdAt,
          categoryId: f.categoryId,
          unreadCount: f._count.articles,
        })),
      }))
    );
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Error al obtener categorias" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Nombre requerido" },
        { status: 400 }
      );
    }

    const maxPosition = await db.category.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const category = await db.category.create({
      data: {
        name: name.trim(),
        position: (maxPosition?.position ?? -1) + 1,
      },
    });

    return NextResponse.json({
      id: category.id,
      name: category.name,
      position: category.position,
      feedCount: 0,
      feeds: [],
    });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Error al crear la categoria" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, name, position } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (position !== undefined) data.position = position;

    const category = await db.category.update({
      where: { id },
      data,
    });

    return NextResponse.json({ id: category.id, name: category.name });
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Error al actualizar la categoria" },
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

    await db.category.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { error: "Error al eliminar la categoria" },
      { status: 500 }
    );
  }
}