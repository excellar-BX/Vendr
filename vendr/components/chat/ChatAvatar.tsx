import { memo, useState } from 'react';
import { View, Image } from 'react-native';
import { Text } from '../ui/StyledText';
import { T, useTheme } from '../../constants/theme';
import { usePresence } from '../../stores/presenceStore';

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Avatar with initials fallback and a live online dot driven by the presence store. */
export const ChatAvatar = memo(function ChatAvatar({
  uri, name, userId, size = 52, showPresence = true,
}: {
  uri?: string | null;
  name: string;
  userId?: string | null;
  size?: number;
  showPresence?: boolean;
}) {
  useTheme();
  const presence = usePresence(userId);
  const [failed, setFailed] = useState(false);
  const online = !!presence?.isOnline;
  const dot = Math.max(12, Math.round(size * 0.26));

  return (
    <View style={{ width: size, height: size }}>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          onError={() => setFailed(true)}
          style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: T.surface2 }}
        />
      ) : (
        <View style={{
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: T.primarySoft, borderWidth: 1, borderColor: T.primaryBorder,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: size * 0.34, color: T.primaryInk }}>
            {initialsOf(name)}
          </Text>
        </View>
      )}
      {showPresence && online && (
        <View
          accessibilityLabel="Online"
          style={{
            position: 'absolute', right: 0, bottom: 0,
            width: dot, height: dot, borderRadius: dot / 2,
            backgroundColor: '#22C55E',
            borderWidth: 2.5, borderColor: T.canvas,
          }}
        />
      )}
    </View>
  );
});
