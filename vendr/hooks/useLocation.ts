import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

interface LocationState {
  lat: number | null;
  lng: number | null;
  address: string | null;
  loading: boolean;
  error: string | null;
}

export function useLocation() {
  const [state, setState] = useState<LocationState>({
    lat: null,
    lng: null,
    address: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let subscriber: Location.LocationSubscription | null = null;

    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setState(s => ({ ...s, loading: false, error: 'Location permission denied' }));
        return;
      }

      // Get initial position fast
      const initial = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude: lat, longitude: lng } = initial.coords;

      // Reverse geocode for address
      const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const address = place
        ? [place.street, place.district, place.city].filter(Boolean).join(', ')
        : 'Lagos, Nigeria';

      setState({ lat, lng, address, loading: false, error: null });

      // Watch for updates
      subscriber = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 50 },
        (loc) => {
          setState(s => ({
            ...s,
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          }));
        }
      );
    };

    start();
    return () => { subscriber?.remove(); };
  }, []);

  return state;
}