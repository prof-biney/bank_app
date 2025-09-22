import { logger } from '@/lib/logger';
import { useTheme } from '@/context/ThemeContext';
import {
  pickImageFromCamera,
  pickImageFromGallery,
  processProfileImage,
} from '@/lib/imageUtils';
import { Camera, Image as ImageIcon, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useAlert } from '@/context/AlertContext';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

interface ImagePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onImageSelected: (processedImageUri: string) => void;
}

export function ImagePickerModal({
  visible,
  onClose,
  onImageSelected,
}: ImagePickerModalProps) {
  const { colors } = useTheme();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { showAlert } = useAlert();

  const handleClose = () => {
    setSelectedImage(null);
    setIsProcessing(false);
    onClose();
  };

  const handleImagePicked = async (asset: ImagePicker.ImagePickerAsset | null) => {
    if (!asset) return;

    try {
      setIsProcessing(true);
      
      // Process the image (resize, compress)
      const processedUri = await processProfileImage(asset.uri);
      setSelectedImage(processedUri);
    } catch (error) {
      logger.error('UI', 'Image processing error:', error);
  showAlert('error', error instanceof Error ? error.message : 'Failed to process image', 'Error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCameraPress = async () => {
    try {
      const asset = await pickImageFromCamera();
      await handleImagePicked(asset);
    } catch (error) {
      logger.error('UI', 'Camera error:', error);
  showAlert('error', error instanceof Error ? error.message : 'Failed to take photo', 'Camera Error');
    }
  };

  const handleGalleryPress = async () => {
    try {
      const asset = await pickImageFromGallery();
      await handleImagePicked(asset);
    } catch (error) {
      logger.error('UI', 'Gallery error:', error);
  showAlert('error', error instanceof Error ? error.message : 'Failed to select image', 'Gallery Error');
    }
  };

  const handleConfirm = () => {
    if (selectedImage) {
      onImageSelected(selectedImage);
      handleClose();
    }
  };

  const renderImagePreview = () => {
    if (!selectedImage) return null;

    return (
      <View style={styles.previewContainer}>
        <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>
          Preview
        </Text>
        <Image
          source={{ uri: selectedImage }}
          style={[
            styles.previewImage,
            { borderColor: colors.border }
          ]}
          contentFit="cover"
        />
        <View style={styles.previewActions}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.cancelButton,
              { borderColor: colors.border }
            ]}
            onPress={() => setSelectedImage(null)}
          >
            <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
              Retake
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.confirmButton,
              { backgroundColor: colors.tintPrimary }
            ]}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmButtonText}>
              Use Photo
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderImageOptions = () => {
    if (selectedImage || isProcessing) return null;

    return (
      <View style={styles.optionsContainer}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Update Profile Picture
        </Text>
        
        <View style={styles.options}>
          <TouchableOpacity
            style={[
              styles.option,
              { backgroundColor: colors.card, borderColor: colors.border }
            ]}
            onPress={handleCameraPress}
          >
            <Camera color={colors.tintPrimary} size={32} />
            <Text style={[styles.optionText, { color: colors.textPrimary }]}>
              Take Photo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.option,
              { backgroundColor: colors.card, borderColor: colors.border }
            ]}
            onPress={handleGalleryPress}
          >
            <ImageIcon color={colors.tintPrimary} size={32} />
            <Text style={[styles.optionText, { color: colors.textPrimary }]}>
              Choose from Gallery
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderProcessing = () => {
    if (!isProcessing) return null;

    return (
      <View style={styles.processingContainer}>
        <ActivityIndicator
          size="large"
          color={colors.tintPrimary}
        />
        <Text style={[styles.processingText, { color: colors.textSecondary }]}>
          Processing image...
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.card }]}
            onPress={handleClose}
          >
            <X color={colors.textSecondary} size={24} />
          </TouchableOpacity>

          {renderProcessing()}
          {renderImageOptions()}
          {renderImagePreview()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  optionsContainer: {
    alignItems: 'center',
  },
  options: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    gap: 16,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  previewContainer: {
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  previewImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    marginBottom: 24,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    // backgroundColor set dynamically
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  processingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  processingText: {
    marginTop: 16,
    fontSize: 16,
  },
});
