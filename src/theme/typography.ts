import { Colors } from './colors';

// The weight lives in the family name (Inter_700Bold etc.), so `fontWeight` was
// redundant on iOS and harmful on Android: RN maps fontFamily+fontWeight onto
// Typeface.create(family, style), which layers a *synthetic* bold on top of an
// already-bold face. Naming the weighted family alone renders correctly on
// both platforms.
export const Typography = {
  title: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  body: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
  },
  muted: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.muted,
  },
};
