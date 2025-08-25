import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/**
 * Interface for image processing options
 */
export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSize?: number; // Max file size in bytes
}

/**
 * Default options for profile picture processing
 */
const DEFAULT_OPTIONS: ImageProcessingOptions = {
  maxWidth: 300,
  maxHeight: 300,
  quality: 0.8,
  maxSize: 500 * 1024, // 500KB
};

/**
 * Validates image format and size
 * @param imageInfo - Image picker result
 * @returns true if valid, false otherwise
 */
export const validateImage = (imageInfo: ImagePicker.ImagePickerAsset): boolean => {
  // Check if it's a valid image type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (imageInfo.type && !validTypes.includes(imageInfo.type)) {
    throw new Error('Please select a JPEG or PNG image');
  }

  // Check file size (if available)
  if (imageInfo.fileSize && imageInfo.fileSize > 10 * 1024 * 1024) { // 10MB
    throw new Error('Image file size must be less than 10MB');
  }

  return true;
};

/**
 * Processes an image for profile picture use
 * Resizes, compresses, and formats the image
 * @param imageUri - URI of the image to process
 * @param options - Processing options
 * @returns Processed image URI
 */
export const processProfileImage = async (
  imageUri: string,
  options: ImageProcessingOptions = {}
): Promise<string> => {
  const config = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Get image info first
    const imageInfo = await ImageManipulator.manipulateAsync(
      imageUri,
      [],
      { format: ImageManipulator.SaveFormat.JPEG }
    );

    // Calculate resize dimensions while maintaining aspect ratio
    const { width: originalWidth, height: originalHeight } = imageInfo;
    let { maxWidth, maxHeight } = config;
    maxWidth = maxWidth || 300;
    maxHeight = maxHeight || 300;

    const aspectRatio = originalWidth / originalHeight;
    let newWidth = maxWidth;
    let newHeight = maxHeight;

    if (aspectRatio > 1) {
      // Landscape
      newHeight = maxWidth / aspectRatio;
    } else {
      // Portrait or square
      newWidth = maxHeight * aspectRatio;
    }

    // Ensure we don't exceed max dimensions
    if (newWidth > maxWidth) {
      newWidth = maxWidth;
      newHeight = maxWidth / aspectRatio;
    }
    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      newWidth = maxHeight * aspectRatio;
    }

    // Process the image
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        {
          resize: {
            width: Math.round(newWidth),
            height: Math.round(newHeight),
          },
        },
      ],
      {
        compress: config.quality || 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return result.uri;
  } catch (error) {
    console.error('Image processing error:', error);
    throw new Error('Failed to process image. Please try again.');
  }
};

/**
 * Requests camera and media library permissions
 * @returns Permission status
 */
export const requestImagePermissions = async (): Promise<{
  camera: boolean;
  mediaLibrary: boolean;
}> => {
  try {
    // Request camera permission
    const cameraResult = await ImagePicker.requestCameraPermissionsAsync();
    
    // Request media library permission
    const mediaResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    return {
      camera: cameraResult.status === 'granted',
      mediaLibrary: mediaResult.status === 'granted',
    };
  } catch (error) {
    console.error('Permission request error:', error);
    return {
      camera: false,
      mediaLibrary: false,
    };
  }
};

/**
 * Launches image picker with camera option
 * @returns Selected image or null
 */
export const pickImageFromCamera = async (): Promise<ImagePicker.ImagePickerAsset | null> => {
  try {
    const permissions = await requestImagePermissions();
    
    if (!permissions.camera) {
      throw new Error('Camera permission is required to take photos');
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      validateImage(asset);
      return asset;
    }

    return null;
  } catch (error) {
    console.error('Camera picker error:', error);
    throw error;
  }
};

/**
 * Launches image picker with gallery option
 * @returns Selected image or null
 */
export const pickImageFromGallery = async (): Promise<ImagePicker.ImagePickerAsset | null> => {
  try {
    const permissions = await requestImagePermissions();
    
    if (!permissions.mediaLibrary) {
      throw new Error('Photo library permission is required to select images');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      validateImage(asset);
      return asset;
    }

    return null;
  } catch (error) {
    console.error('Gallery picker error:', error);
    throw error;
  }
};

/**
 * Generates initials from a name
 * @param name - Full name
 * @returns Initials (max 2 characters)
 */
export const getInitials = (name: string): string => {
  if (!name) return '?';
  
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
};
