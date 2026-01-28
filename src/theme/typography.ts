import { Colors } from './colors';

export const Typography = {
  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
  },
  muted: {
    fontSize: 13,
    fontWeight: '400' as const,
    fontFamily: 'Inter_400Regular',
    color: Colors.muted,
  },
};
