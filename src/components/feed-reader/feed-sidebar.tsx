"use client";

import { useState, useCallback, useRef } from "react";
import { useAppStore, type FeedItem, type FilterType } from "@/store/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useMemo } from "react";
import {
  Rss,
  Plus,
  RefreshCw,
  Star,
  Inbox,
  BookOpen,
  Loader2,
  Newspaper,
  FolderPlus,
  Folder,
  ChevronRight,
  GripVertical,
  Pencil,
  Trash2,
  FolderInput,
  ArrowRightFromLine,
  CheckCheck,
  AlertTriangle,
  Bell,
  BellOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface FeedSidebarProps {
  onRefreshAll: () => Promise<void>;
  isRefreshing: boolean;
}

/* ─── Feed icon with fallback ─── */
const brokenImageUrls = new Set<string>();

function FeedIcon({ src, className }: { src: string | null | undefined; className?: string }) {
  const broken = src ? brokenImageUrls.has(src) : true;
  if (broken || !src) {
    return <Rss className={className ?? "h-4 w-4 flex-shrink-0 text-orange-400"} />;
  }
  return (
    <img
      src={src}
      alt=""
      className={className ?? "h-4 w-4 rounded-sm object-cover flex-shrink-0"}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
        brokenImageUrls.add(src!);
      }}
    />
  );
}

/* ─── Drop indicator line ─── */
function DropIndicator({ active, position }: { active: boolean; position: "top" | "bottom" }) {
  if (!active) return null;
  return (
    <div className={`h-0.5 bg-primary rounded-full mx-1 transition-all ${position === "top" ? "mb-0.5" : "mt-0.5"}`} />
  );
}

/* ─── Droppable category zone ─── */
function DroppableCategoryZone({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: "category" } });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-md transition-colors overflow-hidden min-w-0 ${isOver ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}
    >
      {children}
    </div>
  );
}

/* ─── Sortable feed item (clean — no action buttons) ─── */
function SortableFeedItem({
  feed,
  isSelected,
  isFocused,
  onSelect,
  onContextMenuActions,
  showDropAbove,
  showDropBelow,
}: {
  feed: FeedItem;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: () => void;
  onContextMenuActions: {
    onDelete: () => void;
    onEdit: () => void;
    onToggleNotify: () => void;
    onMoveToCategory: (catId: string | null) => void;
    onMarkAllRead: () => void;
  };
  showDropAbove: boolean;
  showDropBelow: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: feed.id });

  const maxTitleLen = 30;
  const truncatedTitle = feed.title.length > maxTitleLen
    ? feed.title.slice(0, maxTitleLen) + '…'
    : feed.title;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="overflow-hidden">
      <DropIndicator active={showDropAbove} position="top" />
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            onClick={onSelect}
            className={`flex items-center gap-2 w-full px-2 py-[7px] rounded-md text-[13px] transition-colors cursor-pointer ${
              isSelected
                ? "bg-accent text-accent-foreground font-medium"
                : isFocused
                  ? "bg-accent/40 text-accent-foreground ring-1 ring-primary/20"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            <span
              {...attributes}
              {...listeners}
              className="opacity-0 group-hover/sidebar:opacity-40 hover:!opacity-100 cursor-grab active:cursor-grabbing p-0.5 -ml-0.5 shrink-0"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </span>
            <FeedIcon src={feed.imageUrl} />
            <div className="flex-1 min-w-0 text-left text-[13px] truncate max-w-full" title={feed.title}>{truncatedTitle}</div>
            {feed.unreadCount > 0 && (
              <span className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium shrink-0">
                {feed.unreadCount}
              </span>
            )}
            {feed.lastError && (
              <span className="text-red-500" title={`Error: ${feed.lastError}`}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              </span>
            )}
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={onContextMenuActions.onEdit}
            className="gap-2"
          >
            <Pencil className="h-4 w-4" />
            Editar feed
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => onContextMenuActions.onMoveToCategory(null)}
            className="gap-2"
          >
            <ArrowRightFromLine className="h-4 w-4" />
            Quitar de categoria
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger className="gap-2">
              <FolderInput className="h-4 w-4" />
              Mover a categoria
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <FeedCategoryMenuItems
                currentCategoryId={feed.categoryId}
                onMove={onContextMenuActions.onMoveToCategory}
              />
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem
            onClick={onContextMenuActions.onMarkAllRead}
            className="gap-2"
          >
            <CheckCheck className="h-4 w-4" />
            Marcar todo como leido
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={onContextMenuActions.onToggleNotify}
            className="gap-2"
          >
            {feed.notifyEnabled ? (
              <Bell className="h-4 w-4 text-blue-500" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
            {feed.notifyEnabled ? "Desactivar notificaciones" : "Activar notificaciones"}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={onContextMenuActions.onDelete}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar feed
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <DropIndicator active={showDropBelow} position="bottom" />
    </div>
  );
}

/* ─── Helper: list categories as context menu items ─── */
function FeedCategoryMenuItems({
  currentCategoryId,
  onMove,
}: {
  currentCategoryId: string | null;
  onMove: (catId: string) => void;
}) {
  const { categories } = useAppStore();
  return (
    <>
      {categories.map((cat) => (
        <ContextMenuItem
          key={cat.id}
          onClick={() => onMove(cat.id)}
          disabled={cat.id === currentCategoryId}
          className="gap-2"
        >
          <Folder className="h-4 w-4" />
          {cat.name}
          {cat.id === currentCategoryId && (
            <span className="ml-auto text-xs text-muted-foreground">actual</span>
          )}
        </ContextMenuItem>
      ))}
      {categories.length === 0 && (
        <div className="px-2 py-1.5 text-xs text-muted-foreground italic">
          No hay categorias
        </div>
      )}
    </>
  );
}

/* ─── Main sidebar ─── */
export function FeedSidebar({ onRefreshAll, isRefreshing }: FeedSidebarProps) {
  const [addUrl, setAddUrl] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addCategoryId, setAddCategoryId] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatLoading, setNewCatLoading] = useState(false);
  const [renameCatId, setRenameCatId] = useState<string | null>(null);
  const [renameCatName, setRenameCatName] = useState("");
  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [deleteFeedId, setDeleteFeedId] = useState<string | null>(null);
  const [deleteFeedTitle, setDeleteFeedTitle] = useState("");
  const [editFeedId, setEditFeedId] = useState<string | null>(null);
  const [editFeedTitle, setEditFeedTitle] = useState("");
  const [editFeedUrl, setEditFeedUrl] = useState("");
  const [editFeedLoading, setEditFeedLoading] = useState(false);

  const {
    feeds,
    categories,
    selectedFeedId,
    selectedCategoryId,
    filter,
    expandedCategories,
    selectFeed,
    selectCategory,
    setFilter,
    setFeeds,
    setCategories,
    addCategory,
    updateCategory,
    removeCategory,
    toggleCategory,
    unreadCount,
    starredCount,
    focusedSidebarItemId,
  } = useAppStore();

  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const uncategorizedFeeds = feeds.filter((f) => !f.categoryId);

  /* ── Handlers ── */

  const handleAddFeed = async () => {
    if (!addUrl.trim()) return;
    setAddLoading(true);
    try {
      const res = await fetch("/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: addUrl.trim(), categoryId: addCategoryId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al agregar el feed");
      toast({ title: "Feed agregado", description: `"${data.title}" se agrego correctamente` });
      setAddUrl("");
      setAddOpen(false);
      window.location.reload();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setAddLoading(false);
    }
  };

  const handleMarkFeedRead = async (feedId: string) => {
    try {
      await fetch("/api/articles/mark-all-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedId }),
      });
      // Reload feeds to get accurate unread counts
      const feedsRes = await fetch("/api/feeds");
      const feedsData = await feedsRes.json();
      setFeeds(feedsData);
      // Update local articles
      const store = useAppStore.getState();
      const newUnreadCount = store.articles.filter(
        (a) => a.feedId !== feedId && !a.isRead
      ).length;
      store.setArticles(
        store.articles.map((a) => a.feedId === feedId ? { ...a, isRead: true } : a),
        store.nextCursor,
        newUnreadCount,
        store.starredCount
      );
      toast({ title: "Marcados como leidos" });
    } catch {
      toast({ title: "Error al marcar como leidos", variant: "destructive" });
    }
  };

  const handleDeleteFeed = async (id: string) => {
    try {
      const res = await fetch("/api/feeds", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      if (selectedFeedId === id) selectFeed(null);
      setDeleteFeedId(null);
      setDeleteFeedTitle("");
      toast({ title: "Feed eliminado", description: `"${deleteFeedTitle || "Feed"}" fue eliminado` });
      window.location.reload();
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar el feed", variant: "destructive" });
    }
  };

  const handleMoveFeedToCategory = async (feedId: string, categoryId: string | null) => {
    try {
      const feed = feeds.find((f) => f.id === feedId);
      if (!feed || feed.categoryId === categoryId) return;

      const updatedFeed = { ...feed, categoryId };
      // Simple move: update just this feed
      await fetch("/api/feeds/move", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeds: [{ id: feedId, categoryId, position: feed.position }] }),
      });

      toast({
        title: categoryId ? "Feed movido a categoria" : "Feed sin categoria",
      });

      // Reload feeds and categories
      const feedsRes = await fetch("/api/feeds");
      const feedsData = await feedsRes.json();
      setFeeds(feedsData);

      const catsRes = await fetch("/api/categories");
      const catsData = await catsRes.json();
      setCategories(catsData);
    } catch {
      toast({ title: "Error al mover feed", variant: "destructive" });
    }
  };

  const handleEditFeed = async () => {
    if (!editFeedId || !editFeedTitle.trim()) return;
    setEditFeedLoading(true);
    try {
      const res = await fetch("/api/feeds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editFeedId,
          title: editFeedTitle.trim(),
          ...(editFeedUrl.trim() ? { url: editFeedUrl.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Update feed locally in the store
      useAppStore.getState().updateFeedLocal(editFeedId, {
        title: editFeedTitle.trim(),
        ...(editFeedUrl.trim() ? { url: editFeedUrl.trim() } : {}),
      });

      // Also update feedTitle in articles
      const store = useAppStore.getState();
      if (editFeedUrl.trim()) {
        store.setArticles(
          store.articles.map((a) => a.feedId === editFeedId ? { ...a, feedTitle: editFeedTitle.trim() } : a),
          store.nextCursor,
          store.unreadCount,
          store.starredCount
        );
      }

      toast({ title: "Feed actualizado" });
      setEditFeedId(null);
      setEditFeedTitle("");
      setEditFeedUrl("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setEditFeedLoading(false);
    }
  };

  const handleToggleNotify = async (feedId: string, currentState: boolean) => {
    const newState = !currentState;

    // Request notification permission if activating
    if (newState && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "denied") {
        toast({
          title: "Notificaciones bloqueadas",
          description: "Habilita las notificaciones en la configuracion del navegador",
          variant: "destructive",
        });
        return;
      }
      if (Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast({ title: "Permiso denegado", variant: "destructive" });
          return;
        }
      }
    }

    try {
      const res = await fetch("/api/feeds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: feedId, notifyEnabled: newState }),
      });
      if (!res.ok) throw new Error();

      useAppStore.getState().updateFeedLocal(feedId, { notifyEnabled: newState });
      toast({
        title: newState ? "Notificaciones activadas" : "Notificaciones desactivadas",
      });
    } catch {
      toast({ title: "Error al cambiar notificaciones", variant: "destructive" });
    }
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    setNewCatLoading(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      addCategory({ ...data, feeds: [] });
      setNewCatName("");
      setNewCatOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setNewCatLoading(false);
    }
  };

  const handleRenameCategory = async (id: string) => {
    if (!renameCatName.trim()) return;
    try {
      const res = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: renameCatName.trim() }),
      });
      if (!res.ok) throw new Error();
      updateCategory(id, { name: renameCatName.trim() });
      setRenameCatId(null);
    } catch {
      toast({ title: "Error al renombrar", variant: "destructive" });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const res = await fetch("/api/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      removeCategory(id);
      toast({ title: "Categoria eliminada" });
      window.location.reload();
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  };

  /* ── DnD ── */

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over?.id ?? null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragId(null);
      setOverId(null);
      if (!over || active.id === over.id) return;

      const activeFeed = feeds.find((f) => f.id === active.id);
      if (!activeFeed) return;

      // Determine target category
      let targetCategoryId: string | null = activeFeed.categoryId;

      const overCategory = categories.find((c) => c.id === over.id);
      if (overCategory) {
        // Dropped on a category header → place at end of that category
        targetCategoryId = overCategory.id;
      } else if (over.id === "uncategorized") {
        targetCategoryId = null;
      } else {
        // Dropped on another feed → adopt its category and position
        const overFeed = feeds.find((f) => f.id === over.id);
        if (overFeed) targetCategoryId = overFeed.categoryId;
      }

      // Build new ordered array: insert active feed at the position of the 'over' item
      const overIdx = feeds.findIndex((f) => f.id === over.id);

      const newFeeds = feeds.filter((f) => f.id !== active.id);
      const insertAt = overIdx >= 0 && overIdx < newFeeds.length
        ? overIdx
        : newFeeds.length;

      newFeeds.splice(insertAt, 0, { ...activeFeed, categoryId: targetCategoryId });

      // Recalculate positions
      const moveData = newFeeds.map((f, i) => ({
        id: f.id,
        categoryId: f.categoryId,
        position: i,
      }));

      try {
        await fetch("/api/feeds/move", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feeds: moveData }),
        });
      } catch {
        // silent
      }

      const feedsRes = await fetch("/api/feeds");
      const feedsData = await feedsRes.json();
      setFeeds(feedsData);

      const catsRes = await fetch("/api/categories");
      const catsData = await catsRes.json();
      setCategories(catsData);
    },
    [feeds, categories, setFeeds, setCategories]
  );

  /* ── Render helpers ── */

  const filterItems: { key: FilterType; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "all", label: "Todos", icon: <Newspaper className="h-4 w-4" /> },
    { key: "unread", label: "No leidos", icon: <Inbox className="h-4 w-4" />, count: unreadCount },
    { key: "starred", label: "Favoritos", icon: <Star className="h-4 w-4" />, count: starredCount },
  ];

  const dragOverlayFeed = activeDragId ? feeds.find((f) => f.id === activeDragId) : null;

  const renderFeedItem = (feed: FeedItem) => {
    const isOverThis = overId === feed.id && activeDragId !== feed.id;
    const activeFeedData = activeDragId ? feeds.find((f) => f.id === activeDragId) : null;
    // Show drop above if dragged item was previously after this item in the list
    const showAbove = isOverThis && activeFeedData && activeFeedData.categoryId === feed.categoryId;
    const showBelow = false; // The DnD overlay handles the visual

    return (
      <SortableFeedItem
        key={feed.id}
        feed={feed}
        isSelected={selectedFeedId === feed.id}
        isFocused={focusedSidebarItemId === feed.id}
        onSelect={() => { setFilter("all"); selectFeed(feed.id); }}
        onContextMenuActions={{
          onDelete: () => {
            setDeleteFeedId(feed.id);
            setDeleteFeedTitle(feed.title);
          },
          onEdit: () => {
            setEditFeedId(feed.id);
            setEditFeedTitle(feed.title);
            setEditFeedUrl(feed.url);
          },
          onToggleNotify: () => handleToggleNotify(feed.id, feed.notifyEnabled),
          onMoveToCategory: (catId) => handleMoveFeedToCategory(feed.id, catId),
          onMarkAllRead: () => handleMarkFeedRead(feed.id),
        }}
        showDropAbove={showAbove}
        showDropBelow={showBelow}
      />
    );
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-muted/30 group/sidebar">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <h2 className="font-semibold text-[15px] tracking-tight">Feeds</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefreshAll} disabled={isRefreshing} title="Actualizar todos los feeds">
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Nueva categoria">
                <FolderPlus className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Nueva categoria</DialogTitle>
                <DialogDescription>Crea una carpeta para organizar tus feeds.</DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 mt-2">
                <Input placeholder="Nombre de la categoria" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()} disabled={newCatLoading} />
                <Button onClick={handleCreateCategory} disabled={newCatLoading || !newCatName.trim()}>
                  {newCatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Agregar feed">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Agregar Feed RSS</DialogTitle>
                <DialogDescription>Ingresa la URL de un feed RSS o Atom.</DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 mt-2">
                <Input placeholder="https://ejemplo.com/feed.xml" value={addUrl} onChange={(e) => setAddUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddFeed()} disabled={addLoading} />
                <Button onClick={handleAddFeed} disabled={addLoading || !addUrl.trim()}>
                  {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground mt-3 space-y-1">
                <p className="font-medium">Ejemplos populares:</p>
                <button className="block text-blue-600 dark:text-blue-400 hover:underline cursor-pointer" onClick={() => setAddUrl("https://xkcd.com/rss.xml")}>xkcd</button>
                <button className="block text-blue-600 dark:text-blue-400 hover:underline cursor-pointer" onClick={() => setAddUrl("https://hnrss.org/frontpage")}>Hacker News</button>
                <button className="block text-blue-600 dark:text-blue-400 hover:underline cursor-pointer" onClick={() => setAddUrl("https://www.reddit.com/r/programming/.rss")}>r/programming</button>
              </div>
              {categories.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Agregar a categoria:</p>
                  <div className="flex gap-1 flex-wrap">
                    <button onClick={() => setAddCategoryId(null)} className={`text-[11px] px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${addCategoryId === null ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}>Sin categoria</button>
                    {categories.map((c) => (
                      <button key={c.id} onClick={() => setAddCategoryId(c.id)} className={`text-[11px] px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${addCategoryId === c.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}>{c.name}</button>
                    ))}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Separator />

      {/* Filter tabs */}
      <div className="p-2 flex flex-col gap-0.5">
        {filterItems.map(({ key, label, icon, count }) => (
          <button
            key={key}
            onClick={() => { selectFeed(null); selectCategory(null); setFilter(key); }}
            className={`flex items-center gap-2.5 px-3 py-[9px] rounded-md text-[13px] transition-colors cursor-pointer ${
              !selectedFeedId && !selectedCategoryId && filter === key
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            {icon}
            <span className="flex-1 text-left">{label}</span>
            {count !== undefined && count > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{count}</span>
            )}
          </button>
        ))}
      </div>

      <Separator />

      {/* Feeds list with DnD */}
      <ScrollArea className="flex-1 w-full px-2 py-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={({ active }) => setActiveDragId(active.id)}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col gap-0.5 pb-4 min-w-0 w-full">
            {feeds.length === 0 && categories.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <BookOpen className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">No hay feeds todavia.<br />Agrega uno con el boton +</p>
              </div>
            )}

            {/* Uncategorized feeds FIRST */}
            <DroppableCategoryZone id="uncategorized">
              {uncategorizedFeeds.length > 0 && categories.length > 0 && (
                <div className="px-2 pt-2 pb-1">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">Sin categoria</span>
                </div>
              )}
              <SortableContext items={uncategorizedFeeds.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                {uncategorizedFeeds.map((feed) => renderFeedItem(feed))}
              </SortableContext>
            </DroppableCategoryZone>

            {/* Categories AFTER uncategorized */}
            {categories.map((cat) => {
              const isExpanded = expandedCategories.has(cat.id);
              const catTotalUnread = cat.feeds.reduce((sum, f) => sum + f.unreadCount, 0);
              const isCatSelected = selectedCategoryId === cat.id && !selectedFeedId;
              const isCatFocused = focusedSidebarItemId === cat.id;

              return (
                <DroppableCategoryZone id={cat.id} key={cat.id}>
                  <Collapsible
                    open={isExpanded}
                    onOpenChange={() => toggleCategory(cat.id)}
                  >
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <CollapsibleTrigger asChild>
                          <div
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); } }}
                            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring overflow-hidden ${
                              isCatSelected
                                ? "bg-accent text-accent-foreground font-medium"
                                : isCatFocused
                                  ? "bg-accent/40 text-accent-foreground ring-1 ring-primary/20"
                                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                            }`}
                            onClick={(e) => {
                              if (e.detail === 0) return;
                              selectCategory(cat.id);
                            }}
                          >
                            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                            <Folder className={`h-4 w-4 flex-shrink-0 ${isCatSelected ? "text-amber-500" : ""}`} />
                            <div className="flex-1 min-w-0 text-left text-[13px] truncate max-w-full" title={cat.name}>{cat.name.length > 25 ? cat.name.slice(0, 25) + '…' : cat.name}</div>
                            {catTotalUnread > 0 && (
                              <span className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium shrink-0">{catTotalUnread}</span>
                            )}
                          </div>
                        </CollapsibleTrigger>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem
                          onClick={() => { setRenameCatId(cat.id); setRenameCatName(cat.name); }}
                          className="gap-2"
                        >
                          <Pencil className="h-4 w-4" />
                          Renombrar
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="gap-2 text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar categoria
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                  {/* Rename inline */}
                  {renameCatId === cat.id && (
                    <div className="flex items-center gap-1 px-2 py-1 ml-5">
                      <Input
                        autoFocus
                        value={renameCatName}
                        onChange={(e) => setRenameCatName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameCategory(cat.id);
                          if (e.key === "Escape") setRenameCatId(null);
                        }}
                        className="h-6 text-xs"
                      />
                      <Button size="sm" className="h-6 px-2 text-xs" onClick={() => handleRenameCategory(cat.id)}>OK</Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setRenameCatId(null)}>X</Button>
                    </div>
                  )}

                    <CollapsibleContent>
                      <div className="ml-4 pl-2 border-l border-border/50 mt-0.5 space-y-0.5">
                        <SortableContext items={cat.feeds.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                          {cat.feeds.map((feed) => renderFeedItem(feed))}
                        </SortableContext>
                        {cat.feeds.length === 0 && (
                          <p className="text-[11px] text-muted-foreground/60 px-3 py-1 italic">Sin feeds — arrastra uno aca</p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </DroppableCategoryZone>
              );
            })}
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {dragOverlayFeed ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-background border rounded-md shadow-lg text-sm max-w-[200px]">
                <GripVertical className="h-3 w-3 text-muted-foreground" />
                <FeedIcon src={dragOverlayFeed.imageUrl} className="h-3.5 w-3.5" />
                <span className="truncate">{dragOverlayFeed.title}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </ScrollArea>

      {/* Edit feed dialog */}
      <Dialog open={!!editFeedId} onOpenChange={(open) => { if (!open) { setEditFeedId(null); setEditFeedTitle(""); setEditFeedUrl(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Feed</DialogTitle>
            <DialogDescription>Modifica el nombre o la URL del feed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre</label>
              <Input
                placeholder="Nombre del feed"
                value={editFeedTitle}
                onChange={(e) => setEditFeedTitle(e.target.value)}
                disabled={editFeedLoading}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">URL del feed</label>
              <Input
                placeholder="https://ejemplo.com/feed.xml"
                value={editFeedUrl}
                onChange={(e) => setEditFeedUrl(e.target.value)}
                disabled={editFeedLoading}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => { setEditFeedId(null); setEditFeedTitle(""); setEditFeedUrl(""); }} disabled={editFeedLoading}>
              Cancelar
            </Button>
            <Button onClick={handleEditFeed} disabled={editFeedLoading || !editFeedTitle.trim()}>
              {editFeedLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete feed confirmation dialog */}
      <AlertDialog open={!!deleteFeedId} onOpenChange={(open) => { if (!open) { setDeleteFeedId(null); setDeleteFeedTitle(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar feed</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <strong>{deleteFeedTitle}</strong> y todos sus articulos. Esta accion no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFeedId && handleDeleteFeed(deleteFeedId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}