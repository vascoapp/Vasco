// WhatsApp opens through wa.me, with an international number or none — never
// `whatsapp://`, which did nothing on a phone without the app and was
// swallowed by three screens (emulator walk 2026-09-28).
import fs from 'fs';
import path from 'path';
import { Alert, Linking } from 'react-native';
import { sendWhatsApp } from '../whatsappService';
import { stripComments } from '../../utils/stripComments';

describe('sendWhatsApp', () => {
  let open: jest.SpyInstance;
  beforeEach(() => { open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any); });
  afterEach(() => jest.restoreAllMocks());

  it('makes a Dutch national number international', async () => {
    expect(await sendWhatsApp('06 12345678', 'Hoi', 'NL')).toBe(true);
    expect(open).toHaveBeenCalledWith('https://wa.me/31612345678?text=Hoi');
  });

  it('keeps a number written with +', async () => {
    await sendWhatsApp('+49 151 2345678', 'Hallo', 'NL');
    expect(open).toHaveBeenCalledWith('https://wa.me/491512345678?text=Hallo');
  });

  it('unknown country + national number: WhatsApp opens, the contractor picks — no guessed number', async () => {
    await sendWhatsApp('06 12345678', 'Hoi daar');
    expect(open).toHaveBeenCalledWith('https://wa.me/?text=Hoi%20daar');
  });

  it('says so when WhatsApp cannot open', async () => {
    open.mockRejectedValueOnce(new Error('no handler'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    expect(await sendWhatsApp('+31612345678', 'x', 'NL')).toBe(false);
    expect(alert).toHaveBeenCalled();
  });
});

it('no screen or service builds a whatsapp:// link', () => {
  const ROOT = path.resolve(__dirname, '../../..');
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? (e.name === '__tests__' ? [] : walk(p)) : /\.tsx?$/.test(e.name) ? [p] : [];
  });
  const hits = ['app', 'src'].flatMap((d) => walk(path.join(ROOT, d)))
    .filter((f) => /whatsapp:\/\//.test(stripComments(fs.readFileSync(f, 'utf8'))))
    .map((f) => path.relative(ROOT, f));
  expect(hits).toEqual([]);
});
