"use client";

import { useState, useCallback } from "react";
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
  Rss,
  Plus,
  RefreshCw,
  Star,
  Inbox,
  BookOpen,
  Loader2,
  X,
  Newspaper,
  FolderPlus,
  Folder,
  ChevronRight,
  GripVertical,
  Pencil,
  Trash2,
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
      className={`rounded-md transition-colors ${isOver ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}
    >
      {children}
    </div>
  );
}

function SortableFeedItem({
  feed,
  isSelected,
  onSelect,
  onDelete,
}: {
  feed: FeedItem;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: feed.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative"
    >
      <button
        onClick={onSelect}
        className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer ${
          isSelected
            ? "bg-accent text-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        }`}
      >
        <span
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-40 hover:!opacity-100 cursor-grab active:cursor-grabbing p-0.5 -ml-0.5"
        >
          <GripVertical className="h-3 w-3" />
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onDelete(); } }}
          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 rounded hover:bg-destructive/10 cursor-pointer transition-opacity"
          title="Eliminar feed"
        >
          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </span>
        {feed.imageUrl ? (
          <img
            src={feed.imageUrl}
            alt=""
            className="h-3.5 w-3.5 rounded-sm object-cover flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <Rss className="h-3.5 w-3.5 flex-shrink-0 text-orange-400" />
        )}
        <span className="flex-1 text-left truncate text-[13px]">{feed.title}</span>
        {feed.unreadCount > 0 && (
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
            {feed.unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}

export function FeedSidebar({ onRefreshAll, isRefreshing }: FeedSidebarProps) {
  const [addUrl, setAddUrl] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addCategoryId, setAddCategoryId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatLoading, setNewCatLoading] = useState(false);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(null);

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
  } = useAppStore();

  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const uncategorizedFeeds = feeds.filter((f) => !f.categoryId);

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

  const handleDeleteFeed = async (id: string) => {
    try {
      const res = await fetch("/api/feeds", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      setDeleteConfirm(null);
      if (selectedFeedId === id) selectFeed(null);
      toast({ title: "Feed eliminado" });
      window.location.reload();
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar el feed", variant: "destructive" });
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
    if (!editCatName.trim()) return;
    try {
      const res = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editCatName.trim() }),
      });
      if (!res.ok) throw new Error();
      updateCategory(id, { name: editCatName.trim() });
      setEditingCat(null);
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
      setDeleteCategoryConfirm(null);
      window.location.reload();
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  };

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragId(null);
      if (!over || active.id === over.id) return;

      const activeFeed = feeds.find((f) => f.id === active.id);
      if (!activeFeed) return;

      let targetCategoryId: string | null = null;

      // Check if dropped on a category zone
      const overCategory = categories.find((c) => c.id === over.id);
      if (overCategory) {
        targetCategoryId = overCategory.id;
      } else {
        // Dropped on another feed - use that feed's category
        const overFeed = feeds.find((f) => f.id === over.id);
        if (overFeed) targetCategoryId = overFeed.categoryId;
      }

      // Build new positions
      const feedsWithoutActive = feeds.filter((f) => f.id !== active.id);
      let newFeeds: FeedItem[];

      if (over.id === "uncategorized" || targetCategoryId === null) {
        targetCategoryId = null;
        newFeeds = [
          ...feedsWithoutActive.filter((f) => !f.categoryId),
          { ...activeFeed, categoryId: null },
        ];
        newFeeds = [...newFeeds, ...feedsWithoutActive.filter((f) => !!f.categoryId)];
      } else {
        const catFeeds = feedsWithoutActive.filter((f) => f.categoryId === targetCategoryId);
        const overIdx = catFeeds.findIndex((f) => f.id === over.id);
        const insertIdx = overIdx >= 0 ? overIdx : catFeeds.length;
        catFeeds.splice(insertIdx, 0, { ...activeFeed, categoryId: targetCategoryId });
        newFeeds = [
          ...feedsWithoutActive.filter((f) => f.categoryId !== targetCategoryId && f.categoryId !== activeFeed.categoryId),
          ...catFeeds,
        ];
        // Also keep feeds from the original category that weren't moved
        const origCatRemain = feedsWithoutActive.filter((f) => f.categoryId === activeFeed.categoryId && f.categoryId !== targetCategoryId);
        if (activeFeed.categoryId !== targetCategoryId) {
          newFeeds = [...newFeeds.filter((f) => f.categoryId !== activeFeed.categoryId), ...origCatRemain];
        }
      }

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

      // Reload to get consistent state
      const feedsRes = await fetch("/api/feeds");
      const feedsData = await feedsRes.json();
      setFeeds(feedsData);

      const catsRes = await fetch("/api/categories");
      const catsData = await catsRes.json();
      setCategories(catsData);
    },
    [feeds, categories, setFeeds, setCategories]
  );

  const filterItems: { key: FilterType; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "all", label: "Todos", icon: <Newspaper className="h-4 w-4" /> },
    { key: "unread", label: "No leidos", icon: <Inbox className="h-4 w-4" />, count: unreadCount },
    { key: "starred", label: "Favoritos", icon: <Star className="h-4 w-4" />, count: starredCount },
  ];

  const dragOverlayFeed = activeDragId ? feeds.find((f) => f.id === activeDragId) : null;

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <h2 className="font-semibold text-base tracking-tight">Feeds</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefreshAll} disabled={isRefreshing} title="Actualizar todos los feeds">
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Nueva categoria">
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
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Agregar feed">
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
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
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

      {/* Feeds with DnD */}
      <ScrollArea className="flex-1 px-2 py-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={({ active }) => setActiveDragId(active.id)} onDragEnd={handleDragEnd}>
          <div className="flex flex-col gap-0.5 pb-4">
            {feeds.length === 0 && categories.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <BookOpen className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">No hay feeds todavia.<br />Agrega uno con el boton +</p>
              </div>
            )}

            {/* Categories */}
            {categories.map((cat) => {
              const isExpanded = expandedCategories.has(cat.id);
              const catTotalUnread = cat.feeds.reduce((sum, f) => sum + f.unreadCount, 0);
              const isCatSelected = selectedCategoryId === cat.id && !selectedFeedId;

              return (
                <DroppableCategoryZone id={cat.id} key={cat.id}>
                  <Collapsible
                    open={isExpanded}
                    onOpenChange={() => toggleCategory(cat.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <div
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); } }}
                        className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer group/cat outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                          isCatSelected
                            ? "bg-accent text-accent-foreground font-medium"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        }`}
                        onClick={(e) => {
                          if (e.detail === 0) return; // collapsible handles it
                          selectCategory(cat.id);
                        }}
                      >
                        <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                        <Folder className={`h-3.5 w-3.5 flex-shrink-0 ${isCatSelected ? "text-amber-500" : ""}`} />
                        <span className="flex-1 text-left truncate text-[13px]">{cat.name}</span>
                        {catTotalUnread > 0 && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{catTotalUnread}</span>
                        )}
                        <span className="flex items-center gap-0.5 opacity-0 group-hover/cat:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingCat(cat.id); setEditCatName(cat.name); }}
                            className="p-0.5 rounded hover:bg-accent cursor-pointer"
                            title="Renombrar"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteCategoryConfirm(cat.id); }}
                            className="p-0.5 rounded hover:bg-destructive/10 cursor-pointer"
                            title="Eliminar categoria"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      </div>
                    </CollapsibleTrigger>

                  {/* Edit category inline */}
                  {editingCat === cat.id && (
                    <div className="flex items-center gap-1 px-2 py-1 ml-5">
                      <Input
                        autoFocus
                        value={editCatName}
                        onChange={(e) => setEditCatName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameCategory(cat.id);
                          if (e.key === "Escape") setEditingCat(null);
                        }}
                        className="h-6 text-xs"
                      />
                      <Button size="sm" className="h-6 px-2 text-xs" onClick={() => handleRenameCategory(cat.id)}>OK</Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditingCat(null)}>X</Button>
                    </div>
                  )}

                  {/* Delete category confirm */}
                  {deleteCategoryConfirm === cat.id && (
                    <div className="flex items-center gap-1 px-2 py-1 ml-5 text-xs">
                      <span className="text-destructive">Eliminar categoria?</span>
                      <button onClick={() => handleDeleteCategory(cat.id)} className="text-red-600 font-medium cursor-pointer">Si</button>
                      <button onClick={() => setDeleteCategoryConfirm(null)} className="text-muted-foreground cursor-pointer">No</button>
                    </div>
                  )}

                  <CollapsibleContent>
                    <div className="ml-4 pl-2 border-l border-border/50 mt-0.5 space-y-0.5">
                      <SortableContext items={cat.feeds.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                        {cat.feeds.map((feed) => (
                          <SortableFeedItem
                            key={feed.id}
                            feed={feed}
                            isSelected={selectedFeedId === feed.id}
                            onSelect={() => { setFilter("all"); selectFeed(feed.id); }}
                            onDelete={() => handleDeleteFeed(feed.id)}
                          />
                        ))}
                      </SortableContext>
                      {cat.feeds.length === 0 && (
                        <p className="text-[11px] text-muted-foreground/60 px-3 py-1 italic">Sin feeds</p>
                      )}
                    </div>
                  </CollapsibleContent>
                  </Collapsible>
                </DroppableCategoryZone>
              );
            })}

            {/* Uncategorized feeds */}
            <DroppableCategoryZone id="uncategorized">
              {uncategorizedFeeds.length > 0 && categories.length > 0 && (
                <div className="px-2 pt-3 pb-1">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">Sin categoria</span>
                </div>
              )}
              <SortableContext items={uncategorizedFeeds.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              {uncategorizedFeeds.map((feed) => (
                <SortableFeedItem
                  key={feed.id}
                  feed={feed}
                  isSelected={selectedFeedId === feed.id}
                  onSelect={() => { setFilter("all"); selectFeed(feed.id); }}
                  onDelete={() => handleDeleteFeed(feed.id)}
                />
              ))}
              </SortableContext>
            </DroppableCategoryZone>
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {dragOverlayFeed ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-background border rounded-md shadow-lg text-sm max-w-[200px]">
                <GripVertical className="h-3 w-3 text-muted-foreground" />
                <span className="truncate">{dragOverlayFeed.title}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </ScrollArea>
    </div>
  );
}