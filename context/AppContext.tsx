import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Card, Transaction } from "../constants/index";
import type { Notification } from "@/types";
import { ActivityEvent } from "@/types/activity";
import { appwriteConfig, client, logCardEvent, databases } from "@/lib/appwrite";

interface AppContextType {
  cards: Card[];
  transactions: Transaction[];
  activeCard: Card | null;
  setActiveCard: (card: Card) => void;
  addCard: (card: Omit<Card, "id" | "balance"> & Partial<Pick<Card, "balance">>) => void;
  removeCard: (cardId: string) => void;
  addTransaction: (transaction: Omit<Transaction, "id" | "date">) => void;
  isLoadingCards: boolean;
  // Activity events
  activity: ActivityEvent[];
  pushActivity: (evt: ActivityEvent) => void;
  setActivity: React.Dispatch<React.SetStateAction<ActivityEvent[]>>;
  // Notifications
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  markNotificationRead: (id: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  deleteAllReadNotifications: () => Promise<void>;
  toggleNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsUnread: () => Promise<void>;
  clearAllNotifications: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

const pushActivity: AppContextType["pushActivity"] = (evt) => {
    setActivity((prev) => [evt, ...prev]);
  };

  const addTransaction = (
    transactionData: Omit<Transaction, "id" | "date">
  ) => {
    const newTransaction: Transaction = {
      ...transactionData,
      id: Date.now().toString(),
      date: new Date().toISOString(),
    };
    setTransactions((prev) => [newTransaction, ...prev]);

    // Push activity event
    pushActivity({
      id: `tx.${newTransaction.id}`,
      category: 'transaction',
      type: `transaction.${newTransaction.type}`,
      title: `${newTransaction.type.charAt(0).toUpperCase()}${newTransaction.type.slice(1)}: ${newTransaction.description}`,
      subtitle: new Date(newTransaction.date).toLocaleString(),
      amount: newTransaction.amount,
      currency: 'USD',
      status: newTransaction.status as any,
      timestamp: newTransaction.date,
      transactionId: newTransaction.id,
      cardId: newTransaction.cardId,
      tags: [newTransaction.category],
    });
  };

const addCard: AppContextType["addCard"] = (cardData) => {
    const newCard: Card = {
      id: Date.now().toString(),
      userId: cardData.userId,
      cardNumber: cardData.cardNumber,
      cardHolderName: cardData.cardHolderName,
      expiryDate: cardData.expiryDate,
      balance: cardData.balance ?? 0,
      cardType: cardData.cardType,
      isActive: true,
      cardColor: cardData.cardColor,
    };
    setCards((prev) => [newCard, ...prev]);
    setActiveCard(newCard);

    // Activity
    pushActivity({
      id: `card.added.${newCard.id}`,
      category: 'card',
      type: 'card.added',
      title: 'Card added',
      subtitle: `${newCard.cardHolderName} • ${newCard.cardNumber}`,
      timestamp: new Date().toISOString(),
      cardId: newCard.id,
      tags: ['card','added'],
    });

    // Persist to Appwrite (fire-and-forget)
    try {
      const last4 = (newCard.cardNumber.match(/(\d{4})$/) || [])[0];
      logCardEvent({
        status: "added",
        cardId: newCard.id,
        userId: newCard.userId,
        last4,
        brand: newCard.cardType,
        cardHolderName: newCard.cardHolderName,
        expiryDate: newCard.expiryDate,
        title: "Card added",
        description: `${newCard.cardHolderName} • ${newCard.cardNumber}`,
      });
    } catch {}
  };

const removeCard: AppContextType["removeCard"] = (cardId) => {
    const removed = cards.find(c => c.id === cardId);
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    setActiveCard((prev) => (prev?.id === cardId ? null : prev));

    // Activity
    pushActivity({
      id: `card.removed.${cardId}`,
      category: 'card',
      type: 'card.removed',
      title: 'Card removed',
      subtitle: removed ? `${removed.cardHolderName} • ${removed.cardNumber}` : undefined,
      timestamp: new Date().toISOString(),
      cardId,
      tags: ['card','removed'],
    });

    // Persist to Appwrite (fire-and-forget)
    try {
      const last4 = removed?.cardNumber?.match(/(\d{4})$/)?.[0];
      logCardEvent({
        status: "removed",
        cardId,
        userId: removed?.userId,
        last4,
        brand: removed?.cardType,
        cardHolderName: removed?.cardHolderName,
        expiryDate: removed?.expiryDate,
        title: "Card removed",
        description: removed ? `${removed.cardHolderName} • ${removed.cardNumber}` : undefined,
      });
    } catch {}
  };

  // Initial load from server for cards (optional; no mock data)
  useEffect(() => {
    const { getApiBase } = require('../lib/api');
    const loadCards = async () => {
      setIsLoadingCards(true);
      try {
        const jwt = (global as any).__APPWRITE_JWT__ || undefined;
        const url = `${getApiBase()}/v1/cards`;
        const res = await fetch(url, {
          headers: {
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
          },
        });
        if (!res.ok) return; // no-op
        const data = await res.json();
        // Server returns { data: Card[] }
        const list = Array.isArray((data as any)?.data) ? (data as any).data : (Array.isArray(data) ? data : []);
        setCards(list as Card[]);
        setActiveCard((list as Card[])[0] || null);
      } catch {}
      finally {
        setIsLoadingCards(false);
      }
    };
    loadCards();
  }, []);

  // Load notifications from storage first, then fetch from Appwrite
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('notifications');
        if (raw) {
          const parsed: Notification[] = JSON.parse(raw);
          setNotifications(parsed);
        }
      } catch {}
    })();
  }, []);

  // Initial load of notifications (if configured)
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const dbId = appwriteConfig.databaseId;
        const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
        if (!dbId || !notifCol) return;
        const resp: any = await databases.listDocuments(dbId, notifCol);
        const docs = Array.isArray(resp?.documents) ? resp.documents : [];
        const fetched: Notification[] = docs.map((d: any) => ({
          id: d.$id,
          userId: d.userId,
          title: d.title,
          message: d.message,
          type: d.type,
          unread: d.unread,
          createdAt: d.$createdAt || d.createdAt,
        }));
        // Merge with any local notifications (prefer fetched)
        setNotifications(prev => {
          const map = new Map<string, Notification>();
          for (const n of prev) map.set(n.id, n);
          for (const n of fetched) map.set(n.id, n);
          const merged = Array.from(map.values());
          merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          return merged;
        });
      } catch {}
    };
    loadNotifications();
  }, []);

  // Persist notifications to storage
  useEffect(() => {
    AsyncStorage.setItem('notifications', JSON.stringify(notifications)).catch(() => {});
  }, [notifications]);

  // Appwrite Realtime subscription
  useEffect(() => {
    const dbId = appwriteConfig.databaseId;
    const txCol = appwriteConfig.transactionsCollectionId;
    const cardCol = appwriteConfig.cardsCollectionId;
    const acctCol = appwriteConfig.accountUpdatesCollectionId;
    const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;

    const channels: string[] = [];
    if (dbId && txCol) channels.push(`databases.${dbId}.collections.${txCol}.documents`);
    if (dbId && cardCol) channels.push(`databases.${dbId}.collections.${cardCol}.documents`);
    if (dbId && acctCol) channels.push(`databases.${dbId}.collections.${acctCol}.documents`);
    if (dbId && notifCol) channels.push(`databases.${dbId}.collections.${notifCol}.documents`);

    if (channels.length === 0) return;

    const unsub = client.subscribe(channels, (message: any) => {
      try {
        const { events, payload } = message as { events: string[]; payload: any };
        const eventStr = events?.[0] || '';
        const ts = new Date().toISOString();

        // Notifications: handle separately
        if (notifCol && eventStr.includes(`collections.${notifCol}.`)) {
          const n: Notification = {
            id: payload?.$id || `rt.${Date.now()}`,
            userId: payload?.userId,
            title: payload?.title || 'Notification',
            message: payload?.message || '',
            type: payload?.type,
            unread: typeof payload?.unread === 'boolean' ? payload.unread : true,
            createdAt: payload?.$createdAt || ts,
          };
          setNotifications((prev) => [n, ...prev]);
          return;
        }

        // Determine category by collection in event string (for activity timeline)
        let category: ActivityEvent['category'] = 'account';
        if (txCol && eventStr.includes(`collections.${txCol}.`)) category = 'transaction';
        else if (cardCol && eventStr.includes(`collections.${cardCol}.`)) category = 'card';
        else category = 'account';

        // Map to ActivityEvent
        const evt: ActivityEvent = {
          id: payload?.$id ? `rt.${payload.$id}` : `rt.${Date.now()}`,
          category,
          type: eventStr.split('.documents.')[1] ? `realtime.${eventStr.split('.documents.')[1]}` : 'realtime.update',
          title:
            category === 'transaction'
              ? `Transaction ${payload?.type || ''}`.trim()
              : category === 'card'
              ? `Card update`
              : `Account update`,
          subtitle: payload?.description || payload?.title || undefined,
          amount: typeof payload?.amount === 'number' ? payload.amount : undefined,
          currency: payload?.currency,
          status: payload?.status,
          timestamp: payload?.$updatedAt || payload?.$createdAt || ts,
          accountId: payload?.accountId,
          cardId: payload?.cardId,
          transactionId: payload?.transactionId || payload?.$id,
          tags: payload?.category ? [payload.category] : undefined,
        };
        pushActivity(evt);
      } catch (e) {
        // Swallow mapping errors
      }
    });

    return () => {
      try { unsub(); } catch {}
    };
  }, []);

  const markNotificationRead: AppContextType['markNotificationRead'] = async (id) => {
    const dbId = appwriteConfig.databaseId;
    const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
    if (!dbId || !notifCol) return;
    // Optimistic update
    let prev: Notification[] | null = null;
    setNotifications(cur => {
      prev = cur;
      return cur.map(n => (n.id === id ? { ...n, unread: false } : n));
    });
    try {
      await databases.updateDocument(dbId, notifCol, id, { unread: false });
    } catch (e) {
      // Revert on failure
      if (prev) setNotifications(prev);
    }
  };

  const deleteNotification: AppContextType['deleteNotification'] = async (id) => {
    const dbId = appwriteConfig.databaseId;
    const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
    if (!dbId || !notifCol) return;
    let prev: Notification[] | null = null;
    setNotifications(cur => {
      prev = cur;
      return cur.filter(n => n.id !== id);
    });
    try {
      await databases.deleteDocument(dbId, notifCol, id);
    } catch (e) {
      if (prev) setNotifications(prev);
    }
  };

  const markAllNotificationsRead: AppContextType['markAllNotificationsRead'] = async () => {
    const dbId = appwriteConfig.databaseId;
    const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
    if (!dbId || !notifCol) return;
    const unread = notifications.filter(n => n.unread).map(n => n.id);
    if (unread.length === 0) return;
    // Optimistic
    const prev = notifications;
    setNotifications(cur => cur.map(n => ({ ...n, unread: false })));
    try {
      // Fire updates sequentially to keep it simple; could be parallel
      for (const id of unread) {
        // eslint-disable-next-line no-await-in-loop
        await databases.updateDocument(dbId, notifCol, id, { unread: false });
      }
    } catch (e) {
      setNotifications(prev);
    }
  };

  const deleteAllReadNotifications: AppContextType['deleteAllReadNotifications'] = async () => {
    const dbId = appwriteConfig.databaseId;
    const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
    if (!dbId || !notifCol) return;
    const toDelete = notifications.filter(n => !n.unread).map(n => n.id);
    if (toDelete.length === 0) return;
    const prev = notifications;
    // Optimistic: remove read items
    setNotifications(cur => cur.filter(n => n.unread));
    try {
      for (const id of toDelete) {
        // eslint-disable-next-line no-await-in-loop
        await databases.deleteDocument(dbId, notifCol, id);
      }
    } catch (e) {
      setNotifications(prev);
    }
  };

  const toggleNotificationRead: AppContextType['toggleNotificationRead'] = async (id) => {
    const dbId = appwriteConfig.databaseId;
    const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
    if (!dbId || !notifCol) return;
    let prev: Notification[] | null = null;
    let nextUnread = true;
    setNotifications(cur => {
      prev = cur;
      const updated = cur.map(n => {
        if (n.id === id) {
          nextUnread = !n.unread;
          return { ...n, unread: !n.unread };
        }
        return n;
      });
      return updated;
    });
    try {
      await databases.updateDocument(dbId, notifCol, id, { unread: nextUnread });
    } catch (e) {
      if (prev) setNotifications(prev);
    }
  };

  const markAllNotificationsUnread: AppContextType['markAllNotificationsUnread'] = async () => {
    const dbId = appwriteConfig.databaseId;
    const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
    if (!dbId || !notifCol) return;
    const readIds = notifications.filter(n => !n.unread).map(n => n.id);
    if (readIds.length === 0) return;
    const prev = notifications;
    setNotifications(cur => cur.map(n => ({ ...n, unread: true })));
    try {
      for (const id of readIds) {
        // eslint-disable-next-line no-await-in-loop
        await databases.updateDocument(dbId, notifCol, id, { unread: true });
      }
    } catch (e) {
      setNotifications(prev);
    }
  };

  const clearAllNotifications: AppContextType['clearAllNotifications'] = async () => {
    try {
      const { getApiBase } = require('../lib/api');
      const url = `${getApiBase()}/v1/notifications/clear`;
      const jwt = (global as any).__APPWRITE_JWT__ || undefined;
      const headers: any = { 'Content-Type': 'application/json' };
      if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
      const res = await fetch(url, { method: 'POST', headers });
      if (!res.ok) {
        console.warn('Failed to clear notifications (server)');
        return;
      }
      setNotifications([]);
    } catch (e) {
      console.warn('clearAllNotifications error', e);
    }
  };

  return (
    <AppContext.Provider
      value={{
        cards,
        transactions,
        activeCard,
        setActiveCard,
        addCard,
        removeCard,
        addTransaction,
        isLoadingCards,
        activity,
        pushActivity,
        setActivity,
        notifications,
        setNotifications,
        markNotificationRead,
        deleteNotification,
        markAllNotificationsRead,
        deleteAllReadNotifications,
        toggleNotificationRead,
        markAllNotificationsUnread,
        clearAllNotifications,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
