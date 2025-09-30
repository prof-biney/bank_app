import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getPendingApprovals } from '@/lib/appwrite/transactionApprovalService';
import TransactionApproval from './TransactionApproval';
import { logger } from '@/lib/logger';

interface ApprovalBadgeProps {
  style?: any;
  iconSize?: number;
  badgeSize?: number;
}

const ApprovalBadge: React.FC<ApprovalBadgeProps> = ({
  style,
  iconSize = 24,
  badgeSize = 16,
}) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [showApprovals, setShowApprovals] = useState(false);

  useEffect(() => {
    loadPendingCount();
    // Refresh count every 30 seconds
    const interval = setInterval(loadPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadPendingCount = async () => {
    try {
      const approvals = await getPendingApprovals();
      setPendingCount(approvals.length);
    } catch (error) {
      logger.warn('APPROVAL_BADGE', 'Failed to load pending approvals count:', error);
    }
  };

  const handlePress = () => {
    setShowApprovals(true);
  };

  const handleApprovalComplete = () => {
    // Refresh count after approval/rejection
    loadPendingCount();
  };

  const handleClose = () => {
    setShowApprovals(false);
  };

  if (pendingCount === 0) {
    return null; // Don't show badge if no pending approvals
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.container, style]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <MaterialIcons 
          name="pending-actions" 
          size={iconSize} 
          color="#007AFF" 
        />
        <View style={[styles.badge, { 
          width: badgeSize, 
          height: badgeSize, 
          borderRadius: badgeSize / 2,
          minWidth: badgeSize
        }]}>
          <Text style={[styles.badgeText, { 
            fontSize: badgeSize * 0.7,
            lineHeight: badgeSize
          }]}>
            {pendingCount > 99 ? '99+' : pendingCount}
          </Text>
        </View>
      </TouchableOpacity>

      <TransactionApproval
        visible={showApprovals}
        onClose={handleClose}
        onApprovalComplete={handleApprovalComplete}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ApprovalBadge;