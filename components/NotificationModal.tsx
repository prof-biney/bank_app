import { Bell, CreditCard, TrendingUp, X } from "lucide-react-native";
import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { ScrollView as GHScrollView, Swipeable } from 'react-native-gesture-handler';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
}

export function NotificationModal({
  visible,
  onClose,
}: NotificationModalProps) {
  const { colors } = useTheme();
  const { getApiBase } = require('../lib/api');

  type NotificationItem = {
    id: string;
    type: 'payment' | 'transaction' | 'statement' | 'system' | string;
    title: string;
    message: string;
    createdAt: string;
    unread: boolean;
  };

  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [filter, setFilter] = React.useState<'all' | 'unread' | 'payment' | 'transaction' | 'statement' | 'system'>('all');
  const filtered = React.useMemo(() => {
    const base = items;
    if (filter === 'all') return base;
    if (filter === 'unread') return base.filter(n => n.unread);
    return base.filter(n => n.type === filter);
  }, [items, filter]);

  const PAGE_SIZE = 15;

  const mapDoc = (d: any): NotificationItem => ({
    id: d.$id,
    type: d.type || 'system',
    title: d.title || d.subject || 'Notification',
    message: d.message || d.body || '',
    createdAt: d.$createdAt || d.createdAt || new Date().toISOString(),
    unread: d.unread !== false,
  });

  const fetchPage = async (cursor?: string) => {
    const apiBase = getApiBase();
    const jwt = (global as any).__APPWRITE_JWT__ || undefined;
    const url = `${apiBase.replace(/\/$/, "")}/v1/notifications?limit=${PAGE_SIZE}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const headers: any = { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) };
    const res = await fetch(url, { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    const docs = Array.isArray(data?.data) ? data.data : [];
    const mapped: NotificationItem[] = docs.map(mapDoc);
    return { list: mapped, next: data?.nextCursor ?? null };
  };

  const patchUnread = async (id: string, unread: boolean) => {
    const apiBase = getApiBase();
    const jwt = (global as any).__APPWRITE_JWT__ || undefined;
    await fetch(`${apiBase.replace(/\/$/, "")}/v1/notifications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
      body: JSON.stringify({ unread })
    }).then(async (r) => { await r.json().catch(() => ({})); }).catch(() => {});
  };

  const deleteOne = async (id: string) => {
    const apiBase = getApiBase();
    const jwt = (global as any).__APPWRITE_JWT__ || undefined;
    await fetch(`${apiBase.replace(/\/$/, "")}/v1/notifications/${id}`, {
      method: 'DELETE',
      headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    }).then(async (r) => { await r.json().catch(() => ({})); }).catch(() => {});
  };

  React.useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        setLoading(true);
        const { list, next } = await fetchPage();
        setItems(list);
        setNextCursor(next);
      } catch (e: any) {
        setError(e?.message || 'Failed to load notifications');
      } finally {
        setLoading(false);
      }
    })();
  }, [visible]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "payment":
        return <TrendingUp color="#10B981" size={20} />;
      case "transaction":
        return <CreditCard color="#0F766E" size={20} />;
      default:
        return <Bell color="#6B7280" size={20} />;
    }
  };

  React.useEffect(() => {
    if (visible) {
      // Auto-mark the newest 5 unread notifications as read (client-side only)
      setItems(prev => {
        const copy = [...prev];
        let remaining = 5;
        for (let i = 0; i < copy.length && remaining > 0; i++) {
          if (copy[i].unread) { copy[i] = { ...copy[i], unread: false }; remaining--; }
        }
        return copy;
      });
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }] }>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Notifications</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={async () => {
              try {
                const apiBase = getApiBase();
                const jwt = (global as any).__APPWRITE_JWT__ || undefined;
                await fetch(`${apiBase.replace(/\/$/, '')}/v1/notifications/mark-all`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
                  body: JSON.stringify({ unread: false })
                }).then(async (r) => { await r.json().catch(() => ({})); });
              } catch {}
              setItems(prev => prev.map(n => ({ ...n, unread: false })));
            }} style={[styles.markAllButton, { backgroundColor: colors.background, borderColor: colors.border }]}> 
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Mark all as read</Text>
            </TouchableOpacity>
            {process.env.EXPO_PUBLIC_APP_ENV !== 'production' && (
              <TouchableOpacity onPress={async () => {
                try {
                  const apiBase = getApiBase();
                  const jwt = (global as any).__APPWRITE_JWT__ || undefined;
                  await fetch(`${apiBase.replace(/\/$/, '')}/v1/notifications/mark-all`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
                    body: JSON.stringify({ unread: true })
                  }).then(async (r) => { await r.json().catch(() => ({})); });
                } catch {}
                setItems(prev => prev.map(n => ({ ...n, unread: true })));
              }} style={[styles.markAllButton, { backgroundColor: colors.background, borderColor: colors.border }]}> 
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Mark all as unread</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={async () => {
              try {
                const apiBase = getApiBase();
                const jwt = (global as any).__APPWRITE_JWT__ || undefined;
                await fetch(`${apiBase.replace(/\/$/, '')}/v1/notifications/delete-read`, { method: 'POST', headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) } }).then(async (r) => { await r.json().catch(() => ({})); });
              } catch {}
              setItems(prev => prev.filter(n => n.unread));
            }} style={[styles.markAllButton, { backgroundColor: colors.background, borderColor: colors.border }]}> 
              <Text style={{ color: '#ef4444', fontWeight: '600' }}>Delete read</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              Alert.alert(
                'Clear all notifications?',
                'This will permanently delete all notifications for your account.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear all', style: 'destructive', onPress: async () => {
                    try {
                      const apiBase = getApiBase();
                      const jwt = (global as any).__APPWRITE_JWT__ || undefined;
                      const res = await fetch(`${apiBase.replace(/\/$/, '')}/v1/notifications/clear`, { method: 'POST', headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) } });
                      await res.json().catch(() => ({}));
                    } catch {}
                    setItems([]);
                    setNextCursor(null);
                  } },
                ]
              );
            }} style={[styles.markAllButton, { backgroundColor: colors.background, borderColor: colors.border }]}> 
              <Text style={{ color: '#ef4444', fontWeight: '600' }}>Clear all</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.background }]}>
              <X color={colors.textPrimary} size={24} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10 }}>
          {(['all','unread','payment','transaction','statement','system'] as const).map(key => (
            <TouchableOpacity key={key} onPress={() => setFilter(key)} style={[styles.filterChip, { backgroundColor: filter === key ? '#0F766E' : colors.card, borderColor: colors.border }] }>
              <Text style={{ color: filter === key ? '#fff' : colors.textSecondary, fontWeight: '600', fontSize: 12 }}>{key[0].toUpperCase() + key.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          style={styles.notificationsList}
          showsVerticalScrollIndicator={false}
        >
          {filtered.length === 0 ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>No notifications</Text>
              <Text style={{ marginTop: 8, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 }}>
                {items.length === 0 ? 'You’ll see alerts about payments, cards, and account updates here.' : 'No items match this filter.'}
              </Text>
            </View>
          ) : (
            filtered.map((notification) => (
              <Swipeable
                key={notification.id}
                renderRightActions={() => (
                  <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
                    {notification.unread && (
                      <TouchableOpacity onPress={async () => { setItems(prev => prev.map(n => n.id === notification.id ? { ...n, unread: false } : n)); await patchUnread(notification.id, false); }} style={[styles.swipeAction, { backgroundColor: '#0F766E' }]}> 
                        <Text style={styles.swipeActionText}>Mark read</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={async () => { setItems(prev => prev.filter(n => n.id !== notification.id)); await deleteOne(notification.id); }} style={[styles.swipeAction, { backgroundColor: '#ef4444' }]}> 
                      <Text style={styles.swipeActionText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              >
                <TouchableOpacity
                  style={[styles.notificationItem, { backgroundColor: colors.card }]}
                  onPress={async () => { setItems(prev => prev.map(n => n.id === notification.id ? { ...n, unread: false } : n)); await patchUnread(notification.id, false); }}
                  onLongPress={async () => { const nowUnread = !notification.unread; setItems(prev => prev.map(n => n.id === notification.id ? { ...n, unread: nowUnread } : n)); await patchUnread(notification.id, nowUnread); }}
                >
                  <View style={[styles.notificationIcon, { backgroundColor: colors.background }]}> 
                    {getNotificationIcon(notification.type as string)}
                  </View>
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationHeader}>
                      <Text style={[styles.notificationTitle, { color: colors.textPrimary }]}>
                        {notification.title}
                      </Text>
                      {notification.unread && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={[styles.notificationMessage, { color: colors.textSecondary }]}>
                      {notification.message}
                    </Text>
                    <Text style={[styles.notificationTime, { color: colors.textSecondary }]}>
                  {notification.createdAt ? new Date(notification.createdAt).toLocaleString() : ''}
                </Text>
              </View>
            </TouchableOpacity>
          </Swipeable>
        ))
      )}
      {nextCursor && (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <TouchableOpacity onPress={async () => {
                try {
                  setLoadingMore(true);
                  const { list, next } = await fetchPage(nextCursor);
                  setItems(prev => {
                    const seen = new Set(prev.map(n => n.id));
                    const merged = [...prev];
                    for (const it of list) if (!seen.has(it.id)) merged.push(it);
                    return merged;
                  });
                  setNextCursor(next);
                } catch (e: any) {
                  setError(e?.message || 'Failed to load notifications');
                } finally {
                  setLoadingMore(false);
                }
              }} style={{ backgroundColor: '#0F766E', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, opacity: loadingMore ? 0.8 : 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{loadingMore ? 'Loading…' : 'Load more'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  notificationsList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  markAllButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  notificationItem: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginVertical: 6,
    borderRadius: 8,
  },
  swipeActionText: {
    color: '#fff',
    fontWeight: '700',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0F766E",
  },
  notificationMessage: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
});
