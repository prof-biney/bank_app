import React from 'react';
import { View, StyleSheet, Image } from 'react-native';

interface MobileNetworkIconProps {
  network: 'mtn' | 'telecel' | 'airteltigo';
  size?: number;
}

export function MobileNetworkIcon({ network, size = 48 }: MobileNetworkIconProps) {
  const getNetworkImage = () => {
    switch (network) {
      case 'mtn':
        return require('@/assets/images/momo/mtn.png');
      case 'telecel':
        return require('@/assets/images/momo/tel.png');
      case 'airteltigo':
        return require('@/assets/images/momo/at.png');
      default:
        return require('@/assets/images/momo/mtn.png');
    }
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image 
        source={getNetworkImage()}
        style={[styles.image, { width: size, height: size }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    borderRadius: 8,
  },
});
