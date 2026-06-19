"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/store/app";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, ExternalLink, Clock, User } from "lucide-react";
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

function ArticleSkeleton() {
  return (
    <div className="p-4 border-b">
      <div className="flex gap-3">
        <Skeleton className="h-16 w-16 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      </div>
    </div>
  );
}

export function ArticleList() {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const {
    articles,
    selectedArticle,
    selectedFeedId,
    selectedCategoryId,
    filter,
    search,
    nextCursor,
    isLoadingArticles,
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
        useAppStore.getState().updateFeedUnread(article.feedId, -1);
        useAppStore.getState().decrementUnreadCount(0);
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
    } catch {
      // silent
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
    <ScrollArea className="h-full">
      <div className="divide-y">
        {articles.map((article) => (
          <div
            key={article.id}
            onClick={() => handleSelectArticle(article)}
            onKeyDown={(e) => e.key === "Enter" && handleSelectArticle(article)}
            role="button"
            tabIndex={0}
            className={`w-full text-left p-4 transition-colors hover:bg-muted/50 cursor-pointer group outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              selectedArticle?.id === article.id ? "bg-muted" : ""
            } ${!article.isRead ? "" : "opacity-75"}`}
          >
            <div className="flex gap-3">
              {article.imageUrl && (
                <img
                  src={article.imageUrl}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover flex-shrink-0 bg-muted"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  {!article.isRead && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                  )}
                  <h3
                    className={`text-sm font-medium leading-snug line-clamp-2 flex-1 ${
                      !article.isRead ? "font-semibold" : ""
                    }`}
                  >
                    {article.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-4 font-normal"
                  >
                    {article.feedTitle}
                  </Badge>
                  {article.author && (
                    <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                      <User className="h-2.5 w-2.5" />
                      {article.author}
                    </span>
                  )}
                  {article.publishedAt && (
                    <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDate(article.publishedAt)}
                    </span>
                  )}
                </div>
                {article.summary && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {article.summary}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <button
                  onClick={(e) => handleToggleStar(e, article)}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    article.isStarred
                      ? "text-amber-500"
                      : "opacity-0 group-hover:opacity-50 hover:opacity-100 text-muted-foreground"
                  }`}
                  title={article.isStarred ? "Quitar de favoritos" : "Agregar a favoritos"}
                >
                  <Star
                    className="h-3.5 w-3.5"
                    fill={article.isStarred ? "currentColor" : "none"}
                  />
                </button>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 opacity-0 group-hover:opacity-50 hover:opacity-100 text-muted-foreground transition-opacity cursor-pointer"
                  title="Abrir en nueva pestana"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
      {isLoadingArticles && (
        <div>
          <ArticleSkeleton />
          <ArticleSkeleton />
          <ArticleSkeleton />
        </div>
      )}
      <div ref={sentinelRef} className="h-1" />
    </ScrollArea>
  );
}