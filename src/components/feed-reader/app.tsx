"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAppStore } from "@/store/app";
import { FeedSidebar } from "@/components/feed-reader/feed-sidebar";
import { ArticleCards } from "@/components/feed-reader/article-cards";
import { ArticleReaderModal } from "@/components/feed-reader/article-reader-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  Moon,
  Sun,
  Search,
  Menu,
  RefreshCw,
  Loader2,
  FolderInput,
  Download,
  Upload,
  Keyboard,
  Bell,
  BellOff,
  LayoutGrid,
  List,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";

const AUTO_REFRESH_MS = 60 * 60 * 1000; // 60 minutos

export default function FeedReaderApp() {
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
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
    globalMute,
    viewMode,
    setFeeds,
    setCategories,
    setSearch,
    setIsRefreshing,
    selectArticle,
    selectCategory,
    toggleGlobalMute,
    setViewMode,
  } = useAppStore();

  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasNotifFeeds = feeds.filter((f) => f.notifyEnabled).length > 0;

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

      // Send browser notifications for feeds with new articles
      if (data.newPerFeed && Array.isArray(data.newPerFeed)) {
        for (const feed of data.newPerFeed) {
          if (feed.notifyEnabled && feed.count > 0) {
            showNotification(feed.feedTitle, `${feed.count} articulo${feed.count > 1 ? "s" : ""} nuevo${feed.count > 1 ? "s" : ""}`);
          }
        }
      }

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
  }, [setFeeds, setCategories, setIsRefreshing, toast]);

  const showNotification = (title: string, body: string) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (useAppStore.getState().globalMute) return;

    // Check if page is visible — don't notify if user is actively using the app
    if (!document.hidden) return;

    try {
      const notification = new Notification(title, {
        body,
        icon: "/logo.png",
        tag: `feborss-${Date.now()}`,
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch {
      // Notification API not available
    }
  };

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

      // Notify if this feed has notifications enabled
      if (data.newArticles > 0) {
        const currentFeed = useAppStore.getState().feeds.find((f) => f.id === selectedFeedId);
        if (currentFeed?.notifyEnabled) {
          showNotification(currentFeed.title, `${data.newArticles} articulo${data.newArticles > 1 ? "s" : ""} nuevo${data.newArticles > 1 ? "s" : ""}`);
        }
      }

      toast({
        title: "Feed actualizado",
        description: `${data.newArticles} articulos nuevos`,
      });
    } catch {
      toast({ title: "Error al actualizar el feed", variant: "destructive" });
    }
  }, [selectedFeedId, setFeeds, toast]);

  // Auto-refresh every 60 minutes
  useEffect(() => {
    autoRefreshRef.current = setInterval(() => {
      handleRefreshAll();
    }, AUTO_REFRESH_MS);
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [handleRefreshAll]);

  // Keyboard shortcuts
  const reloadFeeds = useCallback(async () => {
    try {
      const res = await fetch("/api/feeds");
      const data = await res.json();
      if (res.ok) useAppStore.getState().setFeeds(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Escape always works
      if (e.key === "Escape") {
        if (searchOpen) {
          setSearch("");
          setSearchOpen(false);
          return;
        }
        if (showShortcuts) {
          setShowShortcuts(false);
          return;
        }
        if (useAppStore.getState().selectedArticle) {
          selectArticle(null);
          return;
        }
        return;
      }

      // In input, only handle Escape (above)
      if (isInput) return;

      const store = useAppStore.getState();
      const articles = store.articles;
      const hasModal = !!store.selectedArticle;

      switch (e.key) {
        case "n":
        case "ArrowRight": {
          if (hasModal) return;
          e.preventDefault();
          const sidebarItems: { id: string; type: "feed" | "category" }[] = [
            ...store.feeds.filter((f) => !f.categoryId).map((f) => ({ id: f.id, type: "feed" as const })),
            ...store.categories.flatMap((cat) => [
              { id: cat.id, type: "category" as const },
              ...cat.feeds.map((f) => ({ id: f.id, type: "feed" as const })),
            ]),
          ];
          if (sidebarItems.length === 0) break;
          const focusedId = store.focusedSidebarItemId;
          const currentIdx = focusedId
            ? sidebarItems.findIndex((item) => item.id === focusedId)
            : -1;
          const nextIdx = currentIdx + 1;
          if (nextIdx < sidebarItems.length) {
            store.setFocusedSidebarItemId(sidebarItems[nextIdx].id);
          } else if (currentIdx === -1) {
            store.setFocusedSidebarItemId(sidebarItems[0].id);
          }
          break;
        }
        case "p":
        case "ArrowLeft": {
          if (hasModal) return;
          e.preventDefault();
          const sidebarItems2: { id: string; type: "feed" | "category" }[] = [
            ...store.feeds.filter((f) => !f.categoryId).map((f) => ({ id: f.id, type: "feed" as const })),
            ...store.categories.flatMap((cat) => [
              { id: cat.id, type: "category" as const },
              ...cat.feeds.map((f) => ({ id: f.id, type: "feed" as const })),
            ]),
          ];
          if (sidebarItems2.length === 0) break;
          const focusedId2 = store.focusedSidebarItemId;
          const currentIdx2 = focusedId2
            ? sidebarItems2.findIndex((item) => item.id === focusedId2)
            : 0;
          if (currentIdx2 > 0) {
            store.setFocusedSidebarItemId(sidebarItems2[currentIdx2 - 1].id);
          }
          break;
        }
        case "j":
        case "ArrowDown": {
          if (hasModal) return;
          e.preventDefault();
          const focusedId = store.focusedArticleId;
          const idx = focusedId
            ? articles.findIndex((a) => a.id === focusedId)
            : -1;
          const next = Math.min(idx + 1, articles.length - 1);
          if (next >= 0 && next !== idx) {
            store.setFocusedArticleId(articles[next].id);
          }
          break;
        }
        case "k":
        case "ArrowUp": {
          if (hasModal) return;
          e.preventDefault();
          const focusedId = store.focusedArticleId;
          const idx = focusedId
            ? articles.findIndex((a) => a.id === focusedId)
            : articles.length;
          const prev = Math.max(idx - 1, 0);
          if (prev >= 0 && prev !== idx) {
            store.setFocusedArticleId(articles[prev].id);
          }
          break;
        }
        case "o": {
          if (hasModal) return;
          e.preventDefault();
          const focusedArtId = store.focusedArticleId;
          if (focusedArtId) {
            const article = articles.find((a) => a.id === focusedArtId);
            if (article) {
              if (!article.isRead) {
                fetch("/api/articles", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: article.id, isRead: true }),
                });
                store.updateArticleLocal(article.id, { isRead: true });
                store.decrementUnreadCount(-1);
                reloadFeeds();
                toast({ title: "Marcado como leido" });
              }
              selectArticle(article);
            }
          }
          break;
        }
        case "Enter": {
          if (hasModal) return;
          e.preventDefault();
          // First check if a sidebar item is focused
          const sidebarFocusedId = store.focusedSidebarItemId;
          if (sidebarFocusedId) {
            const isCategory = store.categories.some((c) => c.id === sidebarFocusedId);
            if (isCategory) {
              selectCategory(sidebarFocusedId);
            } else {
              store.selectFeed(sidebarFocusedId);
            }
            break;
          }
          // Otherwise open focused article
          const focusedArtId2 = store.focusedArticleId;
          if (focusedArtId2) {
            const article = articles.find((a) => a.id === focusedArtId2);
            if (article) {
              if (!article.isRead) {
                fetch("/api/articles", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: article.id, isRead: true }),
                });
                store.updateArticleLocal(article.id, { isRead: true });
                store.decrementUnreadCount(-1);
                reloadFeeds();
                toast({ title: "Marcado como leido" });
              }
              selectArticle(article);
            }
          }
          break;
        }
        case "s": {
          if (hasModal) {
            const art = store.selectedArticle;
            if (art) {
              const ns = !art.isStarred;
              fetch("/api/articles", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: art.id, isStarred: ns }),
              });
              store.updateArticleLocal(art.id, { isStarred: ns });
              toast({ title: ns ? "Agregado a favoritos" : "Quitado de favoritos" });
            }
          } else {
            const focusedId = store.focusedArticleId;
            if (focusedId) {
              const article = articles.find((a) => a.id === focusedId);
              if (article) {
                const ns = !article.isStarred;
                fetch("/api/articles", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: article.id, isStarred: ns }),
                });
                store.updateArticleLocal(article.id, { isStarred: ns });
                toast({ title: ns ? "Agregado a favoritos" : "Quitado de favoritos" });
              }
            }
          }
          break;
        }
        case "m": {
          if (e.shiftKey) {
            // Mark all read in current feed
            const feedId = store.selectedFeedId;
            if (feedId) {
              fetch("/api/articles/mark-all-read", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ feedId }),
              });
              store.setArticles(
                store.articles.map((a) =>
                  a.feedId === feedId ? { ...a, isRead: true } : a
                ),
                store.nextCursor,
                0,
                store.starredCount
              );
              reloadFeeds();
              toast({ title: "Todos marcados como leidos" });
            }
          } else if (hasModal) {
            const art = store.selectedArticle;
            if (art) {
              const nr = !art.isRead;
              fetch("/api/articles", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: art.id, isRead: nr }),
              });
              store.updateArticleLocal(art.id, { isRead: nr });
              store.decrementUnreadCount(nr ? -1 : 1);
              reloadFeeds();
              toast({ title: nr ? "Marcado como leido" : "Marcado como no leido" });
            }
          } else {
            const focusedId = store.focusedArticleId;
            if (focusedId) {
              const article = articles.find((a) => a.id === focusedId);
              if (article) {
                const nr = !article.isRead;
                fetch("/api/articles", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: article.id, isRead: nr }),
                });
                store.updateArticleLocal(article.id, { isRead: nr });
                store.decrementUnreadCount(nr ? -1 : 1);
                reloadFeeds();
                toast({ title: nr ? "Marcado como leido" : "Marcado como no leido" });
              }
            }
          }
          break;
        }
        case "r": {
          if (!isRefreshing) handleRefreshAll();
          break;
        }
        case "a": {
          store.setFilter("all");
          break;
        }
        case "u": {
          store.setFilter("unread");
          break;
        }
        case "f": {
          store.setFilter("starred");
          break;
        }
        case "/": {
          e.preventDefault();
          setSearchOpen(true);
          break;
        }
        case "t": {
          toggleTheme();
          break;
        }
        case "?": {
          setShowShortcuts(true);
          break;
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [searchOpen, showShortcuts, selectArticle, setSearch, setSearchOpen, handleRefreshAll, isRefreshing, toast]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleExportOpml = useCallback(async () => {
    try {
      const res = await fetch("/api/opml");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "feborss-subscriptions.opml";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "OPML exportado" });
    } catch {
      toast({ title: "Error al exportar", variant: "destructive" });
    }
  }, [toast]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportOpml = useCallback(async () => {
    fileInputRef.current?.click();
  }, []);

  const onImportFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setIsRefreshing(true);
      const res = await fetch("/api/opml", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Reload feeds and categories
      const feedsRes = await fetch("/api/feeds");
      const feedsData = await feedsRes.json();
      setFeeds(feedsData);
      const catsRes = await fetch("/api/categories");
      const catsData = await catsRes.json();
      setCategories(catsData);

      toast({
        title: "OPML importado",
        description: `${data.imported} feeds importados, ${data.skipped} omitidos`,
      });
    } catch {
      toast({ title: "Error al importar OPML", variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [setFeeds, setCategories, setIsRefreshing, toast]);

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

          <img src="/logo.png" alt="Febo" className="h-7 w-7" />
          <h1 className="text-lg font-bold tracking-tight hidden sm:block">
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

          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode(viewMode === "cards" ? "compact" : "cards")}
              title={viewMode === "cards" ? "Vista compacta" : "Vista tarjetas"}
            >
              {viewMode === "cards" ? (
                <List className="h-4 w-4" />
              ) : (
                <LayoutGrid className="h-4 w-4" />
              )}
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
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Importar / Exportar OPML"
              >
                <FolderInput className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportOpml} className="gap-2">
                <Download className="h-4 w-4" />
                Exportar OPML
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleImportOpml} className="gap-2">
                <Upload className="h-4 w-4" />
                Importar OPML
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowShortcuts(true)}
            title="Atajos de teclado"
          >
            <Keyboard className="h-4 w-4" />
          </Button>

          {mounted && hasNotifFeeds && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleGlobalMute}
              title={globalMute ? "Restaurar notificaciones" : "Silenciar notificaciones"}
            >
              {globalMute ? (
                <BellOff className="h-4 w-4" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
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

        {/* Hidden file input for OPML import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".opml,.xml"
          className="hidden"
          onChange={onImportFileChange}
        />
      </header>

      {/* Main content: sidebar + cards */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-64 lg:w-72 border-r shrink-0 overflow-hidden">
          <FeedSidebar
            onRefreshAll={handleRefreshAll}
            isRefreshing={isRefreshing}
          />
        </aside>

        {/* Cards area */}
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="px-6 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-medium text-muted-foreground">
                {getFilterLabel()}
              </h2>
              {selectedFeedId && (() => {
                const feed = feeds.find((f) => f.id === selectedFeedId);
                if (feed?.notifyEnabled) {
                  return (
                    <span title="Notificaciones activadas">
                      <Bell className="h-3.5 w-3.5 text-blue-500" />
                    </span>
                  );
                }
                return null;
              })()}
            </div>
            {isRefreshing && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ArticleCards />
          </div>
        </main>
      </div>

      {/* Article reader modal */}
      <ArticleReaderModal
        open={!!selectedArticle}
        onOpenChange={(open) => {
          if (!open) selectArticle(null);
        }}
      />

      {/* Keyboard shortcuts help */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" />
              Atajos de teclado
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm py-2">
            <ShortcutRow keys="j / ↓" desc="Articulo siguiente" />
            <ShortcutRow keys="k / ↑" desc="Articulo anterior" />
            <ShortcutRow keys="n / →" desc="Feed siguiente" />
            <ShortcutRow keys="p / ←" desc="Feed anterior" />
            <ShortcutRow keys="o" desc="Abrir articulo" />
            <ShortcutRow keys="Enter" desc="Seleccionar feed / Abrir" />
            <ShortcutRow keys="Escape" desc="Cerrar" />
            <ShortcutRow keys="s" desc="Favorito" />
            <ShortcutRow keys="m" desc="Marcar leido" />
            <ShortcutRow keys="Shift + m" desc="Marcar todos leidos" />
            <ShortcutRow keys="r" desc="Refrescar feeds" />
            <ShortcutRow keys="a" desc="Todos" />
            <ShortcutRow keys="u" desc="No leidos" />
            <ShortcutRow keys="f" desc="Favoritos" />
            <ShortcutRow keys="/" desc="Buscar" />
            <ShortcutRow keys="t" desc="Cambiar tema" />
            <ShortcutRow keys="?" desc="Ver atajos" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ShortcutRow({ keys, desc }: { keys: string; desc: string }) {
  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {keys.split(" / ").map((k, i) => (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && <span className="text-[10px] text-muted-foreground mx-0.5">/</span>}
            <kbd className="inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded border border-border bg-muted/50 text-[11px] font-mono font-medium">
              {k}
            </kbd>
          </span>
        ))}
      </div>
      <div className="text-muted-foreground">{desc}</div>
    </>
  );
}