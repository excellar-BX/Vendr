// Nominatim (OpenStreetMap) geocoding service
// Free, rate-limited, no API key required

export interface GeocodeResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    suburb?: string;
    district?: string;
  };
}

export interface AutocompleteResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

const NOMINATIM_API = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'VendrApp/1.0';

/**
 * Geocode a place name to coordinates
 * @param query - Place name to search for (e.g., "Ikeja, Lagos")
 * @param country - Country code to restrict search (default: 'ng' for Nigeria)
 */
export async function geocodePlace(
  query: string,
  country: string = 'ng'
): Promise<GeocodeResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    featuretype: 'city',
    countrycodes: country,
    limit: '5',
  });

  try {
    const response = await fetch(
      `${NOMINATIM_API}/search?${params.toString()}`,
      {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const data: GeocodeResult[] = await response.json();
    return data;
  } catch (error) {
    console.error('Geocoding error:', error);
    throw error;
  }
}

/**
 * Get autocomplete suggestions for a place name
 * @param query - Partial place name
 * @param country - Country code to restrict search (default: 'ng')
 */
export async function getPlaceSuggestions(
  query: string,
  country: string = 'ng'
): Promise<AutocompleteResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    featuretype: 'city',
    countrycodes: country,
    limit: '5',
  });

  try {
    const response = await fetch(
      `${NOMINATIM_API}/search?${params.toString()}`,
      {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Autocomplete failed: ${response.status}`);
    }

    const data: AutocompleteResult[] = await response.json();
    return data;
  } catch (error) {
    console.error('Autocomplete error:', error);
    return [];
  }
}

/**
 * Reverse geocode coordinates to get place name
 * @param lat - Latitude
 * @param lng - Longitude
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lng.toString(),
      format: 'json',
      addressdetails: '1',
    });

    const response = await fetch(
      `${NOMINATIM_API}/reverse?${params.toString()}`,
      {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed: ${response.status}`);
    }

    const data: any = await response.json();
    
    // Build a readable address from the components
    const addr = data.address;
    if (!addr) return data.display_name || null;

    const parts = [
      addr.road,
      addr.suburb,
      addr.district,
      addr.city || addr.town || addr.village,
      addr.state,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : data.display_name || null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}
