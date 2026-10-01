const GOOGLE_MAPS_HOSTS = new Set([
  'google.com',
  'www.google.com',
  'maps.google.com',
  'maps.app.goo.gl',
  'goo.gl',
]);

const normalizeGoogleMapsUrl = (value) => {
  const rawValue = value?.trim();
  if (!rawValue) return '';

  try {
    const url = new URL(rawValue);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    const isGoogleHost = hostname === 'google.com'
      || hostname.endsWith('.google.com')
      || GOOGLE_MAPS_HOSTS.has(url.hostname.toLowerCase());
    const isMapsPath = url.pathname.startsWith('/maps')
      || url.hostname.toLowerCase() === 'maps.google.com'
      || url.hostname.toLowerCase() === 'maps.app.goo.gl'
      || (url.hostname.toLowerCase() === 'goo.gl' && url.pathname.startsWith('/maps'));

    return url.protocol === 'https:' && isGoogleHost && isMapsPath ? url.toString() : '';
  } catch {
    return '';
  }
};

const extractMapQuery = (googleMapsUrl) => {
  const safeUrl = normalizeGoogleMapsUrl(googleMapsUrl);
  if (!safeUrl) return '';

  const url = new URL(safeUrl);
  const query = url.searchParams.get('q') || url.searchParams.get('query');
  if (query) return query;

  const coordinateMatch = decodeURIComponent(url.pathname).match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (coordinateMatch) return `${coordinateMatch[1]},${coordinateMatch[2]}`;

  const placeMatch = decodeURIComponent(url.pathname).match(/\/maps\/place\/([^/]+)/);
  if (placeMatch) return placeMatch[1].replace(/\+/g, ' ');

  return '';
};

export const getGoogleMapsLinks = (location, googleMapsUrl) => {
  const safeUrl = normalizeGoogleMapsUrl(googleMapsUrl);
  const query = extractMapQuery(safeUrl) || location?.trim();

  if (!query) return { embedUrl: '', directionsUrl: safeUrl };

  return {
    embedUrl: safeUrl && new URL(safeUrl).pathname.startsWith('/maps/embed')
      ? safeUrl
      : `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`,
    directionsUrl: safeUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
  };
};
