import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';
import appI18n from '../i18n/i18n';

const t = (key: string, opts?: Record<string, unknown>) => appI18n.t(key, opts) as string;

const MAX_DIMENSION = 1920;
const UPLOAD_QUALITY = 0.7;
const MAX_FILE_SIZE_MB = 15;

export interface PhotoResult {
  uri: string;
  width: number;
  height: number;
}

// Only the CAMERA needs a permission. The photo library opens the system
// picker (Android photo picker / iOS PHPicker), which hands back only what the
// contractor chose and needs no access to the gallery. Asking for it put
// READ_MEDIA_IMAGES in the manifest, and Google Play refuses that permission to
// an app whose core purpose is not the photo library (2026-10-15).
async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(t('photoPicker.cameraDeniedTitle'), t('photoPicker.cameraDeniedBody'));
    return false;
  }
  return true;
}

function validateAsset(asset: ImagePicker.ImagePickerAsset): PhotoResult | null {
  if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE_MB * 1024 * 1024) {
    Alert.alert(t('photoPicker.tooLargeTitle'), t('photoPicker.tooLargeBody', { mb: MAX_FILE_SIZE_MB }));
    return null;
  }
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

export async function takePhoto(): Promise<PhotoResult | null> {
  const ok = await requestCameraPermission();
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
  Alert.alert(t('photoPicker.title'), t('photoPicker.chooseSource'), [
    {
      text: t('photoPicker.camera'),
      onPress: async () => {
        const photo = await takePhoto();
        if (photo) onPhoto(photo);
      },
    },
    {
      text: t('photoPicker.gallery'),
      onPress: async () => {
        const photo = await pickFromGallery();
        if (photo) onPhoto(photo);
      },
    },
    { text: t('common.cancel'), style: 'cancel' },
  ]);
}
