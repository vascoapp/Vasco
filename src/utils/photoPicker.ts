import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

export interface PhotoResult {
  uri: string;
  width: number;
  height: number;
}

async function requestPermission(type: 'camera' | 'library'): Promise<boolean> {
  if (type === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera toegang', 'Geef Vasco toegang tot je camera in Instellingen.');
      return false;
    }
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Galerij toegang', 'Geef Vasco toegang tot je foto\'s in Instellingen.');
      return false;
    }
  }
  return true;
}

export async function takePhoto(): Promise<PhotoResult | null> {
  const ok = await requestPermission('camera');
  if (!ok) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

export async function pickFromGallery(): Promise<PhotoResult | null> {
  const ok = await requestPermission('library');
  if (!ok) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

export function showPhotoPicker(onPhoto: (photo: PhotoResult) => void) {
  Alert.alert('Foto toevoegen', 'Kies een bron', [
    {
      text: 'Camera',
      onPress: async () => {
        const photo = await takePhoto();
        if (photo) onPhoto(photo);
      },
    },
    {
      text: 'Galerij',
      onPress: async () => {
        const photo = await pickFromGallery();
        if (photo) onPhoto(photo);
      },
    },
    { text: 'Annuleren', style: 'cancel' },
  ]);
}
