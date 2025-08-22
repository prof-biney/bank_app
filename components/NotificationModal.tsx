import { Bell, CreditCard, TrendingUp, X, Mail, MailOpen, Trash2, Eraser } from "lucide-react-native";
import ConfirmDialog from '@/components/modals/ConfirmDialog';
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
import { withAlpha } from "@/theme/color-utils";
import { getChipStyles } from "@/theme/variants";
import { ScrollView as GHScrollView, Swipeable } from 'react-native-gesture-handler';
import { Pressable } from 'react-native';
import CustomButton from "@/components/CustomButton";
import { getBadgeVisuals } from "@/theme/badge-utils";

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
  const [confirm, setConfirm] = React.useState<{ visible: boolean; title: string; message: string; tone?: 'default' | 'danger' | 'success'; onConfirm?: () => void } | null>(null);

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
        return <TrendingUp color={colors.tintPrimary} size={20} />;
      case "transaction":
        return <CreditCard color={colors.tintPrimary} size={20} />;
      default:
        return <Bell color={colors.textSecondary} size={20} />;
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
            <TouchableOpacity onPress={() => {
              setConfirm({
                visible: true,
                title: 'Mark all as read?',
                message: 'This will mark your latest notifications as read.',
                onConfirm: async () => {
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
                }
              });
            }} style={[styles.markAllButton, { backgroundColor: colors.background, borderColor: colors.border }]}> 
              <MailOpen color={colors.textSecondary} size={18} />
            </TouchableOpacity>
            {process.env.EXPO_PUBLIC_APP_ENV !== 'production' && (
              <TouchableOpacity onPress={() => {
                setConfirm({
                  visible: true,
                  title: 'Mark all as unread?',
                  message: 'This will mark your latest notifications as unread.',
                  onConfirm: async () => {
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
                  }
                });
              }} style={[styles.markAllButton, { backgroundColor: colors.background, borderColor: colors.border }]}> 
                <Mail color={colors.textSecondary} size={18} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => {
              setConfirm({
                visible: true,
                title: 'Delete all read notifications?',
                message: 'This will permanently delete all read notifications.',
                tone: 'danger',
                onConfirm: async () => {
                  try {
                    const apiBase = getApiBase();
                    const jwt = (global as any).__APPWRITE_JWT__ || undefined;
                    await fetch(`${apiBase.replace(/\/$/, '')}/v1/notifications/delete-read`, { method: 'POST', headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) } }).then(async (r) => { await r.json().catch(() => ({})); });
                  } catch {}
                  setItems(prev => prev.filter(n => n.unread));
                }
              });
            }} style={[styles.markAllButton, { backgroundColor: colors.background, borderColor: colors.border }]}> 
              <Trash2 color={colors.negative} size={18} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              setConfirm({
                visible: true,
                title: 'Clear all notifications?',
                message: 'This will permanently delete all notifications for your account.',
                tone: 'danger',
                onConfirm: async () => {
                  try {
                    const apiBase = getApiBase();
                    const jwt = (global as any).__APPWRITE_JWT__ || undefined;
                    const res = await fetch(`${apiBase.replace(/\/$/, '')}/v1/notifications/clear`, { method: 'POST', headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) } });
                    await res.json().catch(() => ({}));
                  } catch {}
                  setItems([]);
                  setNextCursor(null);
                },
              });
            }} style={[styles.markAllButton, { backgroundColor: colors.background, borderColor: colors.border }]}> 
              <Eraser color={colors.negative} size={18} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.background }]}>
              <X color={colors.textPrimary} size={24} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 0, paddingHorizontal: 16, paddingVertical: 8, flexWrap: 'wrap' }}>
          {(['all','unread','payment','transaction','statement','system'] as const).map(key => {
            const tone = key === 'all' ? 'neutral' :
                          key === 'unread' ? 'accent' :
                          key === 'payment' ? 'success' :
                          key === 'transaction' ? 'accent' :
                          key === 'statement' ? 'neutral' :
                          'warning';
            const v = getBadgeVisuals(colors, { tone: tone as any, selected: filter === key, size: 'sm' });
            const label = key[0].toUpperCase() + key.slice(1);
            return (
              <View key={key} style={{ marginRight: 5, marginBottom: 5 }}>
                <CustomButton
                  onPress={() => setFilter(key)}
                  title={label}
                  size="sm"
                  variant={v.textColor === '#fff' ? 'primary' : 'secondary'}
                  style={{ backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 5 }}
                  textStyle={{ color: v.textColor }}
                />
              </View>
            );
          })}
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
                    <TouchableOpacity onPress={async () => { const nowUnread = !notification.unread; setItems(prev => prev.map(n => n.id === notification.id ? { ...n, unread: nowUnread } : n)); await patchUnread(notification.id, nowUnread); }} style={[styles.swipeAction, { backgroundColor: colors.tintPrimary }]}> 
                      {notification.unread ? <MailOpen color="#fff" size={18} /> : <Mail color="#fff" size={18} />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                      setConfirm({
                        visible: true,
                        title: 'Delete this notification?',
                        message: 'This item will be permanently removed.',
                        onConfirm: async () => {
                          setItems(prev => prev.filter(n => n.id !== notification.id));
                          await deleteOne(notification.id);
                        }
                      });
                    }} style={[styles.swipeAction, { backgroundColor: colors.negative }]}> 
                      <Trash2 color="#fff" size={18} />
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
                      {notification.unread && <View style={[styles.unreadDot, { backgroundColor: colors.tintPrimary }]} />}
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
              }} style={{ backgroundColor: colors.tintPrimary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, opacity: loadingMore ? 0.8 : 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{loadingMore ? 'Loading…' : 'Load more'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
        {/* Confirm Dialog */}
        <ConfirmDialog
          visible={Boolean(confirm?.visible)}
          title={confirm?.title || ''}
          message={confirm?.message || ''}
          confirmText="Confirm"
          cancelText="Cancel"
          tone={confirm?.tone || 'default'}
          onConfirm={() => { try { confirm?.onConfirm?.(); } finally { setConfirm(null); } }}
          onCancel={() => setConfirm(null)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notificationMessage: {
    fontSize: 14,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
  },
});
