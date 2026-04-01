import { useEffect, useRef } from 'react';
import { View, Animated, Dimensions } from 'react-native';
import { Image } from 'react-native';
import { Text } from './ui/StyledText';


const { width, height } = Dimensions.get('window');

export default function SplashScreenView() {
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(taglineY, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View className="flex-1 bg-dark items-center justify-center">
      {/* Glow */}
      <View
        className="absolute rounded-full bg-orange opacity-[0.06]"
        style={{ width: 400, height: 400, top: height / 2 - 200, left: width / 2 - 200 }}
      />

      <Animated.View
        className="items-center gap-4"
        style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}
      >
        {/* Logo mark */}
        <Image 
  source={require('../assets/vendr-logo.png')} 
  className="w-[90px] h-[90px]"
  resizeMode="contain"
/>

        {/* Wordmark */}
        <Text style={{fontWeight: '400'}} className="text-cream text-4xl tracking-tight">
          vendr<Text className="text-orange">.</Text>
        </Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.Text
        className="text-subtle text-xs tracking-[0.2em] uppercase mt-6"
        style={{ opacity: taglineOpacity, transform: [{ translateY: taglineY }], fontWeight: '400' }}
      >
        Where Local Thrives
      </Animated.Text>
    </View>
  );
}