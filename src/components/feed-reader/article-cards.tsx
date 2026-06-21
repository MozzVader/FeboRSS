"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/store/app";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Star, Clock, User, CheckCheck, Eye, EyeOff, Link2, Trash2 } from "lucide-react";
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

function decodeAmp(url: string): string {
  return url.replace(/&amp;/g, '&');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function getReadingTime(content: string | null, summary: string | null): string | null {
  const text = content ? stripHtml(content) : summary ? stripHtml(summary) : "";
  if (!text) return null;
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 60) return null; // Too short to show
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min`;
}

function CardSkeleton() {
  return (
    <div className="p-4">
      <div className="flex gap-4">
        <Skeleton className="h-28 w-28 lg:h-32 lg:w-32 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-3 py-1">
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CompactSkeleton() {
  return (
    <div className="px-4 py-2.5 flex items-center gap-3">
      <Skeleton className="h-2 w-2 rounded-full" />
      <Skeleton className="h-4 flex-1 max-w-[50%]" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function ArticleCards() {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { toast } = useToast();

  const {
    articles,
    selectedArticle,
    selectedFeedId,
    selectedCategoryId,
    filter,
    search,
    nextCursor,
    isLoadingArticles,
    focusedArticleId,
    viewMode,
    selectArticle,
    updateArticleLocal,
    appendArticles,
    setIsLoadingArticles,
    feeds,
  } = useAppStore();

  const fetchArticles = useCallback(
    async (cursor?: string) => {
      setIsLoadingArticles(true);
      try {
        const params = new URLSearchParams();
        if (selectedFeedId) params.set("feedId", selectedFeedId);
        if (selectedCategoryId) {
          const catFeeds = feeds.filter((f) => f.categoryId === selectedCategoryId);
          params.set("feedIds", catFeeds.map((f) => f.id).join(","));
        }
        if (filter === "unread") params.set("unread", "true");
        if (filter === "starred") params.set("starred", "true");
        if (search) params.set("search", search);
        if (cursor) params.set("cursor", cursor);
        params.set("limit", "20");

        const res = await fetch(`/api/articles?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        if (cursor) {
          appendArticles(data.articles, data.nextCursor);
        } else {
          useAppStore.getState().setArticles(
            data.articles,
            data.nextCursor,
            data.unreadCount,
            data.starredCount
          );
        }
      } catch (err) {
        console.error("Error fetching articles:", err);
      } finally {
        setIsLoadingArticles(false);
      }
    },
    [selectedFeedId, selectedCategoryId, filter, search, feeds, appendArticles, setIsLoadingArticles]
  );

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  useEffect(() => {
    if (!nextCursor || !sentinelRef.current) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !isLoadingArticles) {
          fetchArticles(nextCursor);
        }
      },
      { rootMargin: "200px" }
    );
    observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [nextCursor, isLoadingArticles, fetchArticles]);

  // Scroll focused article into view
  useEffect(() => {
    if (!focusedArticleId) return;
    const el = document.querySelector(
      `[data-article-id="${focusedArticleId}"]`
    );
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [focusedArticleId]);

  const handleSelectArticle = async (article: (typeof articles)[0]) => {
    selectArticle(article);
    if (!article.isRead) {
      try {
        await fetch("/api/articles", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: article.id, isRead: true }),
        });
        updateArticleLocal(article.id, { isRead: true });
        useAppStore.getState().decrementUnreadCount(-1);
        useAppStore.getState().updateFeedUnread(article.feedId, -1);
        toast({ title: "Marcado como leido" });
      } catch {
        // silent
      }
    }
  };

  const handleToggleStar = async (
    e: React.MouseEvent,
    article: (typeof articles)[0]
  ) => {
    e.stopPropagation();
    const newStarred = !article.isStarred;
    try {
      await fetch("/api/articles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: article.id, isStarred: newStarred }),
      });
      updateArticleLocal(article.id, { isStarred: newStarred });
      toast({
        title: newStarred ? "Agregado a favoritos" : "Quitado de favoritos",
      });
    } catch {
      // silent
    }
  };

  const handleToggleStarFromMenu = async (article: (typeof articles)[0]) => {
    const newStarred = !article.isStarred;
    try {
      await fetch("/api/articles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: article.id, isStarred: newStarred }),
      });
      updateArticleLocal(article.id, { isStarred: newStarred });
      toast({
        title: newStarred ? "Agregado a favoritos" : "Quitado de favoritos",
      });
    } catch {
      // silent
    }
  };

  const handleToggleRead = async (article: (typeof articles)[0]) => {
    const newRead = !article.isRead;
    try {
      await fetch("/api/articles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: article.id, isRead: newRead }),
      });
      updateArticleLocal(article.id, { isRead: newRead });
      useAppStore.getState().decrementUnreadCount(newRead ? -1 : 1);
      useAppStore.getState().updateFeedUnread(article.feedId, newRead ? -1 : 1);
      toast({
        title: newRead ? "Marcado como leido" : "Marcado como no leido",
      });
    } catch {
      // silent
    }
  };

  const handleCopyLink = async (article: (typeof articles)[0]) => {
    try {
      await navigator.clipboard.writeText(article.url);
      toast({ title: "Link copiado al portapapeles" });
    } catch {
      // Fallback for older browsers
      try {
        const input = document.createElement("textarea");
        input.value = article.url;
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

  const handleMarkFeedRead = async (feedId: string) => {
    try {
      await fetch("/api/articles/mark-all-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedId }),
      });
      const store = useAppStore.getState();
      store.setArticles(
        store.articles.map((a) => a.feedId === feedId ? { ...a, isRead: true } : a),
        store.nextCursor,
        0,
        store.starredCount
      );
      const feedsRes = await fetch("/api/feeds");
      const feedsData = await feedsRes.json();
      store.setFeeds(feedsData);
      const catsRes = await fetch("/api/categories");
      const catsData = await catsRes.json();
      store.setCategories(catsData);
      toast({ title: "Todos marcados como leidos" });
    } catch {
      // silent
    }
  };

  const handleDeleteArticle = async (article: (typeof articles)[0]) => {
    try {
      const res = await fetch("/api/articles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: article.id }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      const store = useAppStore.getState();
      store.removeArticleLocal(article.id);
      if (data.article.wasUnread) {
        store.decrementUnreadCount(-1);
        store.updateFeedUnread(article.feedId, -1);
      }
      toast({ title: "Articulo eliminado" });
    } catch {
      toast({ title: "Error al eliminar articulo", variant: "destructive" });
    }
  };

  if (articles.length === 0 && !isLoadingArticles) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 w-full p-8 text-center">
        <div className="text-5xl mb-4">📭</div>
        <h3 className="text-lg font-medium mb-1">Sin articulos</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {search
            ? "No se encontraron articulos con esa busqueda."
            : filter === "unread"
            ? "Todos los articulos estan leidos."
            : filter === "starred"
            ? "No tienes articulos favoritos todavia."
            : "Agrega un feed RSS para empezar a leer."}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className={viewMode === "compact" ? "divide-y" : "max-w-4xl mx-auto py-3 px-3 md:px-6 space-y-2"}>
        {articles.map((article) => {
          const isSelected = selectedArticle?.id === article.id;
          const readingTime = viewMode === "cards" ? getReadingTime(article.content, article.summary) : null;

          // ─── Compact view: single-row line item ───
          if (viewMode === "compact") {
            const compactContent = (
              <article
                data-article-id={article.id}
                onClick={() => handleSelectArticle(article)}
                onKeyDown={(e) => e.key === "Enter" && handleSelectArticle(article)}
                role="button"
                tabIndex={0}
                className={`group flex items-center gap-3 px-4 py-2.5 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected
                    ? "bg-accent/40"
                    : focusedArticleId === article.id
                      ? "bg-accent/20 ring-1 ring-primary/20"
                      : "hover:bg-accent/50"
                }`}
              >
                {/* Unread dot */}
                {!article.isRead && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                )}
                {article.isRead && (
                  <div className="w-2" />
                )}

                {/* Title */}
                <h3
                  className={`flex-1 text-[13px] leading-snug truncate ${
                    !article.isRead
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {article.title}
                </h3>

                {/* Feed name */}
                <span className="text-[11px] text-muted-foreground shrink-0 max-w-[120px] truncate">
                  {article.feedTitle}
                </span>

                {/* Date */}
                {article.publishedAt && (
                  <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(article.publishedAt)}
                  </span>
                )}

                {/* Star */}
                <button
                  onClick={(e) => handleToggleStar(e, article)}
                  className={`p-1 rounded transition-colors cursor-pointer flex-shrink-0 ${
                    article.isStarred
                      ? "text-amber-500"
                      : "opacity-0 group-hover:opacity-40 hover:!opacity-100 text-muted-foreground"
                  }`}
                  title={article.isStarred ? "Quitar de favoritos" : "Agregar a favoritos"}
                >
                  <Star
                    className="h-3.5 w-3.5"
                    fill={article.isStarred ? "currentColor" : "none"}
                  />
                </button>
              </article>
            );

            return (
              <ContextMenu key={article.id}>
                <ContextMenuTrigger asChild>
                  {compactContent}
                </ContextMenuTrigger>
                <ContextMenuContent>
                  {article.isRead ? (
                    <ContextMenuItem onClick={() => handleToggleRead(article)} className="gap-2">
                      <Eye className="h-4 w-4" />
                      Marcar como no leido
                    </ContextMenuItem>
                  ) : (
                    <ContextMenuItem onClick={() => handleToggleRead(article)} className="gap-2">
                      <EyeOff className="h-4 w-4" />
                      Marcar como leido
                    </ContextMenuItem>
                  )}
                  <ContextMenuItem
                    onClick={() => handleToggleStarFromMenu(article)}
                    className="gap-2"
                  >
                    <Star className={`h-4 w-4 ${article.isStarred ? "fill-amber-500 text-amber-500" : ""}`} />
                    {article.isStarred ? "Quitar de favoritos" : "Agregar a favoritos"}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleCopyLink(article)} className="gap-2">
                    <Link2 className="h-4 w-4" />
                    Copiar link
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => handleMarkFeedRead(article.feedId)} className="gap-2">
                    <CheckCheck className="h-4 w-4" />
                    Marcar todo el feed como leido
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => handleDeleteArticle(article)} className="gap-2 text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4" />
                    Eliminar articulo
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          }

          // ─── Cards view (default) ───
          const cardContent = (
            <article
              data-article-id={article.id}
              onClick={() => handleSelectArticle(article)}
              onKeyDown={(e) => e.key === "Enter" && handleSelectArticle(article)}
              role="button"
              tabIndex={0}
              className={`group relative rounded-xl border transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isSelected
                  ? "border-primary/40 bg-accent/30 shadow-sm"
                  : focusedArticleId === article.id
                    ? "border-primary/30 bg-accent/20 ring-1 ring-primary/20"
                    : "border-border/60 bg-card hover:border-border hover:shadow-sm"
              } ${!article.isRead ? "" : "opacity-80"}`}
            >
              <div className="flex gap-4 p-4">
                {/* Thumbnail */}
                {article.imageUrl ? (
                  <div className="hidden sm:block flex-shrink-0">
                    <img
                      src={decodeAmp(article.imageUrl)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-28 w-28 lg:h-32 lg:w-32 rounded-lg object-cover bg-muted"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                ) : null}

                {/* Content */}
                <div className="flex-1 min-w-0 py-0.5">
                  {/* Unread dot + Title */}
                  <div className="flex items-start gap-2">
                    {!article.isRead && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    )}
                    <h3
                      className={`text-[15px] leading-snug line-clamp-2 flex-1 ${
                        !article.isRead
                          ? "font-semibold text-foreground"
                          : "font-medium text-foreground/80"
                      }`}
                    >
                      {article.title}
                    </h3>
                  </div>

                  {/* Summary */}
                  {article.summary && (
                    <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                      {article.summary}
                    </p>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <Badge
                      variant="secondary"
                      className="text-[11px] px-1.5 py-0 h-5 font-normal"
                    >
                      {article.feedTitle}
                    </Badge>
                    {article.author && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        {article.author}
                      </span>
                    )}
                    {article.publishedAt && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(article.publishedAt)}
                      </span>
                    )}
                    {readingTime && (
                      <span className="text-xs text-muted-foreground">
                        {readingTime}
                      </span>
                    )}
                  </div>
                </div>

                {/* Star button */}
                <button
                  onClick={(e) => handleToggleStar(e, article)}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer flex-shrink-0 self-start mt-1 ${
                    article.isStarred
                      ? "text-amber-500"
                      : "opacity-0 group-hover:opacity-40 hover:!opacity-100 text-muted-foreground"
                  }`}
                  title={article.isStarred ? "Quitar de favoritos" : "Agregar a favoritos"}
                >
                  <Star
                    className="h-4 w-4"
                    fill={article.isStarred ? "currentColor" : "none"}
                  />
                </button>
              </div>
            </article>
          );

          return (
            <ContextMenu key={article.id}>
              <ContextMenuTrigger asChild>
                {cardContent}
              </ContextMenuTrigger>
              <ContextMenuContent>
                {article.isRead ? (
                  <ContextMenuItem onClick={() => handleToggleRead(article)} className="gap-2">
                    <Eye className="h-4 w-4" />
                    Marcar como no leido
                  </ContextMenuItem>
                ) : (
                  <ContextMenuItem onClick={() => handleToggleRead(article)} className="gap-2">
                    <EyeOff className="h-4 w-4" />
                    Marcar como leido
                  </ContextMenuItem>
                )}
                <ContextMenuItem
                  onClick={() => handleToggleStarFromMenu(article)}
                  className="gap-2"
                >
                  <Star className={`h-4 w-4 ${article.isStarred ? "fill-amber-500 text-amber-500" : ""}`} />
                  {article.isStarred ? "Quitar de favoritos" : "Agregar a favoritos"}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleCopyLink(article)} className="gap-2">
                  <Link2 className="h-4 w-4" />
                  Copiar link
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => handleMarkFeedRead(article.feedId)} className="gap-2">
                  <CheckCheck className="h-4 w-4" />
                  Marcar todo el feed como leido
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => handleDeleteArticle(article)} className="gap-2 text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Eliminar articulo
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>

      {/* Loading skeletons */}
      {isLoadingArticles && (
        <div className={viewMode === "compact" ? "divide-y" : "max-w-4xl mx-auto py-3 px-3 md:px-6 space-y-2"}>
          {viewMode === "compact" ? (
            <>
              <CompactSkeleton />
              <CompactSkeleton />
              <CompactSkeleton />
            </>
          ) : (
            <>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </>
          )}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />
    </div>
  );
}