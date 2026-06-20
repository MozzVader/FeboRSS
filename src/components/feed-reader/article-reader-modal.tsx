"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/store/app";
import { useToast } from "@/hooks/use-toast";
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
  Link2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const FONT_SIZES = [13, 15, 17, 20];
const FONT_SIZE_KEY = "febo:articleFontSize";

function loadArticleFontSize(): number {
  if (typeof window === "undefined") return 15;
  try {
    const raw = localStorage.getItem(FONT_SIZE_KEY);
    if (raw) {
      const n = parseInt(raw, 10);
      if (FONT_SIZES.includes(n)) return n;
    }
  } catch { /* ignore */ }
  return 15;
}

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

function decodeAmp(url: string): string {
  return url.replace(/&amp;/g, '&');
}

function addTargetBlankToLinks(html: string): string {
  return html.replace(
    /<a\s+([^>]*?)href=["'][^"']*["']/gi,
    (match, attrs) => {
      // If it already has target="_blank", leave it as-is
      if (/\btarget\s*=\s*["']_blank["']/i.test(attrs)) return match;
      return `<a ${attrs}target="_blank" rel="noopener noreferrer"`;
    }
  );
}

export function ArticleReaderModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { selectedArticle, updateArticleLocal } = useAppStore();
  const { toast } = useToast();
  const [fontSize, setFontSize] = useState(loadArticleFontSize);

  useEffect(() => {
    try { localStorage.setItem(FONT_SIZE_KEY, String(fontSize)); } catch { /* ignore */ }
  }, [fontSize]);

  const changeFontSize = (delta: number) => {
    const idx = FONT_SIZES.indexOf(fontSize);
    const next = Math.max(0, Math.min(FONT_SIZES.length - 1, idx + delta));
    setFontSize(FONT_SIZES[next]);
  };

  const handleCopyLink = async () => {
    if (!selectedArticle) return;
    try {
      await navigator.clipboard.writeText(selectedArticle.url);
      toast({ title: "Link copiado al portapapeles" });
    } catch {
      try {
        const input = document.createElement("textarea");
        input.value = selectedArticle.url;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
        toast({ title: "Link copiado al portapapeles" });
      } catch {
        toast({ title: "No se pudo copiar el link", variant: "destructive" });
      }
    }
  };

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
      toast({
        title: newStarred ? "Agregado a favoritos" : "Quitado de favoritos",
      });
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
      // Reload feeds from server for accurate unread counts
      const feedsRes = await fetch("/api/feeds");
      const feedsData = await feedsRes.json();
      store.setFeeds(feedsData);
      toast({ title: "Todos marcados como leidos" });
    } catch {
      // silent
    }
  };

  if (!selectedArticle) return null;

  // Consider content as "real content" if it contains HTML tags (not just plain text)
  const hasHtmlContent =
    selectedArticle.content && /<\w+[^>]*>/.test(selectedArticle.content);

  // Detect Reddit feeds by checking the article's feed URL
  const isReddit = /reddit\.com/i.test(selectedArticle.url);

  // For Reddit: image is embedded inside content via transformRedditContent(),
  // so we never show a standalone image (avoids duplication).
  // For normal feeds: show standalone hero image only if it's not already in the content.
  const imageAlreadyInContent =
    hasHtmlContent &&
    selectedArticle.imageUrl &&
    // Normalize URLs for comparison (handle &amp; entities vs raw &)
    selectedArticle.content!.replace(/&amp;/g, "&").includes(
      selectedArticle.imageUrl.replace(/&amp;/g, "&")
    );

  const showStandaloneImage =
    !isReddit && selectedArticle.imageUrl && !imageAlreadyInContent;

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
              onClick={handleCopyLink}
              title="Copiar link"
            >
              <Link2 className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs font-mono"
              onClick={() => changeFontSize(-1)}
              disabled={FONT_SIZES.indexOf(fontSize) === 0}
              title="Reducir texto"
            >
              A-
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs font-mono"
              onClick={() => changeFontSize(1)}
              disabled={FONT_SIZES.indexOf(fontSize) === FONT_SIZES.length - 1}
              title="Aumentar texto"
            >
              A+
            </Button>
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
        <ScrollArea className="flex-1 min-h-0">
          <div className="max-w-3xl mx-auto px-6 py-6" style={{ fontSize: `${fontSize}px` }}>
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
                src={decodeAmp(selectedArticle.imageUrl)}
                alt=""
                className="w-full rounded-xl mb-6 bg-muted object-cover max-h-80"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}

            <Separator className="mb-6" />

            {hasHtmlContent ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-img:rounded-lg"
                style={{ fontSize: `${fontSize}px` }}
                dangerouslySetInnerHTML={{ __html: addTargetBlankToLinks(selectedArticle.content!) }}
              />
            ) : selectedArticle.summary ? (
              <div className="leading-relaxed text-muted-foreground space-y-4" style={{ fontSize: `${fontSize}px` }}>
                {stripHtml(selectedArticle.summary).split("\n").map((p, i) =>
                  p.trim() ? (
                    <p key={i}>{p.trim()}</p>
                  ) : null
                )}
              </div>
            ) : (
              <p className="text-muted-foreground italic" style={{ fontSize: `${fontSize}px` }}>
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