import { useTheme } from '@/context/ThemeContext';
import { getInitials } from '@/lib/imageUtils';
// TODO: Replace with Appwrite storage helpers when available
// import { getImage } from '@/lib/appwrite/storage';
import { Camera, Edit3, User as UserIcon } from 'lucide-react-native';
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';

export type ProfilePictureSize = 'small' | 'medium' | 'large' | 'xlarge';

interface ProfilePictureProps {
  /** User's name for generating initials */
  name?: string;
  /** URL of the profile picture */
  imageUrl?: string;
  /** Size variant */
  size?: ProfilePictureSize;
  /** Whether to show the edit overlay */
  editable?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Error state */
  hasError?: boolean;
  /** Callback when the picture is tapped (for editing) */
  onPress?: () => void;
  /** Custom style */
  style?: ViewStyle;
}

const SIZE_CONFIG = {
  small: {
    container: 32,
    text: 12,
    icon: 16,
    editOverlay: 20,
    editIcon: 10,
  },
  medium: {
    container: 48,
    text: 16,
    icon: 20,
    editOverlay: 24,
    editIcon: 12,
  },
  large: {
    container: 80,
    text: 24,
    icon: 32,
    editOverlay: 32,
    editIcon: 16,
  },
  xlarge: {
    container: 120,
    text: 32,
    icon: 48,
    editOverlay: 36,
    editIcon: 18,
  },
};

export function ProfilePicture({
  name = '',
  imageUrl,
  size = 'medium',
  editable = false,
  loading: initialLoading = false,
  hasError: initialError = false,
  onPress,
  style,
}: ProfilePictureProps) {
  const { colors } = useTheme();
  const config = SIZE_CONFIG[size];
  const initials = getInitials(name);
  
  const [localImageUrl, setLocalImageUrl] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(initialLoading);
  const [hasError, setHasError] = React.useState(initialError);

  React.useEffect(() => {
    if (imageUrl?.startsWith('rtdb://')) {
      // TODO: Implement Appwrite storage image loading
      setHasError(true);
      setIsLoading(false);
    } else {
      setLocalImageUrl(imageUrl || null);
    }
  }, [imageUrl]);

  const containerStyle = [
    styles.container,
    {
      width: config.container,
      height: config.container,
      borderRadius: config.container / 2,
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    style,
  ];

  const renderContent = () => {
    if (isLoading) {
      return (
        <ActivityIndicator 
          size="small" 
          color={colors.tintPrimary} 
        />
      );
    }

    if (hasError || (!imageUrl && !name)) {
      return (
        <UserIcon 
          color={colors.textSecondary} 
          size={config.icon} 
        />
      );
    }

    if (localImageUrl) {
      return (
        <Image
          source={{ uri: localImageUrl }}
          style={[
            styles.image,
            {
              width: config.container,
              height: config.container,
              borderRadius: config.container / 2,
            },
          ]}
          cachePolicy="memory-disk"
          transition={200}
          contentFit="cover"
        />
      );
    }

    // Show initials fallback
    return (
      <View
        style={[
          styles.initialsContainer,
          {
            backgroundColor: colors.tintPrimary + '20',
          },
        ]}
      >
        <Text
          style={[
            styles.initialsText,
            {
              fontSize: config.text,
              color: colors.tintPrimary,
            },
          ]}
        >
          {initials}
        </Text>
      </View>
    );
  };

  const renderEditOverlay = () => {
    if (!editable || isLoading) return null;

    return (
      <View
        style={[
          styles.editOverlay,
          {
            width: config.editOverlay,
            height: config.editOverlay,
            borderRadius: config.editOverlay / 2,
            backgroundColor: colors.tintPrimary,
            borderColor: colors.background,
          },
        ]}
      >
        {localImageUrl ? (
          <Edit3 
            color="white" 
            size={config.editIcon} 
          />
        ) : (
          <Camera 
            color="white" 
            size={config.editIcon} 
          />
        )}
      </View>
    );
  };

  if (editable && onPress) {
    return (
      <TouchableOpacity
        style={containerStyle}
        onPress={onPress}
        activeOpacity={0.8}
        disabled={isLoading}
      >
        {renderContent()}
        {renderEditOverlay()}
      </TouchableOpacity>
    );
  }

  return (
    <View style={containerStyle}>
      {renderContent()}
      {renderEditOverlay()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  image: {
    // Image styles are set dynamically
  },
  initialsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    borderRadius: 1000, // Large value to ensure circular shape
  },
  initialsText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  editOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
});
