import { useState, useEffect } from 'react';
import * as Network from 'expo-network';

interface NetworkState {
  isOnline: boolean;
  isConnected: boolean;
  type: string | null;
}

export function useNetwork() {
  const [state, setState] = useState<NetworkState>({
    isOnline: true,
    isConnected: true,
    type: null,
  });

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const checkNetwork = async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        setState({
          isOnline: networkState.isInternetReachable ?? false,
          isConnected: networkState.isConnected ?? false,
          type: networkState.type ?? null,
        });
      } catch (error) {
        console.error('Network check failed:', error);
        setState({
          isOnline: false,
          isConnected: false,
          type: null,
        });
      }
    };

    // Check initial state
    checkNetwork();

    // Poll every 3 seconds for network changes
    intervalId = setInterval(checkNetwork, 3000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  return state;
}
