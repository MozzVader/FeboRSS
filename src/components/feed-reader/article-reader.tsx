"use client";

import { useAppStore } from "@/store/app";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Star,
  ExternalLink,
  Clock,
  User,
  ArrowLeft,
  Rss,
  CheckCheck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: true,
      locale: es,
    });
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export function ArticleReader({
  onBack,
}: {
  onBack: () => void;
}) {
  const { selectedArticle, updateArticleLocal } = useAppStore();

  const handleToggleStar = async () => {
    if (!selectedArticle) return;
    const newStarred = !selectedArticle.isStarred;
    try {
      await fetch("/api/articles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedArticle.id, isStarred: newStarred }),
      });
      updateArticleLocal(selectedArticle.id, { isStarred: newStarred });
    } catch {
      // silent
    }
  };

  const handleMarkAllRead = async () => {
    if (!selectedArticle) return;
    try {
      await fetch("/api/articles/mark-all-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedId: selectedArticle.feedId }),
      });
      window.location.reload();
    } catch {
      // silent
    }
  };

  if (!selectedArticle) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 w-full p-8 text-center">
        <div className="text-6xl mb-4">📰</div>
        <h3 className="text-lg font-medium mb-1">Selecciona un articulo</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Elige un articulo de la lista para leerlo aqui.
        </p>
      </div>
    );
  }

  const hasContent =
    selectedArticle.content && selectedArticle.content !== selectedArticle.summary;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b bg-background">
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden text-xs gap-1"
          onClick={onBack}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver
        </Button>
        <div className="hidden md:block" />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleToggleStar}
            title={
              selectedArticle.isStarred
                ? "Quitar de favoritos"
                : "Agregar a favoritos"
            }
          >
            <Star
              className={`h-4 w-4 ${
                selectedArticle.isStarred
                  ? "text-amber-500 fill-amber-500"
                  : "text-muted-foreground"
              }`}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleMarkAllRead}
            title="Marcar todos como leidos"
          >
            <CheckCheck className="h-4 w-4 text-muted-foreground" />
          </Button>
          <a href={selectedArticle.url} target="_blank" rel="noopener noreferrer">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Abrir articulo original"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </Button>
          </a>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <article className="max-w-3xl mx-auto px-6 py-8">
          <header className="mb-6">
            <Badge
              variant="secondary"
              className="mb-3 text-xs gap-1"
            >
              <Rss className="h-3 w-3" />
              {selectedArticle.feedTitle}
            </Badge>
            <h1 className="text-2xl md:text-3xl font-bold leading-tight tracking-tight">
              {selectedArticle.title}
            </h1>
            <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground flex-wrap">
              {selectedArticle.author && (
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {selectedArticle.author}
                </span>
              )}
              {selectedArticle.publishedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDate(selectedArticle.publishedAt)}
                </span>
              )}
            </div>
          </header>

          {selectedArticle.imageUrl && (
            <img
              src={selectedArticle.imageUrl}
              alt=""
              className="w-full rounded-xl mb-6 bg-muted object-cover max-h-96"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}

          <Separator className="mb-6" />

          {hasContent ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-img:rounded-lg"
              dangerouslySetInnerHTML={{ __html: selectedArticle.content! }}
            />
          ) : selectedArticle.summary ? (
            <div className="text-sm leading-relaxed text-muted-foreground space-y-4">
              {stripHtml(selectedArticle.summary).split("\n").map((p, i) =>
                p.trim() ? (
                  <p key={i}>{p.trim()}</p>
                ) : null
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No hay contenido disponible. Abre el articulo original para leerlo completo.
            </p>
          )}

          <Separator className="my-8" />

          <a
            href={selectedArticle.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Leer articulo original
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </article>
      </ScrollArea>
    </div>
  );
}