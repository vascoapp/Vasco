// =============================================================================
// DIRECTIONS — hand a job address to the phone's maps app
// =============================================================================
// A crew member standing next to the van should not be retyping an address.
// Every comparable product (Jobber's "route sheets and directions") treats this
// as table stakes; the app had no maps link anywhere.
//
// Deliberately a deep link rather than an embedded map: react-native-maps is a
// native dependency and would force a native rebuild. A link opens whatever the
// contractor already uses — Apple Maps, Google Maps, Waze — and costs nothing.
// =============================================================================

import { Linking, Platform } from 'react-native';
import type { JobAddress } from '../domain/jobs';

/**
 * Build the one-line destination string.
 *
 * The job detail screen renders `address.street` alone, which is fine to read
 * next to a customer name but ambiguous to navigate to — "Kerkstraat 12" exists
 * in most Dutch towns. Postcode is the part that actually disambiguates, so it
 * goes in even when the city is missing.
 */
export function formatDestination(address: Partial<JobAddress> | null | undefined): string {
  if (!address) return '';
  const parts = [
    address.street?.trim(),
    [address.postcode?.trim(), address.city?.trim()].filter(Boolean).join(' '),
    address.country?.trim(),
  ].filter((p): p is string => !!p && p.length > 0);
  return parts.join(', ');
}

/**
 * Platform-native maps URL for a destination.
 *
 * `maps://` and `geo:` open the OS default (which respects a contractor who has
 * set Waze or Google Maps as their preferred app). The https form is the
 * fallback for when no handler is registered — on a simulator, or an Android
 * build with no maps app installed.
 */
export function directionsUrl(destination: string): { primary: string; fallback: string } {
  const q = encodeURIComponent(destination);
  if (Platform.OS === 'ios') {
    return {
      primary: `maps://?daddr=${q}`,
      fallback: `https://maps.apple.com/?daddr=${q}`,
    };
  }
  return {
    // `geo:0,0?q=` rather than a lat/lng: we have a postal address, not
    // coordinates, and geocoding it ourselves would need an API key and a
    // network round trip for something the maps app does for free.
    primary: `geo:0,0?q=${q}`,
    fallback: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
  };
}

/**
 * Open directions to a job.
 *
 * Returns false when there is nothing to navigate to, so callers can hide the
 * affordance rather than offering a button that does nothing.
 */
export async function openDirections(
  address: Partial<JobAddress> | null | undefined,
): Promise<boolean> {
  const destination = formatDestination(address);
  if (!destination) return false;

  const { primary, fallback } = directionsUrl(destination);
  try {
    // canOpenURL can throw on Android when the scheme is not in the manifest
    // queries list, so the whole attempt is guarded rather than just awaited.
    const supported = await Linking.canOpenURL(primary);
    await Linking.openURL(supported ? primary : fallback);
    return true;
  } catch {
    try {
      await Linking.openURL(fallback);
      return true;
    } catch {
      return false;
    }
  }
}
