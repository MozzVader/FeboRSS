import { create } from "zustand";

export type FilterType = "all" | "unread" | "starred";

interface ArticleItem {
  id: string;
  feedId: string;
  feedTitle: string;
  feedImageUrl: string | null;
  title: string;
  url: string;
  summary: string | null;
  author: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  isRead: boolean;
  isStarred: boolean;
}

interface FeedItem {
  id: string;
  title: string;
  url: string;
  siteUrl: string | null;
  description: string | null;
  imageUrl: string | null;
  position: number;
  createdAt: string;
  categoryId: string | null;
  unreadCount: number;
}

interface CategoryItem {
  id: string;
  name: string;
  position: number;
  feedCount: number;
  feeds: FeedItem[];
}

interface AppState {
  feeds: FeedItem[];
  articles: ArticleItem[];
  categories: CategoryItem[];
  expandedCategories: Set<string>;
  selectedFeedId: string | null;
  selectedCategoryId: string | null;
  selectedArticle: ArticleItem | null;
  filter: FilterType;
  search: string;
  nextCursor: string | null;
  unreadCount: number;
  starredCount: number;
  isLoadingArticles: boolean;
  isRefreshing: boolean;

  setFeeds: (feeds: FeedItem[]) => void;
  setCategories: (categories: CategoryItem[]) => void;
  addCategory: (category: CategoryItem) => void;
  updateCategory: (id: string, data: Partial<CategoryItem>) => void;
  removeCategory: (id: string) => void;
  toggleCategory: (id: string) => void;
  setArticles: (articles: ArticleItem[], nextCursor: string | null, unreadCount: number, starredCount: number) => void;
  appendArticles: (articles: ArticleItem[], nextCursor: string | null) => void;
  selectFeed: (feedId: string | null) => void;
  selectCategory: (categoryId: string | null) => void;
  selectArticle: (article: ArticleItem | null) => void;
  setFilter: (filter: FilterType) => void;
  setSearch: (search: string) => void;
  updateArticleLocal: (id: string, data: Partial<ArticleItem>) => void;
  removeArticleLocal: (id: string) => void;
  updateFeedLocal: (id: string, data: Partial<FeedItem>) => void;
  updateFeedUnread: (id: string, delta: number) => void;
  decrementUnreadCount: (n: number) => void;
  setIsLoadingArticles: (v: boolean) => void;
  setIsRefreshing: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  feeds: [],
  articles: [],
  categories: [],
  expandedCategories: new Set(),
  selectedFeedId: null,
  selectedCategoryId: null,
  selectedArticle: null,
  filter: "all",
  search: "",
  nextCursor: null,
  unreadCount: 0,
  starredCount: 0,
  isLoadingArticles: false,
  isRefreshing: false,

  setFeeds: (feeds) => set({ feeds }),
  setCategories: (categories) => set({ categories }),
  addCategory: (category) =>
    set((state) => ({ categories: [...state.categories, category] })),
  updateCategory: (id, data) =>
    set((state) => ({
      categories: state.categories.map((c) =>
        c.id === id ? { ...c, ...data } : c
      ),
    })),
  removeCategory: (id) =>
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
      selectedCategoryId:
        state.selectedCategoryId === id ? null : state.selectedCategoryId,
    })),
  toggleCategory: (id) =>
    set((state) => {
      const next = new Set(state.expandedCategories);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedCategories: next };
    }),
  setArticles: (articles, nextCursor, unreadCount, starredCount) =>
    set({ articles, nextCursor, unreadCount, starredCount }),
  appendArticles: (articles, nextCursor) =>
    set((state) => ({
      articles: [...state.articles, ...articles],
      nextCursor,
    })),
  selectFeed: (feedId) =>
    set({ selectedFeedId: feedId, selectedCategoryId: null, selectedArticle: null, nextCursor: null }),
  selectCategory: (categoryId) =>
    set({ selectedCategoryId: categoryId, selectedFeedId: null, selectedArticle: null, nextCursor: null }),
  selectArticle: (article) => set({ selectedArticle: article }),
  setFilter: (filter) => set({ filter, selectedArticle: null, selectedFeedId: null, selectedCategoryId: null, nextCursor: null }),
  setSearch: (search) => set({ search, selectedArticle: null, nextCursor: null }),
  updateArticleLocal: (id, data) =>
    set((state) => ({
      articles: state.articles.map((a) =>
        a.id === id ? { ...a, ...data } : a
      ),
      selectedArticle:
        state.selectedArticle?.id === id
          ? { ...state.selectedArticle, ...data }
          : state.selectedArticle,
    })),
  removeArticleLocal: (id) =>
    set((state) => ({
      articles: state.articles.filter((a) => a.id !== id),
      selectedArticle:
        state.selectedArticle?.id === id ? null : state.selectedArticle,
    })),
  updateFeedLocal: (id, data) =>
    set((state) => ({
      feeds: state.feeds.map((f) =>
        f.id === id ? { ...f, ...data } : f
      ),
    })),
  updateFeedUnread: (id, delta) =>
    set((state) => ({
      feeds: state.feeds.map((f) =>
        f.id === id ? { ...f, unreadCount: Math.max(0, f.unreadCount + delta) } : f
      ),
    })),
  decrementUnreadCount: (n) =>
    set((state) => ({
      unreadCount: Math.max(0, state.unreadCount + n),
    })),
  setIsLoadingArticles: (v) => set({ isLoadingArticles: v }),
  setIsRefreshing: (v) => set({ isRefreshing: v }),
}));