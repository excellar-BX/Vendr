import { View, Dimensions } from 'react-native';
import { Text } from '../ui/StyledText';
import Svg, { Circle, G } from 'react-native-svg';

const SIZE = 140;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const CIRCUM = 2 * Math.PI * R;

interface Summary {
  conversion_rate: number;
  revenue_growth: number;
  repeat_customers: number;
  orders_count: number;
}

function RingSegment({ pct, color, offset }: { pct: number; color: string; offset: number }) {
  const dash = (pct / 100) * CIRCUM;
  return (
    <Circle
      cx={SIZE / 2} cy={SIZE / 2} r={R}
      stroke={color} strokeWidth={STROKE}
      strokeDasharray={`${dash} ${CIRCUM}`}
      strokeDashoffset={-offset}
      fill="none"
      strokeLinecap="round"
      rotation={-90}
      origin={`${SIZE / 2}, ${SIZE / 2}`}
    />
  );
}

export function PerformanceRing({ summary }: { summary: Summary }) {
  const ordersCount = summary.orders_count || 1; // ← avoid divide by zero

  const score = Math.min(
    Math.round(
      ((summary.conversion_rate ?? 0) / 10) * 40 +
      (Math.min(summary.revenue_growth ?? 0, 30) / 30) * 35 +
      (Math.min((summary.repeat_customers ?? 0) / ordersCount, 1)) * 25
    ),
    100,
  );


  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Average' : 'Needs Work';
  const labelColor = score >= 80 ? '#2D8653' : score >= 60 ? '#F5A623' : score >= 40 ? '#E8521A' : '#DC3545';

  return (
    <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FDF6EC' }}>Performance Score</Text>
        <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50', marginTop: 2 }}>
          Based on conversion, growth & retention
        </Text>
      </View>
      <View style={{
        backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
        borderRadius: 20, padding: 24, alignItems: 'center',
      }}>
        <View style={{ position: 'relative', width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={SIZE} height={SIZE}>
            {/* Background ring */}
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="#2A1F14" strokeWidth={STROKE} fill="none" />
            {/* Score ring */}
            <RingSegment pct={score} color={labelColor} offset={0} />
          </Svg>
          <View style={{ position: 'absolute', alignItems: 'center' }}>
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 28, color: '#FDF6EC' }}>{score}</Text>
            <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 11, color: labelColor }}>{label}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 24, marginTop: 20 }}>
          {[
            { label: 'Conversion', value: `${summary.conversion_rate?.toFixed(1)}%`, color: '#5599E8' },
            { label: 'Growth', value: `+${summary.revenue_growth?.toFixed(1)}%`, color: '#2D8653' },
            { label: 'Retention', value: `${((summary.repeat_customers / summary.orders_count) * 100).toFixed(0)}%`, color: '#E8521A' },
          ].map((m) => (
            <View key={m.label} style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: m.color }}>{m.value}</Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#6B5E50' }}>{m.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}