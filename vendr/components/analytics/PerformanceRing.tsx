import { View, Dimensions } from 'react-native';
import { Text } from '../ui/StyledText';
import Svg, { Circle, G } from 'react-native-svg';
import { T, useTheme } from '../../constants/theme';

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
  useTheme();
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
  useTheme();
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
  const labelColor = score >= 80 ? T.successInk : score >= 60 ? T.goldInk : score >= 40 ? '#E8521A' : T.dangerInk;

  return (
    <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: T.ink }}>Performance Score</Text>
        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: T.ink3, marginTop: 2 }}>
          Based on conversion, growth & retention
        </Text>
      </View>
      <View style={{
        backgroundColor: T.surface, borderWidth: 1, borderColor: T.line,
        borderRadius: 20, padding: 24, alignItems: 'center',
      }}>
        <View style={{ position: 'relative', width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={SIZE} height={SIZE}>
            {/* Background ring */}
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={T.line} strokeWidth={STROKE} fill="none" />
            {/* Score ring */}
            <RingSegment pct={score} color={labelColor} offset={0} />
          </Svg>
          <View style={{ position: 'absolute', alignItems: 'center' }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 28, color: T.ink }}>{score}</Text>
            <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: labelColor }}>{label}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 24, marginTop: 20 }}>
          {[
            { label: 'Conversion', value: `${summary.conversion_rate?.toFixed(1)}%`, color: T.infoInk },
            { label: 'Growth', value: `+${summary.revenue_growth?.toFixed(1)}%`, color: T.successInk },
            { label: 'Retention', value: `${((summary.repeat_customers / summary.orders_count) * 100).toFixed(0)}%`, color: '#E8521A' },
          ].map((m) => (
            <View key={m.label} style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: m.color }}>{m.value}</Text>
              <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: T.ink3 }}>{m.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}