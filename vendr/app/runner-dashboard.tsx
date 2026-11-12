import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { RUNNER_GREEN } from '../components/runner/RunnerKit';
import { T, useTheme } from '../constants/theme';

/**
 * The runner "dashboard" is now the Jobs tab (online switch, today's earnings,
 * active runs and the live job board). This route switches the app into runner
 * mode and opens it, so existing links keep working.
 */
export default function RunnerDashboardRedirect() {
  useTheme();
  const setRunnerMode = useAuthStore((s) => s.setRunnerMode);
  useEffect(() => {
    setRunnerMode(true);
    router.replace('/(tabs)/runner-jobs');
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: T.canvas, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={RUNNER_GREEN} />
    </View>
  );
}
