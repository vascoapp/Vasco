// =============================================================================
// PUBLIC QUOTE LINK — deep link target for email CTAs
// =============================================================================
// vasco://quote/:id and https://vascobuild.com/quote/:id route here. Forwards to
// the existing contractor customer-view which handles unauthenticated quote
// access via the `quoteId` param.
// =============================================================================

import { useEffect } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function QuoteDeepLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useEffect(() => {}, [id]);
  return <Redirect href={{ pathname: '/contractor/customer-view', params: { quoteId: id ?? '' } }} />;
}
