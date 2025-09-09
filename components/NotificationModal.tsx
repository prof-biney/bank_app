import { logger } from '@/lib/logger';
import { Bell, CreditCard, TrendingUp, X, Mail, MailOpen, Trash2, Eraser, Archive, ArchiveRestore } from "lucide-react-native";
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
import { ScrollView as GHScrollView, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Pressable } from 'react-native';
import CustomButton from "@/components/CustomButton";
import { getBadgeVisuals } from "@/theme/badge-utils";
import { useApp } from "@/context/AppContext";

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
}

export function NotificationModal({
  visible,
  onClose,
}: NotificationModalProps) {
  const { colors } = useTheme();
  const { 
    notifications, 
    markNotificationRead, 
    deleteNotification, 
    markAllNotificationsRead, 
    deleteAllReadNotifications, 
    clearAllNotifications, 
    toggleNotificationRead, 
    markAllNotificationsUnread,
    archiveNotification,
    unarchiveNotification,
    toggleNotificationArchive,
    archiveAllReadNotifications
  } = useApp();

  const [confirm, setConfirm] = React.useState<{ 
    visible: boolean; 
    title: string; 
    message: string; 
    tone?: 'default' | 'danger' | 'success'; 
    onConfirm?: () => void 
  } | null>(null);

  const [filter, setFilter] = React.useState<'all' | 'unread' | 'archived' | 'payment' | 'transaction' | 'statement' | 'system'>('all');
  
  const filtered = React.useMemo(() => {
    const base = notifications;
    logger.info('UI', '[NotificationModal] Filtering notifications:', {
      total: base.length,
      filter,
      unreadCount: base.filter(n => n.unread).length,
      notifications: base.map(n => ({ id: n.id, title: n.title.substring(0, 20), unread: n.unread, archived: n.archived }))
    });
    
    let result;
    if (filter === 'all') result = base.filter(n => !n.archived);
    else if (filter === 'unread') result = base.filter(n => n.unread && !n.archived);
    else if (filter === 'archived') result = base.filter(n => n.archived);
    else result = base.filter(n => n.type === filter && !n.archived);
    
    logger.info('UI', '[NotificationModal] Filtered result:', {
      count: result.length,
      unreadInResult: result.filter(n => n.unread).length
    });
    
    return result;
  }, [notifications, filter]);

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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Notifications</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity 
                onPress={() => {
                  setConfirm({
                    visible: true,
                    title: 'Mark all as read?',
                    message: 'This will mark your latest notifications as read.',
                    onConfirm: async () => {
                      await markAllNotificationsRead();
                      setConfirm(null);
                    }
                  });
                }} 
                style={[styles.markAllButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              >
                <MailOpen color={colors.textSecondary} size={16} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => {
                  setConfirm({
                    visible: true,
                    title: 'Mark all as unread?',
                    message: 'This will mark your latest notifications as unread.',
                    onConfirm: async () => {
                      await markAllNotificationsUnread();
                      setConfirm(null);
                    }
                  });
                }} 
                style={[styles.markAllButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              > 
                <Mail color={colors.textSecondary} size={16} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => {
                  setConfirm({
                    visible: true,
                    title: 'Archive all read notifications?',
                    message: 'This will archive all read notifications. You can find them in the Archived filter.',
                    onConfirm: async () => {
                      await archiveAllReadNotifications();
                      setConfirm(null);
                    }
                  });
                }} 
                style={[styles.markAllButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              > 
                <Archive color={colors.textSecondary} size={16} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => {
                  setConfirm({
                    visible: true,
                    title: 'Clear all notifications?',
                    message: 'This will permanently delete all notifications for your account.',
                    tone: 'danger',
                    onConfirm: async () => {
                      await clearAllNotifications();
                      setConfirm(null);
                    },
                  });
                }} 
                style={[styles.markAllButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              > 
                <Eraser color={colors.negative} size={16} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={onClose} 
                style={[styles.closeButton, { backgroundColor: colors.background }]}
              >
                <X color={colors.textPrimary} size={20} />
              </TouchableOpacity>
            </View>
          </View>
				
					<View>
						<GHScrollView 
							horizontal 
							showsHorizontalScrollIndicator={false} 
							contentContainerStyle={{ flexDirection: 'row', gap: 0, paddingHorizontal: 16, paddingVertical: 8 }}
						>
							{(['all','unread','archived','payment','transaction','statement','system'] as const).map(key => {
								const tone = key === 'all' ? 'neutral' :
									key === 'unread' ? 'accent' :
										key === 'archived' ? 'neutral' :
											key === 'payment' ? 'success' :
												key === 'transaction' ? 'accent' :
													key === 'statement' ? 'neutral' :
														'warning';
								const v = getBadgeVisuals(colors, { tone: tone as any, selected: filter === key, size: 'sm' });
								const label = key[0].toUpperCase() + key.slice(1);
								return (
									<View key={key} style={{ marginRight: 5 }}>
										<CustomButton
											onPress={() => setFilter(key)}
											title={label}
											size="sm"
											isFilterAction
											variant={v.textColor === '#fff' ? 'primary' : 'secondary'}
											style={{ backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: 1 }}
											textStyle={{ color: v.textColor }}
										/>
									</View>
								);
							})}
						</GHScrollView>
					</View>

          <ScrollView
            style={styles.notificationsList}
            showsVerticalScrollIndicator={true}
            indicatorStyle="default"
          >
            {filtered.length === 0 ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>No notifications</Text>
                <Text style={{ marginTop: 8, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 }}>
                  {notifications.length === 0 ? 'You\'ll see alerts about payments, cards, and account updates here.' : 'No items match this filter.'}
                </Text>
              </View>
            ) : (
              filtered.map((notification) => (
                <TouchableOpacity
                  key={notification.id}
                  style={[styles.notificationItem, { backgroundColor: colors.card }]}
                  onPress={async () => { 
                    if (notification.unread) await markNotificationRead(notification.id); 
                  }}
                  onLongPress={async () => { 
                    await toggleNotificationRead(notification.id); 
                  }}
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
                    
                    {/* Individual Action Buttons */}
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        onPress={() => {
                          setConfirm({
                            visible: true,
                            title: notification.archived ? 'Unarchive this notification?' : 'Archive this notification?',
                            message: notification.archived ? 'This notification will be moved back to your active notifications.' : 'This notification will be archived and moved out of your main list.',
                            tone: notification.archived ? 'success' : 'default',
                            onConfirm: async () => {
                              await toggleNotificationArchive(notification.id);
                              setConfirm(null);
                            }
                          });
                        }}
                        style={[styles.actionButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                      >
                        {notification.archived ? <ArchiveRestore color={colors.textSecondary} size={16} /> : <Archive color={colors.textSecondary} size={16} />}
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        onPress={() => {
                          setConfirm({
                            visible: true,
                            title: 'Delete this notification?',
                            message: 'This item will be permanently removed.',
                            tone: 'danger',
                            onConfirm: async () => {
                              await deleteNotification(notification.id);
                              setConfirm(null);
                            }
                          });
                        }}
                        style={[styles.actionButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                      >
                        <Trash2 color={colors.negative} size={16} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
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
            onConfirm={async () => { 
              try { 
                await confirm?.onConfirm?.(); 
              } finally { 
                setConfirm(null); 
              } 
            }}
            onCancel={() => setConfirm(null)}
          />
        </View>
      </GestureHandlerRootView>
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
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 32,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
