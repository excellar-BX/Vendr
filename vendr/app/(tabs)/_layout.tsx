import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Fonts, Shadow } from '../../constants/colors';
import { T, useTheme } from '../../constants/theme';
import { useChatUnreadTotal, useConversationsRealtime } from '../../hooks/useConversations';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused, color }: { name: IoniconsName; focused: boolean; color: string }) {
  useTheme();
  return (
    <Ionicons
      name={focused ? name : `${name}-outline` as IoniconsName}
      size={23}
      color={color}
    />
  );
}

export default function TabsLayout() {
  useTheme();
  const { isRunnerMode } = useAuthStore();
  const insets = useSafeAreaInsets();
  // Keeps the shared conversation list live while anywhere in the app
  useConversationsRealtime();
  const chatUnread = useChatUnreadTotal();

  return (
    <Tabs
      screenOptions={{
        sceneStyle: { backgroundColor: T.canvas },
        headerShown: false,
        tabBarStyle: {
          backgroundColor: T.surface,
          borderTopColor: T.lineStrong,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: isRunnerMode ? T.successInk : '#E8521A',
        tabBarInactiveTintColor: T.ink3,
        tabBarLabelStyle: {
          fontFamily: 'PlusJakartaSans_500Medium',
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          href: isRunnerMode ? null : '/(tabs)',
          tabBarIcon: ({ focused, color }) => <TabIcon name="home" focused={focused} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          href: isRunnerMode ? null : '/(tabs)/search',
          tabBarIcon: ({ focused, color }) => <TabIcon name="search" focused={focused} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="reels"
        options={{
          title: 'Reels',
          href: isRunnerMode ? null : '/(tabs)/reels',
          tabBarIcon: ({ focused, color }) => <TabIcon name="play-circle" focused={focused} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="runner-jobs"
        options={{
          title: 'Jobs',
          href: isRunnerMode ? '/(tabs)/runner-jobs' : null,
          tabBarIcon: ({ focused, color }) => <TabIcon name="list" focused={focused} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="runner-active"
        options={{
          title: 'Active',
          href: isRunnerMode ? '/(tabs)/runner-active' : null,
          tabBarIcon: ({ focused, color }) => <TabIcon name="bicycle" focused={focused} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="runner-earnings"
        options={{
          title: 'Earnings',
          href: isRunnerMode ? '/(tabs)/runner-earnings' : null,
          tabBarIcon: ({ focused, color }) => <TabIcon name="wallet" focused={focused} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarBadge: chatUnread > 0 ? (chatUnread > 99 ? '99+' : chatUnread) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#E8521A',
            color: '#FFFFFF',
            fontFamily: 'PlusJakartaSans_700Bold',
            fontSize: 10,
          },
          tabBarIcon: ({ focused, color }) => <TabIcon name="chatbubble" focused={focused} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color }) => <TabIcon name="person" focused={focused} color={color as string} />,
        }}
      />
    </Tabs>
  );
}