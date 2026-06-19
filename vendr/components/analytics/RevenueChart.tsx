import { View, Dimensions } from 'react-native';
import { Text } from '../ui/StyledText';
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop, Circle, Line, Text as SvgText } from 'react-native-svg';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 40 - 40; // screen - margin - card padding
const CHART_HEIGHT = 120;

interface DailyData {
  date: string;
  revenue: number;
}

function buildPath(data: DailyData[], w: number, h: number, maxVal: number) {
  if (data.length < 2) return { line: '', area: '' };
  const step = w / (data.length - 1);
  const pts = data.map((d, i) => ({
    x: i * step,
    y: h - (d.revenue / maxVal) * h,
  }));

  // Smooth cubic bezier
  let line = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpX = (prev.x + curr.x) / 2;
    line += ` C${cpX},${prev.y} ${cpX},${curr.y} ${curr.x},${curr.y}`;
  }

  const area = `${line} L${pts[pts.length - 1].x},${h} L${pts[0].x},${h} Z`;
  return { line, area, pts };
}

export function RevenueChart({ data }: { data: DailyData[] }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map((d) => d.revenue), 1);
  const { line, area, pts } = buildPath(data, CHART_WIDTH, CHART_HEIGHT, maxVal) as any;

  const peakIdx = data.findIndex((d) => d.revenue === maxVal);
  const peakPt = pts?.[peakIdx];

  function formatCompact(n: number) {
    if (n >= 1_000_000) return '₦' + (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return '₦' + (n / 1_000).toFixed(0) + 'K';
    return '₦' + n;
  }

  return (
    <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FDF6EC' }}>Revenue Trend</Text>
        <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50', marginTop: 2 }}>
          Daily breakdown
        </Text>
      </View>
      <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 20, padding: 20 }}>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT + 20}>
          <Defs>
            <SvgGrad id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#E8521A" stopOpacity="0.3" />
              <Stop offset="100%" stopColor="#E8521A" stopOpacity="0" />
            </SvgGrad>
          </Defs>

          {/* Area fill */}
          <Path d={area} fill="url(#revenueGrad)" />

          {/* Line */}
          <Path d={line} stroke="#E8521A" strokeWidth={2.5} fill="none" strokeLinecap="round" />

          {/* Peak dot */}
          {peakPt && (
            <>
              <Circle cx={peakPt.x} cy={peakPt.y} r={5} fill="#E8521A" />
              <Circle cx={peakPt.x} cy={peakPt.y} r={9} fill="rgba(232,82,26,0.2)" />
              <SvgText
                x={peakPt.x}
                y={peakPt.y - 14}
                fill="#FDF6EC"
                fontSize={10}
                fontWeight="bold"
                textAnchor="middle"
              >
                {formatCompact(maxVal)}
              </SvgText>
            </>
          )}

          {/* X-axis dots */}
          {pts?.map((pt: any, i: number) => (
            <Circle key={i} cx={pt.x} cy={CHART_HEIGHT} r={2} fill="#2A1F14" />
          ))}
        </Svg>

        {/* X labels */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          {data.map((d, i) => (
            <Text key={i} style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 10, color: '#6B5E50' }}>
              {d.date}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}