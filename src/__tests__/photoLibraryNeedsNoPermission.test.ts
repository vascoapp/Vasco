/**
 * Google Play refused production: the bundle asked for READ_MEDIA_IMAGES (plus
 * the old storage permissions), which Play only grants to apps whose CORE
 * purpose is the photo library (2026-10-15). Vasco only lets the contractor
 * pick a photo, and the system picker (Android photo picker / iOS PHPicker)
 * needs no permission at all. So:
 *  - app.json requests none of them and BLOCKS them (prebuild honours
 *    blockedPermissions; android/ is regenerated and never the source);
 *  - no live code asks for gallery permission — once the manifest no longer
 *    declares it, that request is denied and the picker would never open;
 *  - the picker's copy is the contractor's language (it was Dutch for all).
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const MEDIA = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];

it('app.json requests no photo/storage permission and blocks every one', () => {
  const android = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo.android;
  for (const p of MEDIA) {
    expect(android.permissions).not.toContain(p);
    expect(android.blockedPermissions).toContain(p);
  }
  expect(android.permissions).toContain('android.permission.CAMERA');
});

it('no shipping code asks for photo-library permission', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p); continue; }
      if (!/\.(tsx?|jsx?)$/.test(e.name)) continue;
      const src = fs.readFileSync(p, 'utf8');
      if (/requestMediaLibraryPermissionsAsync|getMediaLibraryPermissionsAsync/.test(src)) offenders.push(path.relative(ROOT, p));
    }
  };
  walk(path.join(ROOT, 'app'));
  walk(path.join(ROOT, 'src'));
  expect(offenders).toEqual([]);
});

describe('the picker', () => {
  const mockLaunch = jest.fn(async () => ({ canceled: false, assets: [{ uri: 'file:///p.jpg', width: 10, height: 10 }] }));
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('expo-image-picker', () => ({
      launchImageLibraryAsync: mockLaunch,
      launchCameraAsync: jest.fn(),
      requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
      requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
    }));
  });

  it('opens the library without asking for any permission', async () => {
    const { pickFromGallery } = require('../utils/photoPicker');
    const photo = await pickFromGallery();
    expect(mockLaunch).toHaveBeenCalled();
    expect(photo).toEqual({ uri: 'file:///p.jpg', width: 10, height: 10 });
  });

  it('speaks the contractor\'s language', async () => {
    const i18n = require('../i18n/i18n').default;
    await i18n.changeLanguage('de');
    const { Alert } = require('react-native');
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    require('../utils/photoPicker').showPhotoPicker(() => {});
    const [title, body, buttons] = spy.mock.calls[0] as [string, string, Array<{ text: string }>];
    const de = require('../i18n/locales/de.json');
    expect(title).toBe(de.photoPicker.title);
    expect(body).toBe(de.photoPicker.chooseSource);
    expect(buttons.map((b) => b.text)).toEqual([de.photoPicker.camera, de.photoPicker.gallery, de.common.cancel]);
    spy.mockRestore();
  });
});
