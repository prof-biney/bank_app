# Local Storage Cleanup Guide

This document outlines all local storage keys used in the banking app and the cleanup requirements when performing delete operations.

## Overview

When implementing delete functionality in the app, it's critical to clean up any locally cached or stored data to maintain data consistency and prevent stale data issues.

## Local Storage Keys by Feature

### 1. Activity System
- **Key**: `comprehensive_activity_log`
  - **Location**: `lib/activityLogger.ts`
  - **Purpose**: Stores centralized activity logs
  - **Cleanup Required**: When deleting activities, transactions, cards, or clearing all activity

- **Key**: `activity_manually_cleared`
  - **Location**: `app/(tabs)/activity.tsx`, `context/AppContext.tsx`
  - **Purpose**: Flags when user has manually cleared activities
  - **Cleanup Required**: When restoring activities or resetting app state

- **Key**: `activityFilters`
  - **Location**: `app/(tabs)/activity.tsx`
  - **Purpose**: Stores user's activity filter preferences
  - **Cleanup Required**: Optional - only if resetting all user preferences

- **Key**: `txTypeFilter`
  - **Location**: `app/(tabs)/activity.tsx`
  - **Purpose**: Stores transaction type filter preferences
  - **Cleanup Required**: Optional - only if resetting all user preferences

- **Key**: `txStatusFilter`
  - **Location**: `app/(tabs)/activity.tsx`
  - **Purpose**: Stores transaction status filter preferences
  - **Cleanup Required**: Optional - only if resetting all user preferences

### 2. Notification System
- **Key**: `notification_pages_cache`
  - **Location**: `lib/notificationLoader.ts`
  - **Purpose**: Caches paginated notification data
  - **Cleanup Required**: When deleting notifications or clearing notification data

### 3. Authentication & Security
- **Key**: Multiple keys in `lib/biometric/`, `lib/loginAttempts.ts`
  - **Purpose**: Authentication states, biometric data, login attempts
  - **Cleanup Required**: When logging out or resetting security settings

### 4. Theme & Preferences
- **Key**: Theme-related keys in `context/ThemeContext.tsx`
  - **Purpose**: User theme preferences
  - **Cleanup Required**: When resetting user preferences

### 5. Transaction Cache
- **Key**: Transaction-related keys in `context/AppContext.tsx`
  - **Purpose**: Cached transaction data
  - **Cleanup Required**: When deleting transactions

## Implementation Guidelines

### For Individual Item Deletion

When deleting individual items (activities, notifications, transactions), follow these steps:

1. **Remove from Database**: Delete the item from the remote database
2. **Remove from Memory**: Update local state arrays to remove the item
3. **Update Local Storage**: If the item is cached locally, update the cache
4. **Clean Related Data**: Remove any related cached data or references

### For Bulk/Clear All Operations

When clearing all items in a category:

1. **Clear Database**: Remove all items from the remote database
2. **Clear Memory**: Reset local state arrays to empty
3. **Remove Storage Keys**: Use `AsyncStorage.removeItem()` for relevant keys
4. **Reset Filters**: Optionally reset user filters to defaults
5. **Update UI State**: Ensure UI reflects the cleared state

## Code Examples

### Individual Activity Deletion
```typescript
// 1. Delete from activityLogger
await activityLogger.deleteActivity(activityId);

// 2. Remove from local state (if applicable)
setActivities(prev => prev.filter(item => item.id !== activityId));

// 3. Related cache cleanup is handled automatically by activityLogger
```

### Clear All Activities
```typescript
// 1. Clear from activityLogger
await activityLogger.clearActivities();

// 2. Clear local states
setActivities([]);
setCentralizedActivities([]);

// 3. Set suppression flag
await AsyncStorage.setItem('activity_manually_cleared', 'true');

// 4. Optional: Reset filters
await AsyncStorage.removeItem('activityFilters');
await AsyncStorage.removeItem('txTypeFilter');
await AsyncStorage.removeItem('txStatusFilter');
```

### Individual Notification Deletion
```typescript
// 1. Delete from database
await deleteNotificationFromDatabase(notificationId);

// 2. Update local state
setNotifications(prev => prev.filter(n => n.id !== notificationId));

// 3. Update notification cache
const cache = await AsyncStorage.getItem('notification_pages_cache');
if (cache) {
  const parsedCache = JSON.parse(cache);
  // Remove notification from all cached pages
  Object.keys(parsedCache.pages).forEach(pageKey => {
    parsedCache.pages[pageKey].notifications = 
      parsedCache.pages[pageKey].notifications.filter(n => n.id !== notificationId);
  });
  await AsyncStorage.setItem('notification_pages_cache', JSON.stringify(parsedCache));
}
```

### Clear All Notifications
```typescript
// 1. Clear from database
await clearAllNotificationsFromDatabase();

// 2. Clear local state
setNotifications([]);

// 3. Clear notification cache
await AsyncStorage.removeItem('notification_pages_cache');
```

## Key Considerations

1. **Order Matters**: Always update the database first, then local storage, then UI state
2. **Error Handling**: If database operations fail, don't update local storage
3. **Consistency**: Ensure all related data is cleaned up together
4. **Performance**: Batch AsyncStorage operations when possible
5. **User Experience**: Provide feedback during cleanup operations

## Testing Checklist

When implementing delete functionality, test:

- [ ] Item deleted from database
- [ ] Item removed from local state arrays
- [ ] Local storage caches updated correctly
- [ ] Related data cleaned up
- [ ] UI reflects changes immediately
- [ ] App restart doesn't show stale data
- [ ] Filters and preferences handled correctly
- [ ] Error states handled gracefully

## Current Implementation Status

### ✅ Implemented
- Activity deletion with proper cleanup
- Clear all activities with storage cleanup
- Individual notification deletion (TODO - needs cache cleanup)

### ❌ Needs Implementation
- Individual notification deletion with cache cleanup
- Clear all notifications functionality
- Bulk transaction deletion
- User data reset functionality

## Maintenance Notes

- Review this document when adding new local storage keys
- Update cleanup procedures when modifying storage patterns
- Ensure all delete operations follow the established patterns
- Add new cleanup requirements when implementing new features