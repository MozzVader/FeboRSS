"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/app";
import { FeedSidebar } from "@/components/feed-reader/feed-sidebar";
import { ArticleList } from "@/components/feed-reader/article-list";
import { ArticleReader } from "@/components/feed-reader/article-reader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Moon,
  Sun,
  Search,
  Rss,
  Menu,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";

export default function FeedReaderApp() {
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const {
    feeds,
    selectedFeedId,
    selectedCategoryId,
    filter,
    search,
    selectedArticle,
    isRefreshing,
    setFeeds,
    setCategories,
    setSearch,
    setIsRefreshing,
  } = useAppStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetch("/api/feeds")
      .then((r) => r.json())
      .then(setFeeds)
      .catch(() => {});
  }, [setFeeds]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
  }, [setCategories]);

  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/feeds/refresh-all", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const feedsRes = await fetch("/api/feeds");
      const feedsData = await feedsRes.json();
      setFeeds(feedsData);

      const catsRes = await fetch("/api/categories");
      const catsData = await catsRes.json();
      setCategories(catsData);

      toast({
        title: "Feeds actualizados",
        description: `${data.newArticles} articulos nuevos`,
      });
    } catch {
      toast({
        title: "Error al actualizar",
        description: "No se pudieron actualizar los feeds",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [setFeeds, setIsRefreshing, toast]);

  const handleRefreshFeed = useCallback(async () => {
    if (!selectedFeedId) return;
    try {
      const res = await fetch("/api/feeds/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedId: selectedFeedId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const feedsRes = await fetch("/api/feeds");
      const feedsData = await feedsRes.json();
      setFeeds(feedsData);

      toast({
        title: "Feed actualizado",
        description: `${data.newArticles} articulos nuevos`,
      });
    } catch {
      toast({ title: "Error al actualizar el feed", variant: "destructive" });
    }
  }, [selectedFeedId, setFeeds, toast]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const getFilterLabel = () => {
    if (selectedFeedId) {
      const feed = feeds.find((f) => f.id === selectedFeedId);
      return feed?.title || "Feed";
    }
    if (selectedCategoryId) {
      const { categories } = useAppStore.getState();
      const cat = categories.find((c) => c.id === selectedCategoryId);
      return cat?.name || "Categoria";
    }
    switch (filter) {
      case "unread":
        return "No leidos";
      case "starred":
        return "Favoritos";
      default:
        return "Todos los articulos";
    }
  };

  return (
    <div className="h-dvh flex flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between px-3 md:px-4 py-2 border-b bg-background shrink-0">
        <div className="flex items-center gap-2">
          <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SheetTitle className="sr-only">Feeds</SheetTitle>
              <FeedSidebar
                onRefreshAll={handleRefreshAll}
                isRefreshing={isRefreshing}
              />
            </SheetContent>
          </Sheet>

          <img src="/logo.png" alt="Febo" className="h-6 w-6" />
          <h1 className="text-base font-bold tracking-tight hidden sm:block">
            Febo <span className="font-light text-muted-foreground">RSS</span>
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          {searchOpen ? (
            <div className="flex items-center gap-1">
              <Input
                autoFocus
                placeholder="Buscar articulos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-48 md:w-64 text-sm"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setSearch("");
                  setSearchOpen(false);
                }}
              >
                ✕
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSearchOpen(true)}
              title="Buscar"
            >
              <Search className="h-4 w-4" />
            </Button>
          )}

          {selectedFeedId && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRefreshFeed}
              title="Actualizar feed"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}

          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleTheme}
              title="Cambiar tema"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-64 lg:w-72 border-r shrink-0">
          <FeedSidebar
            onRefreshAll={handleRefreshAll}
            isRefreshing={isRefreshing}
          />
        </aside>

        {/* Article list */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r shrink-0 flex flex-col ${
            selectedArticle ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="px-4 py-2.5 border-b flex items-center justify-between">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {getFilterLabel()}
            </h2>
            {isRefreshing && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ArticleList />
          </div>
        </div>

        {/* Article reader */}
        <div
          className={`flex-1 min-w-0 ${
            selectedArticle ? "flex" : "hidden md:flex"
          }`}
        >
          <ArticleReader onBack={() => useAppStore.getState().selectArticle(null)} />
        </div>
      </div>
    </div>
  );
}