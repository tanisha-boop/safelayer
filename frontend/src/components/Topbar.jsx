import { useEffect, useRef, useState } from "react";

import {
  Bell,
  Check,
  CheckCheck,
  LogOut,
  Menu,
  Search,
  X,
  Moon,
  Sun,
  Loader2,
} from "lucide-react";
import { api } from "../services/api";

export default function Topbar({
  activePage,
  user,
  setSidebarOpen,
  setActivePage,
  onLogout,
  theme,
  setTheme,
}) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const notificationRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchRef = useRef(null);
  const searchTimerRef = useRef(null);

  const firstName = user?.firstName || user?.first_name || "User";
  const lastName = user?.lastName || user?.last_name || "";

  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  const role =
    user?.roles?.[0]?.name ||
    user?.role ||
    "USER";

  const pageTitles = {
    overview: "Dashboard",
    dashboard: "Dashboard",
    "field-operations": "Field Operations",
    evidence: "Evidence",
    "route-proof": "RouteProof",
    "field-ledger": "Field Ledger",
    "invoice-guard": "Invoice Guard",
    reviews: "Reviews",
    "risk-trust": "Risk & Trust",
    reports: "Reports",
    compliance: "Compliance",
    settings: "Settings",
    help: "Help",
  };

  const pageTitle =
    pageTitles[activePage] ||
    activePage?.replace(/-/g, " ") ||
    "Dashboard";

  async function loadNotifications() {
    try {
      setLoadingNotifications(true);

      const response = await api.getNotifications(1, 20);
      const data = response?.data || {};

      setNotifications(data.notifications || []);
      setUnreadCount(Number(data.unreadCount || 0));
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setLoadingNotifications(false);
    }
  }

useEffect(() => {
  const timer = setTimeout(() => {
    loadNotifications();
  }, 0);

  const interval = setInterval(() => {
    loadNotifications();
  }, 30000);

  return () => {
    clearTimeout(timer);
    clearInterval(interval);
  };
}, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setNotificationsOpen(false);
      }

      if (
        searchRef.current &&
        !searchRef.current.contains(event.target)
      ) {
        setSearchOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current = setTimeout(async () => {
      if (!query) {
        setSearchResults([]);
        setSearchError("");
        setSearchLoading(false);
        return;
      }

      setSearchOpen(true);
      setSearchLoading(true);
      setSearchError("");

      try {
        const response = await api.search(query);
        setSearchResults(response?.data?.results || []);
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults([]);
        setSearchError(error.message || "Search failed.");
      } finally {
        setSearchLoading(false);
      }
    }, query ? 300 : 0);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchQuery]);

  function handleSearchResultClick(result) {
    if (result?.page) {
      setActivePage(result.page);
    }

    setSearchOpen(false);
    setSearchQuery("");
  }

  async function handleNotificationClick(notification) {
    const pageByEntityType = {
      COMPLIANCE_REQUIREMENT: "compliance",
      COMPLIANCE_EVIDENCE: "compliance",
      INVOICE: "invoice-guard",
      FIELD_ACTIVITY: "field-operations",
      EVIDENCE: "evidence",
    };

    const targetPage =
      pageByEntityType[notification.entity_type];

    if (targetPage) {
      setActivePage(targetPage);
      setNotificationsOpen(false);
    }

    const isUnread =
      Number(notification.is_read) === 0 ||
      notification.is_read === false;

    if (!isUnread) {
      return;
    }

    try {
      await api.markNotificationRead(notification.id);

      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? {
                ...item,
                is_read: 1,
                read_at: new Date().toISOString(),
              }
            : item
        )
      );

      setUnreadCount((current) => Math.max(current - 1, 0));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0) {
      return;
    }

    try {
      await api.markAllNotificationsRead();

      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          is_read: 1,
          read_at: new Date().toISOString(),
        }))
      );

      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  }

  function formatNotificationTime(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) {
      return "Just now";
    }

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);

    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }

    const diffDays = Math.floor(diffHours / 24);

    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }

    return date.toLocaleDateString();
  }

  function getResultTitle(result) {
    return (
      result?.title ||
      result?.name ||
      result?.invoice_number ||
      result?.transaction_reference ||
      result?.activity_title ||
      "SafeLayer record"
    );
  }

  function getResultSubtitle(result) {
    if (result?.type) {
      return result.type;
    }

    if (result?.entityType) {
      return result.entityType;
    }

    return result?.description || result?.status || "";
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-950/95">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={() => setSidebarOpen?.(true)}
          className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold capitalize text-slate-900 dark:text-white">
            {pageTitle}
          </h1>

          <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
            Operational visibility and trust
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative hidden sm:block" ref={searchRef}>
          <div className="flex w-[260px] items-center rounded-xl border border-slate-200 bg-white px-3 transition focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:focus-within:border-slate-700 dark:focus-within:ring-slate-800">
            {searchLoading ? (
              <Loader2
                size={17}
                className="shrink-0 animate-spin text-slate-400 dark:text-slate-500"
              />
            ) : (
              <Search size={17} className="shrink-0 text-slate-400 dark:text-slate-500" />
            )}

            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onFocus={() => {
                if (searchQuery.trim()) {
                  setSearchOpen(true);
                }
              }}
              placeholder="Search SafeLayer..."
              className="w-full bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
              aria-label="Search SafeLayer"
            />

            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchOpen(false);
                }}
                className="rounded-md p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {searchOpen && searchQuery.trim() && (
            <div className="absolute right-0 top-full z-50 mt-2 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Search results
                </p>
              </div>

              {searchLoading ? (
                <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                  <Loader2 size={16} className="animate-spin" />
                  Searching SafeLayer...
                </div>
              ) : searchError ? (
                <div className="px-4 py-6 text-sm text-red-600 dark:text-red-400">
                  {searchError}
                </div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                  No matching SafeLayer records found.
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto">
                  {searchResults.map((result, index) => (
                    <button
                      type="button"
                      key={`${result.type || "result"}-${result.id || index}`}
                      onClick={() => handleSearchResultClick(result)}
                      className="w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {getResultTitle(result)}
                          </p>

                          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                            {getResultSubtitle(result)}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                          {result.page?.replace(/-/g, " ") || "record"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="relative" ref={notificationRef}>
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen((current) => !current);

              if (!notificationsOpen) {
                loadNotifications();
              }
            }}
            className="relative rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
          >
            <Bell size={18} />

            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 z-50 mt-3 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Notifications
                  </h2>

                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {unreadCount > 0
                      ? `${unreadCount} unread`
                      : "You're all caught up"}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                      title="Mark all as read"
                      aria-label="Mark all notifications as read"
                    >
                      <CheckCheck size={17} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(false)}
                    className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                    aria-label="Close notifications"
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>

              <div className="max-h-[420px] overflow-y-auto">
                {loadingNotifications && notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    Loading notifications...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                      <Bell size={18} className="text-slate-400 dark:text-slate-500" />
                    </div>

                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      No notifications
                    </p>

                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      New activity and review events will appear here.
                    </p>
                  </div>
                ) : (
                  notifications.map((notification) => {
                    const unread =
                      Number(notification.is_read) === 0 ||
                      notification.is_read === false;

                    return (
                      <button
                        type="button"
                        key={notification.id}
                        onClick={() =>
                          handleNotificationClick(notification)
                        }
                        className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 ${
                          unread
                            ? "bg-blue-50/40 dark:bg-blue-950/20"
                            : "bg-white dark:bg-slate-900"
                        }`}
                      >
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                          {unread ? (
                            <Bell size={15} className="text-blue-600" />
                          ) : (
                            <Check size={15} className="text-slate-400 dark:text-slate-500" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`text-sm ${
                                unread
                                  ? "font-semibold text-slate-900 dark:text-slate-100"
                                  : "font-medium text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {notification.title}
                            </p>

                            {unread && (
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                            )}
                          </div>

                          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {notification.message}
                          </p>

                          <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                            {formatNotificationTime(
                              notification.created_at
                            )}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="hidden h-8 w-px bg-slate-200 dark:bg-slate-800 sm:block" />

        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
            {initials}
          </div>

          <div className="hidden min-w-0 md:block">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
              {firstName} {lastName}
            </p>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {role}
            </p>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl p-2.5 text-slate-400 dark:text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
