import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IoniconsName; focused: boolean }) {
  return (
    <Ionicons
      name={focused ? name : `${name}-outline` as IoniconsName}
      size={24}
      color={focused ? '#E8521A' : '#6B5E50'}
    />
  );
}

export default function TabsLayout() {
  const { isRunnerMode } = useAuthStore();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1A1208',
          borderTopColor: '#3D3026',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: isRunnerMode ? '#2D8653' : '#E8521A',
        tabBarInactiveTintColor: '#6B5E50',
        tabBarLabelStyle: {
          fontFamily: 'SpaceGrotesk_500Medium',
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          href: isRunnerMode ? null : '/(tabs)',
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          href: isRunnerMode ? null : '/(tabs)/search',
          tabBarIcon: ({ focused }) => <TabIcon name="search" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="reels"
        options={{
          title: 'Reels',
          href: isRunnerMode ? null : '/(tabs)/reels',
          tabBarIcon: ({ focused }) => <TabIcon name="play-circle" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="runner-jobs"
        options={{
          title: 'Jobs',
          href: isRunnerMode ? '/(tabs)/runner-jobs' : null,
          tabBarIcon: ({ focused }) => <TabIcon name="list" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="runner-active"
        options={{
          title: 'Active',
          href: isRunnerMode ? '/(tabs)/runner-active' : null,
          tabBarIcon: ({ focused }) => <TabIcon name="bicycle" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="runner-earnings"
        options={{
          title: 'Earnings',
          href: isRunnerMode ? '/(tabs)/runner-earnings' : null,
          tabBarIcon: ({ focused }) => <TabIcon name="wallet" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ focused }) => <TabIcon name="chatbubble" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} />,
        }}
      />
    </Tabs>
  );
}