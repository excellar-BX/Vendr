import { View } from 'react-native';
import { Text } from '../ui/StyledText';
import { Ionicons } from '@expo/vector-icons';

interface Summary {
  unique_visitors: number;
  product_views: number;
  inquiries: number;
  orders_count: number;
}

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(Math.max(value, min), max);

export function ConversionFunnel({ summary }: { summary: Summary }) {
  const stages = [
    {
      label: 'Visitors',
      value: summary.unique_visitors ?? 0,
      icon: 'eye-outline',
      color: '#5599E8',
    },
    {
      label: 'Product Views',
      value: summary.product_views ?? 0,
      icon: 'grid-outline',
      color: '#F5A623',
    },
    {
      label: 'Inquiries',
      value: summary.inquiries ?? 0,
      icon: 'chatbubble-outline',
      color: '#9B59B6',
    },
    {
      label: 'Orders',
      value: summary.orders_count ?? 0,
      icon: 'bag-check-outline',
      color: '#2D8653',
    },
  ];

  // Use the highest stage value so bars never exceed 100%
  const maxVal = Math.max(...stages.map(stage => stage.value), 1);

  return (
    <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
      <View style={{ marginBottom: 12 }}>
        <Text
          style={{
            fontFamily: 'SpaceGrotesk_700Bold',
            fontSize: 16,
            color: '#FDF6EC',
          }}
        >
          Conversion Funnel
        </Text>
        <Text
          style={{
            fontFamily: 'SpaceGrotesk_400Regular',
            fontSize: 12,
            color: '#6B5E50',
            marginTop: 2,
          }}
        >
          How visitors become buyers
        </Text>
      </View>

      <View
        style={{
          backgroundColor: '#1A1208',
          borderWidth: 1,
          borderColor: '#2A1F14',
          borderRadius: 20,
          padding: 20,
          gap: 12,
        }}
      >
        {stages.map((stage, i) => {
          const rawPct = (stage.value / maxVal) * 100;
          const pct = clamp(rawPct);

          const prevValue = i > 0 ? stages[i - 1].value : 0;
          const hasPrev = i > 0 && prevValue > 0;

          const deltaPct = hasPrev
            ? (((stage.value - prevValue) / prevValue) * 100)
            : 0;

          const isDropOff = hasPrev && stage.value <= prevValue;
          const labelText = hasPrev
            ? isDropOff
              ? `${Math.abs(deltaPct).toFixed(0)}% drop-off`
              : `${deltaPct.toFixed(0)}% growth`
            : null;

          return (
            <View key={stage.label}>
              {i > 0 && labelText && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingLeft: 8,
                    marginBottom: 8,
                  }}
                >
                  <Ionicons
                    name={isDropOff ? 'arrow-down' : 'arrow-up'}
                    size={12}
                    color="#3D3026"
                  />
                  <Text
                    style={{
                      fontFamily: 'SpaceGrotesk_400Regular',
                      fontSize: 11,
                      color: '#3D3026',
                    }}
                  >
                    {labelText}
                  </Text>
                </View>
              )}

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: `${stage.color}18`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Ionicons name={stage.icon as any} size={14} color={stage.color} />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                      gap: 8,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        fontFamily: 'SpaceGrotesk_500Medium',
                        fontSize: 12,
                        color: '#9A8570',
                      }}
                    >
                      {stage.label}
                    </Text>

                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: 'SpaceGrotesk_700Bold',
                        fontSize: 12,
                        color: '#FDF6EC',
                        flexShrink: 0,
                      }}
                    >
                      {stage.value.toLocaleString()} · {pct.toFixed(0)}%
                    </Text>
                  </View>

                  <View
                    style={{
                      height: 8,
                      backgroundColor: '#0F0A06',
                      borderRadius: 4,
                      overflow: 'hidden', // important
                    }}
                  >
                    <View
                      style={{
                        height: 8,
                        backgroundColor: stage.color,
                        width: `${pct}%`,
                        maxWidth: '100%',
                        borderRadius: 4,
                      }}
                    />
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}