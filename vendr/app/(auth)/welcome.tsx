//welcome.tsx
import { useRef, useState, useEffect } from 'react';
import {
  View, Dimensions, TouchableOpacity,
  FlatList, Animated, ViewToken,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { Text } from '../../components/ui/StyledText';
import { Button } from '../../components/ui/Button';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    title: 'Your street,\nyour market.',
    subtitle: 'Discover verified local vendors near you — food, fashion, accessories and more. All within walking distance.',
    illustration: 'map',
  },
  {
    id: '2',
    title: 'Vendors you\ncan trust.',
    subtitle: 'Every vendor on Vendr goes through a verification process. Shop with confidence, every single time.',
    illustration: 'shield',
  },
  {
    id: '3',
    title: 'Buy local.\nGrow local.',
    subtitle: 'Support businesses in your community. Chat, pay, and get it delivered — all in one place.',
    illustration: 'community',
  },
];

function MapIllustration() {
  return (
    <View className="w-52 h-52 rounded-full bg-orange/10 border border-orange/20 items-center justify-center">
      <Svg width={180} height={180} viewBox="0 0 180 180">
        <Line x1={0} y1={60} x2={180} y2={60} stroke="rgba(232,82,26,0.2)" strokeWidth={1} />
        <Line x1={0} y1={120} x2={180} y2={120} stroke="rgba(232,82,26,0.2)" strokeWidth={1} />
        <Line x1={60} y1={0} x2={60} y2={180} stroke="rgba(232,82,26,0.2)" strokeWidth={1} />
        <Line x1={120} y1={0} x2={120} y2={180} stroke="rgba(232,82,26,0.2)" strokeWidth={1} />
        <Circle cx={90} cy={90} r={30} fill="#E8521A" fillOpacity={0.15} />
        <Circle cx={90} cy={90} r={18} fill="#E8521A" fillOpacity={0.25} />
        <Circle cx={90} cy={90} r={8} fill="#E8521A" />
        <Circle cx={45} cy={55} r={5} fill="#F5A623" />
        <Circle cx={135} cy={75} r={5} fill="#F5A623" />
        <Circle cx={65} cy={130} r={5} fill="#F5A623" />
        <Circle cx={125} cy={130} r={4} fill="#9A8570" fillOpacity={0.5} />
      </Svg>
    </View>
  );
}

function ShieldIllustration() {
  return (
    <View className="w-52 h-52 rounded-full items-center justify-center border"
      style={{ backgroundColor: 'rgba(45,134,83,0.12)', borderColor: 'rgba(45,134,83,0.2)' }}>
      <Svg width={180} height={180} viewBox="0 0 180 180">
        <Path d="M90 20 L150 45 L150 95 C150 130 90 160 90 160 C90 160 30 130 30 95 L30 45 Z"
          fill="rgba(45,134,83,0.15)" stroke="#2D8653" strokeWidth={2} />
        <Path d="M65 90 L82 107 L115 73"
          stroke="#2D8653" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Circle cx={90} cy={48} r={4} fill="#2D8653" fillOpacity={0.6} />
      </Svg>
    </View>
  );
}

function CommunityIllustration() {
  return (
    <View className="w-52 h-52 rounded-full items-center justify-center border"
      style={{ backgroundColor: 'rgba(245,166,35,0.1)', borderColor: 'rgba(245,166,35,0.2)' }}>
      <Svg width={180} height={180} viewBox="0 0 180 180">
        <Circle cx={90} cy={70} r={22} fill="#E8521A" fillOpacity={0.9} />
        <Circle cx={50} cy={105} r={17} fill="#F5A623" fillOpacity={0.8} />
        <Circle cx={130} cy={105} r={17} fill="#F5A623" fillOpacity={0.8} />
        <Line x1={90} y1={92} x2={50} y2={105} stroke="#E8521A" strokeWidth={1.5} strokeOpacity={0.4} />
        <Line x1={90} y1={92} x2={130} y2={105} stroke="#E8521A" strokeWidth={1.5} strokeOpacity={0.4} />
        <Line x1={67} y1={105} x2={113} y2={105} stroke="#E8521A" strokeWidth={1.5} strokeOpacity={0.4} />
        <Path d="M83 66 C83 63 86 61 90 64 C94 61 97 63 97 66 C97 72 90 77 90 77 C90 77 83 72 83 66Z"
          fill="white" fillOpacity={0.9} />
      </Svg>
    </View>
  );
}

const illustrations = { map: MapIllustration, shield: ShieldIllustration, community: CommunityIllustration };

export default function WelcomeScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const onViewRef = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0);
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const nextIndex = (activeIndex + 1) % slides.length;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActiveIndex(nextIndex);
    }, 3000);
    return () => clearInterval(timer);
  }, [activeIndex]);

  const renderSlide = ({ item }: { item: typeof slides[0] }) => {
    const Illustration = illustrations[item.illustration as keyof typeof illustrations];
    return (
      <View style={{ width }} className="px-8 pt-4 items-center">
        <Illustration />
        <Text style={{ fontWeight: '600' }} className="text-cream text-4xl text-center mt-9 mb-4 tracking-tight leading-tight"
          >
          {item.title}
        </Text>
        <Text className="text-muted text-base text-center leading-relaxed px-2">
          {item.subtitle}
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />

      {/* Glows */}
      <View className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-orange opacity-[0.07]" />
      <View className="absolute -bottom-10 -left-20 w-72 h-72 rounded-full bg-gold opacity-[0.05]" />

      {/* Logo */}
      <View className="pt-14 px-7 pb-4">
        <Text className="text-cream text-2xl tracking-tight" >
          vendr<Text className="text-orange">.</Text>
        </Text>
      </View>

      {/* Carousel */}
      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onViewableItemsChanged={onViewRef.current}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        style={{ flexGrow: 0 }}
      />

      {/* Dots */}
      <View className="flex-row items-center justify-center gap-1.5 mt-7 mb-2">
        {slides.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const dotWidth = scrollX.interpolate({ inputRange, outputRange: [6, 24, 6], extrapolate: 'clamp' });
          const opacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
          return <Animated.View key={i} style={{ width: dotWidth, opacity }} className="h-1.5 rounded-full bg-orange" />;
        })}
      </View>

      {/* CTA */}
      <View className="px-7 pb-12 mt-auto gap-4">
        <Button label="Get Started" onPress={() => router.push('/(auth)/register')} iconRight="arrow-forward" />

        <TouchableOpacity className="items-center py-2" onPress={() => router.push('/(auth)/login')}>
          <Text className="text-subtle text-sm">
            Already have an account?{' '}
            <Text className="text-orange" style={{ fontWeight: '600' }}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}