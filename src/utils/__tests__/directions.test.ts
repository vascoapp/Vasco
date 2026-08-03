// =============================================================================
// DIRECTIONS
// =============================================================================
// The failure that matters is navigating a crew to the wrong place, so the
// destination string is what these pin.
// =============================================================================

import { formatDestination, directionsUrl, openDirections } from '../directions';
import { Linking } from 'react-native';

describe('destination string', () => {
  it('includes the postcode, which is what actually disambiguates', () => {
    // "Kerkstraat 12" exists in most Dutch towns; the street alone -- which is
    // all the job screen renders -- would route the van to the wrong one.
    expect(
      formatDestination({ street: 'Kerkstraat 12', city: 'Utrecht', postcode: '3511 AB', country: 'NL' }),
    ).toBe('Kerkstraat 12, 3511 AB Utrecht, NL');
  });

  it('keeps the postcode even when the city is missing', () => {
    expect(formatDestination({ street: 'Kerkstraat 12', postcode: '3511 AB' })).toBe(
      'Kerkstraat 12, 3511 AB',
    );
  });

  it('drops empty and whitespace-only parts rather than leaving stray commas', () => {
    expect(formatDestination({ street: 'Kerkstraat 12', city: '   ', postcode: '', country: 'NL' }))
      .toBe('Kerkstraat 12, NL');
  });

  it('returns empty for no address, so callers can hide the button', () => {
    expect(formatDestination(null)).toBe('');
    expect(formatDestination(undefined)).toBe('');
    expect(formatDestination({})).toBe('');
  });
});

describe('urls', () => {
  it('encodes the destination', () => {
    const { primary, fallback } = directionsUrl('Kerkstraat 12, 3511 AB Utrecht');
    // A raw space would truncate the destination at the first word.
    expect(primary).not.toContain(' ');
    expect(fallback).not.toContain(' ');
    expect(decodeURIComponent(primary.split('=')[1])).toBe('Kerkstraat 12, 3511 AB Utrecht');
  });

  it('always offers an https fallback for when no maps app is registered', () => {
    expect(directionsUrl('x').fallback).toMatch(/^https:\/\//);
  });
});

describe('opening', () => {
  afterEach(() => jest.restoreAllMocks());

  it('does nothing and reports false when there is no address', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    expect(await openDirections({})).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('falls back to the web url when the native scheme has no handler', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false as never);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    await openDirections({ street: 'Kerkstraat 12', postcode: '3511 AB' });
    expect(String(open.mock.calls[0][0])).toMatch(/^https:\/\//);
  });

  it('survives canOpenURL throwing, which Android does for unqueried schemes', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockRejectedValue(new Error('not queryable') as never);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    expect(await openDirections({ street: 'Kerkstraat 12' })).toBe(true);
    expect(String(open.mock.calls[0][0])).toMatch(/^https:\/\//);
  });
});
