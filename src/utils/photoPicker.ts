import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

const MAX_DIMENSION = 1920;
const UPLOAD_QUALITY = 0.7;
const MAX_FILE_SIZE_MB = 15;

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

function validateAsset(asset: ImagePicker.ImagePickerAsset): PhotoResult | null {
  if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE_MB * 1024 * 1024) {
    Alert.alert('File too large', `Photo must be under ${MAX_FILE_SIZE_MB}MB. Please choose a smaller image.`);
    return null;
  }
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

export async function takePhoto(): Promise<PhotoResult | null> {
  const ok = await requestPermission('camera');
  if (!ok) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: UPLOAD_QUALITY,
    allowsEditing: true,
    exif: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return validateAsset(result.assets[0]);
}

export async function pickFromGallery(): Promise<PhotoResult | null> {
  const ok = await requestPermission('library');
  if (!ok) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: UPLOAD_QUALITY,
    allowsEditing: true,
    exif: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return validateAsset(result.assets[0]);
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
