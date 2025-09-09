import { Filter, ArrowDownLeft, ArrowUpRight, User, CreditCard as CardIcon, CreditCard } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { 
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	View,
	TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { DateFilterModal } from "@/components/DateFilterModal";
import ActivityLogItem from "@/components/activity/ActivityLogItem";
import ActivityDetailModal from "@/components/activity/ActivityDetailModal";
import { ClearDataModal } from "@/components/ClearDataModal";
import { useTheme } from "@/context/ThemeContext";
import CustomButton from "@/components/CustomButton";
import { getBadgeVisuals } from "@/theme/badge-utils";
import { TransactionItem } from "@/components/TransactionItem";
import { useApp } from "@/context/AppContext";
import { ActivityEvent } from "@/types/activity";

type Payment = { id: string; status: string; amount?: number; currency?: string; created?: string };

export default function ActivityScreen() {

	const handleCapture = async (id: string) => {
		try {
			const { getApiBase } = require('@/lib/api');
			const apiBase = getApiBase();
			const url = `${apiBase.replace(/\/$/, "")}/v1/payments/${id}/capture`;
			const jwt = (global as any).__APPWRITE_JWT__ || undefined;
			const headers: any = {};
			if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
			const res = await fetch(url, { method: 'POST', headers });
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
			setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'captured' } : p)));
		} catch (e) {}
	};

	const handleRefund = async (id: string) => {
		try {
			const { getApiBase } = require('@/lib/api');
			const apiBase = getApiBase();
			const url = `${apiBase.replace(/\/$/, "")}/v1/payments/${id}/refund`;
			const jwt = (global as any).__APPWRITE_JWT__ || undefined;
			const headers: any = {};
			if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
			const res = await fetch(url, { method: 'POST', headers });
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
			setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'refunded' } : p)));
		} catch (e) {}
	};
	const { transactions, activity, clearAllActivity } = useApp();
	const [suppressAllLogs, setSuppressAllLogs] = useState(false);
	const { getApiBase } = require('@/lib/api');
	const [payments, setPayments] = React.useState<Payment[]>([]);
	const [loading, setLoading] = React.useState(false);
	const [loadingMore, setLoadingMore] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [showClearActivity, setShowClearActivity] = React.useState(false);
	const [isClearingActivity, setIsClearingActivity] = React.useState(false);
	const PAY_PAGE_SIZE = 10;
	const [nextPaymentsCursor, setNextPaymentsCursor] = React.useState<string | null>(null);

	// Maps Activity screen status chips to payment statuses
	const paymentStatusMap: Record<string, string> = {
		completed: 'captured',
		pending: 'authorized',
		failed: 'failed',
		reversed: 'refunded',
	};

	const buildPaymentsQuery = (limit: number, cursor?: string) => {
		const apiBase = getApiBase();
		const types = Object.keys(typeFilter).filter((k) => (typeFilter as any)[k]);
		const statuses = Object.keys(statusFilter)
			.filter((k) => (statusFilter as any)[k])
			.map((k) => paymentStatusMap[k] || '')
			.filter(Boolean);
		const params = new URLSearchParams();
		params.set('limit', String(limit));
		if (types.length) params.set('type', types.join(','));
		if (statuses.length) params.set('status', statuses.join(','));
		if (cursor) params.set('cursor', cursor);
		return `${apiBase.replace(/\/$/, "")}/v1/payments?${params.toString()}`;
	};

	const fetchPayments = async (reset: boolean) => {
		try {
			if (reset) {
				setLoading(true);
				setPayments([]);
				setNextPaymentsCursor(null);
			}
			const jwt = (global as any).__APPWRITE_JWT__ || undefined;
			const url = buildPaymentsQuery(PAY_PAGE_SIZE);
			const res = await fetch(url, { headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) } });
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
			const list: Payment[] = Array.isArray(data?.data) ? data.data : [];
			setPayments(list);
			setNextPaymentsCursor(data?.nextCursor ?? null);
		} catch (e: any) {
			setError(e?.message || "Failed to load payments");
		} finally {
			if (reset) setLoading(false);
		}
	};

	React.useEffect(() => {
		fetchPayments(true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [typeFilter, statusFilter]);

	React.useEffect(() => {
		// initial load
		fetchPayments(true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const loadMorePayments = async () => {
		if (!nextPaymentsCursor || loadingMore) return;
		try {
			setLoadingMore(true);
			const jwt = (global as any).__APPWRITE_JWT__ || undefined;
			const url = buildPaymentsQuery(PAY_PAGE_SIZE, nextPaymentsCursor);
			const res = await fetch(url, { headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) } });
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
			const list: Payment[] = Array.isArray(data?.data) ? data.data : [];
			setPayments(prev => {
				const seen = new Set(prev.map(p => p.id));
				const merged = [...prev];
				for (const item of list) if (!seen.has(item.id)) merged.push(item);
				return merged;
			});
			setNextPaymentsCursor(data?.nextCursor ?? null);
		} catch (e: any) {
			setError(e?.message || "Failed to load more payments");
		} finally {
			setLoadingMore(false);
		}
	};
	const { colors } = useTheme();
	const [showDateFilter, setShowDateFilter] = useState(false);
	const [dateFilter, setDateFilter] = useState("all");
	const [filters, setFilters] = useState({ income: true, expense: true, account: true, card: true });
	const [typeFilter, setTypeFilter] = useState({ deposit: true, transfer: true, withdraw: true, payment: true });
	const [statusFilter, setStatusFilter] = useState({ completed: true, pending: true, failed: true, reversed: true, info: true });

	React.useEffect(() => {
		(async () => {
			try {
				const raw = await AsyncStorage.getItem('activityFilters');
				if (raw) {
					const parsed = JSON.parse(raw);
					setFilters((prev) => ({ ...prev, ...parsed }));
				}
			} catch {}
		})();
	}, []);

	React.useEffect(() => {
		AsyncStorage.setItem('activityFilters', JSON.stringify(filters)).catch(() => {});
	}, [filters]);

	React.useEffect(() => {
		(async () => {
			try {
				const t = await AsyncStorage.getItem('txTypeFilter');
				if (t) setTypeFilter(prev => ({ ...prev, ...JSON.parse(t) }));
				const s = await AsyncStorage.getItem('txStatusFilter');
				if (s) setStatusFilter(prev => ({ ...prev, ...JSON.parse(s) }));
			} catch {}
		})();
	}, []);
	React.useEffect(() => {
		AsyncStorage.setItem('txTypeFilter', JSON.stringify(typeFilter)).catch(() => {});
	}, [typeFilter]);
	React.useEffect(() => {
		AsyncStorage.setItem('txStatusFilter', JSON.stringify(statusFilter)).catch(() => {});
	}, [statusFilter]);

	const toggleFilter = (key: keyof typeof filters) => {
		setFilters(prev => {
			const next = { ...prev, [key]: !prev[key] };
			// Enforce at least one on
			if (!next.income && !next.expense && !next.account && !next.card) {
				return prev; // ignore toggle that would turn all off
			}
			return next;
		});
	};

	const toggleType = (key: keyof typeof typeFilter) => {
		setTypeFilter(prev => {
			const next = { ...prev, [key]: !prev[key] };
			if (!next.deposit && !next.transfer && !next.withdraw && !next.payment) {
				return prev;
			}
			return next;
		});
	};

	const toggleStatus = (key: keyof typeof statusFilter) => {
		setStatusFilter(prev => {
			const next = { ...prev, [key]: !prev[key] };
			// Enforce at least one status filter is on
			if (!next.completed && !next.pending && !next.failed && !next.reversed && !next.info) {
				return prev;
			}
			return next;
		});
	};

	const setAllOn = () => setFilters({ income: true, expense: true, account: true, card: true });

	const handleClearActivity = async () => {
		setIsClearingActivity(true);
		try {
			await clearAllActivity();
			// Also suppress any locally loaded logs (payments/transactions) for this session
			setPayments([]);
			setSuppressAllLogs(true);
			setShowClearActivity(false);
		} catch (error) {
			const { logger } = require('@/lib/logger');
			logger.error('ACTIVITY', 'Failed to clear activity:', error);
		} finally {
			setIsClearingActivity(false);
		}
	};

	const handleCancelClearActivity = () => {
		setShowClearActivity(false);
	};

	const getFilteredTransactions = () => {
		if (!Array.isArray(transactions)) return [];

		let filtered = [...transactions];

		// Apply date filter first
		const now = new Date();
		switch (dateFilter) {
			case "today":
				filtered = filtered.filter((t) => {
					const transactionDate = new Date(t.date);
					return transactionDate.toDateString() === now.toDateString();
				});
				break;
			case "week":
				const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
				filtered = filtered.filter((t) => new Date(t.date) >= weekAgo);
				break;
			case "month":
				const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
				filtered = filtered.filter((t) => new Date(t.date) >= startOfMonth);
				break;
			case "year":
				const startOfYear = new Date(now.getFullYear(), 0, 1);
				filtered = filtered.filter((t) => new Date(t.date) >= startOfYear);
				break;
		}

		// Apply income/expense filter
		filtered = filtered.filter((transaction) => {
			if (transaction.amount > 0) return filters.income;
			if (transaction.amount < 0) return filters.expense;
			return true;
		});

		// Apply type filter
		filtered = filtered.filter((t) => (typeFilter as any)[t.type]);

		// Apply status filter
		filtered = filtered.filter((t) => (statusFilter as any)[t.status]);

		return filtered;
	};

	const activityCards = useMemo(() => {
		const events: ActivityEvent[] = activity.filter((evt) => {
			// Apply category filters
			if (evt.category === 'transaction') {
				const amt = typeof evt.amount === 'number' ? evt.amount : 0;
				if (amt > 0 && !filters.income) return false;
				if (amt < 0 && !filters.expense) return false;
				// If no amount, include if either income or expense is on
				if (amt === 0 && !filters.income && !filters.expense) return false;
			}
			if (evt.category === 'account' && !filters.account) return false;
			if (evt.category === 'card' && !filters.card) return false;

			// Apply status filters
			if (evt.status) {
				const eventStatus = evt.status;
				if (!(statusFilter as any)[eventStatus]) return false;
			}

			return true;
		});

		// Date filter for activity timeline
		const now2 = new Date();
		const inRange = (ts: string) => {
			const d = new Date(ts);
			switch (dateFilter) {
				case "today":
					return d.toDateString() === now2.toDateString();
				case "week":
					return d >= new Date(now2.getTime() - 7 * 24 * 60 * 60 * 1000);
				case "month":
					return d >= new Date(now2.getFullYear(), now2.getMonth(), 1);
				case "year":
					return d >= new Date(now2.getFullYear(), 0, 1);
				default:
					return true;
			}
		};

		return events.filter((e) => inRange(e.timestamp));
	}, [activity, filters, dateFilter, statusFilter]);

	const [selected, setSelected] = useState<ActivityEvent | null>(null);
	const [showDetail, setShowDetail] = useState(false);

	const filteredTransactions = getFilteredTransactions();

	// Create unified, deduplicated activity list
	const allActivities = useMemo(() => {
		if (suppressAllLogs) return [] as any[];
		const items: Array<{
			id: string;
			type: 'activity' | 'transaction' | 'payment';
			timestamp: string;
			data: any;
		}> = [];

		// Add activity cards
		activityCards.forEach(evt => {
			items.push({
				id: `activity_${evt.id}`,
				type: 'activity',
				timestamp: evt.timestamp,
				data: evt
			});
		});

		// Add filtered transactions (only if not already represented in activity)
		filteredTransactions.forEach(tx => {
			// Check if this transaction is already represented in activity
			const hasActivity = activityCards.some(evt => 
				evt.transactionId === tx.id || 
				(evt.category === 'transaction' && evt.title.includes(tx.description))
			);
			if (!hasActivity) {
				items.push({
					id: `transaction_${tx.id}`,
					type: 'transaction',
					timestamp: tx.date,
					data: tx
				});
			}
		});

		// Add payments (only if not already represented in activity or transactions)
		payments.forEach(payment => {
			const hasActivity = activityCards.some(evt => 
				evt.transactionId === payment.id ||
				(evt.type && evt.type.includes('payment') && evt.title.includes(payment.id.slice(-6)))
			);
			const hasTransaction = filteredTransactions.some(tx => tx.id === payment.id);
			
			if (!hasActivity && !hasTransaction) {
				items.push({
					id: `payment_${payment.id}`,
					type: 'payment',
					timestamp: payment.created || new Date().toISOString(),
					data: payment
				});
			}
		});

		// Sort by timestamp (most recent first) and remove duplicates by id
		const uniqueItems = items.filter((item, index, self) => 
			self.findIndex(i => i.id === item.id) === index
		);

		return uniqueItems.sort((a, b) => 
			new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
		);
	}, [activityCards, filteredTransactions, payments]);

	return (
		<SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
			<KeyboardAvoidingView
				style={styles.keyboardContainer}
				behavior={Platform.OS === "ios" ? "padding" : "height"}
			>
				<View style={styles.header}>
					<Text style={[styles.title, { color: colors.textPrimary }]}>Activity</Text>
					<View style={{ flexDirection: 'row', alignItems: 'center' }}>
						<TouchableOpacity
							style={[styles.filterButton, { backgroundColor: colors.card }]}
							onPress={() => setShowDateFilter(true)}
						>
							<Filter color={colors.textSecondary} size={24} />
						</TouchableOpacity>
					</View>
				</View>

				<View style={{ marginBottom: 10 }}>
					<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs} contentContainerStyle={styles.filterScrollContent}>
					{(() => {
						const v = getBadgeVisuals(colors, { tone: 'neutral', size: 'md' });
						return (
							<View style={{ marginRight: 5 }}>
								<CustomButton
									title="All"
									size="sm"
									isFilterAction
									variant={v.textColor === '#fff' ? 'primary' : 'secondary'}
									onPress={setAllOn}
									style={{ backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: 1 }}
									textStyle={{ color: v.textColor }}
								/>
							</View>
						);
					})()}

					{(() => {
						const v = getBadgeVisuals(colors, { tone: 'success', selected: filters.income, size: 'md' });
						return (
							<View style={{ marginRight: 5 }}>
								<CustomButton
									size="sm"
									isFilterAction
									variant={v.textColor === '#fff' ? 'primary' : 'secondary'}
									onPress={() => toggleFilter('income')}
									title="Income"
									leftIcon={<ArrowDownLeft size={14} color={v.textColor as string} />}
									style={{ backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: 1 }}
									textStyle={{ color: v.textColor }}
								/>
							</View>
						);
					})()}

					{(() => {
						const v = getBadgeVisuals(colors, { tone: 'danger', selected: filters.expense, size: 'md' });
						return (
							<View style={{ marginRight: 5 }}>
								<CustomButton
									size="sm"
									isFilterAction
									variant={v.textColor === '#fff' ? 'primary' : 'secondary'}
									onPress={() => toggleFilter('expense')}
									title="Expense"
									leftIcon={<ArrowUpRight size={14} color={v.textColor as string} />}
									style={{ backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: 1 }}
									textStyle={{ color: v.textColor }}
								/>
							</View>
						);
					})()}

					{(() => {
						const v = getBadgeVisuals(colors, { tone: 'accent', selected: filters.account, size: 'md' });
						return (
							<View style={{ marginRight: 5 }}>
								<CustomButton
									size="sm"
									isFilterAction
									variant={v.textColor === '#fff' ? 'primary' : 'secondary'}
									onPress={() => toggleFilter('account')}
									title="Account"
									leftIcon={<User size={14} color={v.textColor as string} />}
									style={{ backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: 1 }}
									textStyle={{ color: v.textColor }}
								/>
							</View>
						);
					})()}

					{(() => {
						const v = getBadgeVisuals(colors, { tone: 'accent', selected: filters.card, size: 'md' });
						return (
							<View style={{ marginRight: 5 }}>
								<CustomButton
									size="sm"
									isFilterAction
									variant={v.textColor === '#fff' ? 'primary' : 'secondary'}
									onPress={() => toggleFilter('card')}
									title="Cards"
									leftIcon={<CardIcon size={14} color={v.textColor as string} />}
									style={{ backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: 1 }}
									textStyle={{ color: v.textColor }}
								/>
							</View>
						);
					})()}
				</ScrollView>
				</View>
				

				<View>
				{/* Activity Status Filters */}
				<View style={{ marginBottom: 10 }}>
					<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs} contentContainerStyle={styles.filterScrollContent}>
						{(['completed','pending','failed','reversed','info'] as const).map(key => {
							const tone = key === 'completed' ? 'success' : 
										key === 'failed' ? 'danger' : 
										key === 'reversed' ? 'warning' :
										key === 'info' ? 'accent' : 'warning';
							const isSelected = (statusFilter as any)[key] !== false;
							const v = getBadgeVisuals(colors, { tone: tone as any, selected: isSelected, size: 'sm' });
							const title = key === 'reversed' ? 'Refunded' : key[0].toUpperCase() + key.slice(1);
							return (
								<View key={key} style={{ marginRight: 5 }}>
									<CustomButton 
										size="sm" 
										isFilterAction 
										variant={v.textColor === '#fff' ? 'primary' : 'secondary'}
										onPress={() => toggleStatus(key)}
										title={title}
										style={{ 
											backgroundColor: v.backgroundColor, 
											borderColor: v.borderColor, 
											borderWidth: 1 
										}}
										textStyle={{ color: v.textColor }}
									/>
								</View>
							);
						})}
						
						{/* Clear All Status Filters Button */}
						<View style={{ marginRight: 5 }}>
							<CustomButton 
								size="sm" 
								isFilterAction 
								variant="secondary"
								onPress={() => setStatusFilter({ completed: true, pending: true, failed: true, reversed: true, info: true })}
								title="All Status"
								style={{ 
									backgroundColor: colors.card, 
									borderColor: colors.border, 
									borderWidth: 1 
								}}
								textStyle={{ color: colors.textSecondary }}
							/>
						</View>
					</ScrollView>
				</View>
				</View>

				<View style={[styles.transactionsContainer, { backgroundColor: colors.background }]}>
					{/* Sticky Header with Clear All Button */}
					<View style={[styles.stickyActivityHeader, { backgroundColor: colors.background }]}>
						{/* Horizontal separator bar */}
						<View style={[styles.horizontalBar, { backgroundColor: colors.border }]} />
						
					{/* Clear All Button */}
					{allActivities.length > 0 && (
						<View style={styles.clearAllContainer}>
								<TouchableOpacity onPress={() => setShowClearActivity(true)}>
									<Text style={[styles.clearAllText, { color: colors.negative }]}>Clear All</Text>
								</TouchableOpacity>
							</View>
						)}
					</View>

					<ScrollView
						style={styles.transactionsList}
						contentContainerStyle={[styles.scrollContent, { paddingTop: 52 }]}
						showsVerticalScrollIndicator={true}
						scrollEventThrottle={16}
						alwaysBounceVertical={true}
						nestedScrollEnabled={true}
						indicatorStyle="default"
					>
						{/* Empty state when there are no activities */}
						{!loading && !error && allActivities.length === 0 && (
							<View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
								<Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>No activities yet</Text>
								<Text style={{ marginTop: 8, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 }}>
									Once you add cards, make payments, or perform transfers, your activity will appear here.
								</Text>
							</View>
						)}

						{/* Loading and Error states */}
						{loading && (
							<Text style={{ padding: 16, color: colors.textSecondary }}>Loading activities…</Text>
						)}
						{error && (
							<Text style={{ padding: 16, color: colors.negative }}>{error}</Text>
						)}

						{/* Unified activity list - deduplicated and sorted */}
						{allActivities.map((item) => {
							if (item.type === 'activity') {
								return (
									<ActivityLogItem 
										key={item.id} 
										event={item.data} 
										themeColors={colors} 
										onPress={(e) => { setSelected(e); setShowDetail(true); }} 
									/>
								);
							} else if (item.type === 'transaction') {
								return (
									<TransactionItem key={item.id} transaction={item.data} />
								);
							} else if (item.type === 'payment') {
								return (
									<View key={item.id} style={[styles.paymentCard, { 
										backgroundColor: colors.card,
										shadowColor: colors.textPrimary,
									}]}>
										<View style={[styles.paymentIconContainer, { backgroundColor: colors.background }]}>
											<CreditCard color={colors.tintPrimary} size={20} />
										</View>
										<View style={styles.paymentDetails}>
											<Text style={[styles.paymentTitle, { color: colors.textPrimary }]}>Payment {item.data.id.slice(-6)}</Text>
											<Text style={[styles.paymentSubtitle, { color: colors.textSecondary }]}>{item.data.status.toUpperCase()} • {item.data.amount ?? '-'} {item.data.currency ?? ''}</Text>
											<Text style={[styles.paymentDate, { color: colors.textSecondary }]}>{item.data.created ? new Date(item.data.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</Text>
										</View>
										<View style={styles.paymentActions}>
											{item.data.status === 'authorized' && (
												<TouchableOpacity onPress={() => handleCapture(item.data.id)} style={[styles.actionButton, { backgroundColor: colors.tintPrimary }]}>
													<Text style={styles.actionButtonText}>Capture</Text>
												</TouchableOpacity>
											)}
											{(item.data.status === 'authorized' || item.data.status === 'captured') && (
												<TouchableOpacity onPress={() => handleRefund(item.data.id)} style={[styles.actionButton, { backgroundColor: colors.negative, marginTop: 4 }]}>
													<Text style={styles.actionButtonText}>Refund</Text>
												</TouchableOpacity>
											)}
										</View>
									</View>
								);
							}
							return null;
						})}

						{/* Load more button */}
						{nextPaymentsCursor && (
							<View style={{ padding: 16, alignItems: 'center' }}>
								<TouchableOpacity disabled={loadingMore} onPress={loadMorePayments} style={{ backgroundColor: colors.tintPrimary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, opacity: loadingMore ? 0.8 : 1 }}>
									<Text style={{ color: '#fff', fontWeight: '700' }}>{loadingMore ? 'Loading…' : 'Load more payments'}</Text>
								</TouchableOpacity>
							</View>
						)}
					</ScrollView>
				</View>

				<DateFilterModal
					visible={showDateFilter}
					onClose={() => setShowDateFilter(false)}
					selectedFilter={dateFilter}
					onFilterSelect={setDateFilter}
				/>

				<ActivityDetailModal visible={showDetail} event={selected} onClose={() => setShowDetail(false)} />

				<ClearDataModal
					visible={showClearActivity}
					onClose={handleCancelClearActivity}
					onConfirm={handleClearActivity}
					dataType="activity"
					count={activity.length}
					isLoading={isClearingActivity}
				/>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	keyboardContainer: {
		flex: 1,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 20,
		paddingTop: 20,
		paddingBottom: 12,
	},
	title: {
		fontSize: 28,
		fontWeight: "bold",
	},
	clearAllText: {
		fontSize: 14,
		fontWeight: "500",
	},
	filterButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		justifyContent: "center",
		alignItems: "center",
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	filterTabs: {
		flexDirection: "row",
		paddingHorizontal: 8,
		paddingVertical: 0,
		marginBottom: 0,
	},
	filterScrollContent: {
		paddingRight: 8,
	},
	filterTab: {
		paddingHorizontal: 20,
		paddingVertical: 8,
		borderRadius: 20,
		marginRight: 10,
	},
	filterTabActive: {},
	filterTabText: {
		fontSize: 14,
		fontWeight: "500",
	},
	filterTabTextActive: {},
	categoryChips: {
		flexDirection: "row",
		paddingHorizontal: 16,
		paddingVertical: 8,
		marginBottom: 8,
		gap: 0,
	},
	categoryChip: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 14,
		marginRight: 8,
		borderWidth: 1,
	},
	categoryChipActive: {},
	categoryChipText: {
		fontSize: 12,
		fontWeight: "600",
	},
	categoryChipTextActive: {},
	transactionsContainer: {
		flex: 1,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		marginTop: 0,
		position: 'relative',
	},
	stickyActivityHeader: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		zIndex: 10,
		// Subtle shadow for gentle visual separation
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: 1.5,
		},
		shadowOpacity: 0.06,
		shadowRadius: 3,
		elevation: 2,
		// Add subtle border at the bottom
		borderBottomWidth: Platform.OS === 'ios' ? 0.5 : 1,
		borderBottomColor: 'rgba(0, 0, 0, 0.04)',
	},
	clearAllContainer: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		paddingHorizontal: 20,
		marginTop: 12,
		marginBottom: 8,
	},
	clearAllText: {
		fontSize: 14,
		fontWeight: '600',
	},
	transactionsList: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
		paddingBottom: 20,
	},
	activityItem: {
		paddingHorizontal: 20,
		paddingVertical: 12,
		borderBottomWidth: 1,
	},
	activityTitle: {
		fontSize: 14,
		fontWeight: "700",
	},
	activitySubtitle: {
		fontSize: 12,
		marginTop: 2,
	},
	activityMeta: {
		fontSize: 11,
		marginTop: 4,
	},
	horizontalBar: {
		height: 2,
		marginHorizontal: 20,
		marginVertical: 8,
		opacity: 0.3,
		zIndex: 1,
	},
	paymentCard: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 16,
		paddingHorizontal: 16,
		marginHorizontal: 16,
		marginVertical: 6,
		borderRadius: 12,
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	paymentIconContainer: {
		width: 44,
		height: 44,
		borderRadius: 22,
		justifyContent: 'center',
		alignItems: 'center',
		marginRight: 12,
	},
	paymentDetails: {
		flex: 1,
	},
	paymentTitle: {
		fontSize: 16,
		fontWeight: '600',
		marginBottom: 4,
	},
	paymentSubtitle: {
		fontSize: 14,
		marginBottom: 4,
	},
	paymentDate: {
		fontSize: 12,
	},
	paymentActions: {
		alignItems: 'flex-end',
	},
	actionButton: {
		paddingVertical: 6,
		paddingHorizontal: 12,
		borderRadius: 6,
		minWidth: 70,
		alignItems: 'center',
	},
	actionButtonText: {
		color: '#fff',
		fontSize: 12,
		fontWeight: '600',
	},
});
