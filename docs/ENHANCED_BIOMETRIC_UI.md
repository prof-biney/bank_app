# Enhanced Biometric UI Components

This document describes the enhanced biometric authentication UI components that provide a rich, animated user experience with comprehensive feedback and state management.

## Components Overview

### 1. BiometricLoadingIndicator
An animated overlay that shows during biometric operations with stage-specific animations and feedback.

**Features:**
- Stage-specific animations (checking, authenticating, processing, success, error)
- Animated waves during authentication
- Platform-specific guidance messages
- Progress indicators
- Smooth entrance/exit animations

**Usage:**
```tsx
<BiometricLoadingIndicator
  visible={isLoading}
  biometricType={biometricType}
  stage="authenticating" // 'checking' | 'authenticating' | 'processing' | 'success' | 'error'
  message="Authenticate with Face ID"
  progress={75} // Optional progress percentage
/>
```

### 2. BiometricToast & BiometricToastProvider
Global toast notification system with haptic feedback and contextual biometric messages.

**Features:**
- Haptic feedback for different message types
- Swipe to dismiss functionality
- Auto-dismiss with progress indicator
- Queue management for multiple toasts
- Pre-built biometric messages via `useBiometricMessages`

**Setup:**
```tsx
// In your root layout
<BiometricToastProvider>
  <YourApp />
</BiometricToastProvider>
```

**Usage:**
```tsx
const biometricMessages = useBiometricMessages();

// Pre-built messages
biometricMessages.authSuccess('faceId');
biometricMessages.authFailed('fingerprint', 'Please try again');
biometricMessages.setupSuccess('touchId');
biometricMessages.hardwareNotAvailable();

// Or custom toasts
const { showSuccess, showError } = useBiometricToast();
showSuccess('Success!', 'Operation completed successfully');
```

### 3. EnhancedBiometricButton
An improved biometric authentication button with enhanced animations and state management.

**Features:**
- Multiple size variants (small, medium, large)
- Style variants (primary, secondary, outline)
- State-driven animations (loading, authenticating, success, error)
- Shimmer effects during authentication
- Platform-specific icons
- Haptic feedback

**Usage:**
```tsx
<EnhancedBiometricButton
  biometricType={biometricType}
  onPress={handleAuthenticate}
  state="authenticating" // 'idle' | 'loading' | 'authenticating' | 'success' | 'error'
  size="large"
  variant="primary"
  showLabel
  customLabel="Sign in with Touch ID"
/>
```

### 4. useBiometricAuth Hook
A comprehensive hook that manages biometric authentication state and integrates with the UI components.

**Features:**
- Centralized state management
- Automatic timeout handling
- Toast integration
- Stage-driven UI updates
- Error handling and recovery

**Usage:**
```tsx
const { state, authenticate, setup, disable, checkAvailability, reset } = useBiometricAuth();

// Use state for UI components
<EnhancedBiometricButton
  biometricType={biometricType}
  onPress={authenticate}
  state={state.buttonState}
  size="large"
/>

<BiometricLoadingIndicator
  visible={state.isLoading}
  biometricType={biometricType}
  stage={state.stage}
  message={state.message}
/>
```

## Integration Examples

### Login Screen Integration
```tsx
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import EnhancedBiometricButton from '@/components/auth/EnhancedBiometricButton';
import BiometricLoadingIndicator from '@/components/auth/BiometricLoadingIndicator';

const LoginScreen = () => {
  const { biometricEnabled, biometricType } = useAuthStore();
  const { state, authenticate } = useBiometricAuth();

  return (
    <View>
      {biometricEnabled && (
        <EnhancedBiometricButton
          biometricType={biometricType}
          onPress={authenticate}
          state={state.buttonState}
          size="large"
          variant="primary"
          showLabel
        />
      )}
      
      <BiometricLoadingIndicator
        visible={state.isLoading}
        biometricType={biometricType}
        stage={state.stage}
        message={state.message}
      />
    </View>
  );
};
```

### Settings Screen Integration
```tsx
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { useBiometricMessages } from '@/context/BiometricToastContext';

const SettingsScreen = () => {
  const { biometricEnabled } = useAuthStore();
  const { setup, disable } = useBiometricAuth();
  const biometricMessages = useBiometricMessages();

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      const success = await setup();
      // Success/failure handled automatically via toasts
    } else {
      const success = await disable();
      // Success/failure handled automatically via toasts
    }
  };

  return (
    <Switch
      value={biometricEnabled}
      onValueChange={handleToggle}
    />
  );
};
```

## Configuration

### Toast Configuration
```tsx
<BiometricToastProvider
  maxToasts={3}
  defaultPosition="top" // 'top' | 'center' | 'bottom'
  defaultDuration={4000}
>
  <App />
</BiometricToastProvider>
```

### Button Variants
- **Primary**: Solid background with white text (default)
- **Secondary**: Card background with theme text
- **Outline**: Transparent background with colored border

### Animation Stages
- **Checking**: Gentle pulse while checking availability
- **Authenticating**: Faster pulse with wave effects
- **Processing**: Rotation animation for server operations
- **Success**: Bounce animation with success feedback
- **Error**: Shake animation with error indication

## Dependencies

- `expo-haptics`: For haptic feedback
- `expo-linear-gradient`: For gradient backgrounds
- Your existing biometric service and auth store

## Best Practices

1. **Always show loading indicators** during biometric operations
2. **Provide fallback options** when biometrics aren't available
3. **Use contextual messages** via the pre-built message helpers
4. **Handle errors gracefully** with appropriate user feedback
5. **Respect platform conventions** for biometric UI patterns
6. **Test on real devices** as simulators may not support biometrics

## Accessibility

All components include:
- Proper accessibility labels
- Screen reader support
- High contrast color options
- Touch target size compliance
- Keyboard navigation support (where applicable)

The enhanced biometric UI system provides a complete, production-ready solution for biometric authentication with excellent user experience and comprehensive error handling.