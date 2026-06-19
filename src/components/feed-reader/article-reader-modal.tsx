"use client";

import { useAppStore } from "@/store/app";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Star,
  ExternalLink,
  Clock,
  User,
  Rss,
  CheckCheck,
  X,
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

export function ArticleReaderModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
      const store = useAppStore.getState();
      store.setArticles(
        store.articles.map((a) => ({ ...a, isRead: true })),
        store.nextCursor,
        0,
        store.starredCount
      );
      store.updateFeedUnread(selectedArticle.feedId, -999);
      const updatedFeeds = store.feeds.map((f) =>
        f.id === selectedArticle.feedId ? { ...f, unreadCount: 0 } : f
      );
      store.setFeeds(updatedFeeds);
    } catch {
      // silent
    }
  };

  if (!selectedArticle) return null;

  const hasContent =
    selectedArticle.content && selectedArticle.content !== selectedArticle.summary;

  // Avoid showing the same image twice: skip the standalone image if it's
  // already embedded inside the article content (e.g. Reddit transformed feeds)
  const imageAlreadyInContent =
    hasContent &&
    selectedArticle.imageUrl &&
    selectedArticle.content!.includes(selectedArticle.imageUrl);

  const showStandaloneImage =
    selectedArticle.imageUrl && !imageAlreadyInContent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-3xl h-[90vh] max-h-[900px] flex flex-col p-0 gap-0 rounded-xl overflow-hidden [&>button]:top-3 [&>button]:right-3"
        showCloseButton={false}
      >
        {/* Visually hidden for a11y */}
        <DialogTitle className="sr-only">{selectedArticle.title}</DialogTitle>
        <DialogDescription className="sr-only">
          Articulo de {selectedArticle.feedTitle}
        </DialogDescription>

        {/* Modal header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="secondary" className="text-xs gap-1 shrink-0">
              <Rss className="h-3 w-3" />
              <span className="truncate max-w-[160px]">{selectedArticle.feedTitle}</span>
            </Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Clock className="h-3 w-3" />
              {formatDate(selectedArticle.publishedAt)}
            </span>
            {selectedArticle.author && (
              <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <User className="h-3 w-3" />
                {selectedArticle.author}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
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
            <a
              href={selectedArticle.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Abrir articulo original"
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </Button>
            </a>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
              title="Cerrar"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* Scrollable article content */}
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto px-6 py-6">
            <h1 className="text-xl md:text-2xl font-bold leading-tight tracking-tight mb-4">
              {selectedArticle.title}
            </h1>

            {/* Mobile metadata (shown below title on small screens) */}
            <div className="flex sm:hidden items-center gap-2 text-xs text-muted-foreground mb-4">
              {selectedArticle.author && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {selectedArticle.author}
                </span>
              )}
            </div>

            {showStandaloneImage && (
              <img
                src={selectedArticle.imageUrl}
                alt=""
                className="w-full rounded-xl mb-6 bg-muted object-cover max-h-80"
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
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}