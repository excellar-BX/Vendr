import { useState, useRef } from 'react';
import {
  View, ScrollView, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert, Animated, Image, Modal,
} from 'react-native';
import { uploadFile } from '../lib/storage';
import { apiFetch } from '../lib/api';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text } from '../components/ui/StyledText';
import { StyledInput } from '../components/ui/StyledInput';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../stores/authStore';
import { useLocation } from '../hooks/useLocation';
import { Category } from '../types';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const CATEGORIES: { label: Category; icon: IoniconsName }[] = [
  { label: 'Food & Drinks',  icon: 'fast-food-outline' },
  { label: 'Fashion',        icon: 'shirt-outline' },
  { label: 'Accessories',    icon: 'diamond-outline' },
  { label: 'Beauty & Hair',  icon: 'cut-outline' },
  { label: 'Electronics',    icon: 'phone-portrait-outline' },
  { label: 'Groceries',      icon: 'basket-outline' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STEPS = [
  { title: 'Business Info',  subtitle: 'Tell us about your business',       icon: 'storefront-outline' as IoniconsName },
  { title: 'Location',       subtitle: 'Where are you based?',              icon: 'location-outline' as IoniconsName },
  { title: 'Contact',        subtitle: 'How can customers reach you?',      icon: 'call-outline' as IoniconsName },
  { title: 'Hours',          subtitle: 'When are you open?',                icon: 'time-outline' as IoniconsName },
  { title: 'Review',         subtitle: 'Almost there — review your info',   icon: 'checkmark-circle-outline' as IoniconsName },
];

interface FormData {
  business_name: string;
  category: Category | '';
  description: string;
  address: string;
  use_current_location: boolean;
  phone: string;
  whatsapp: string;
  instagram: string;
  twitter: string;
  open_days: string[];
  open_time: string;
  close_time: string;
  logo_uri: string | null;
  banner_uri: string | null;
}

function SectionLabel({ label }: { label: string }) {
  return (
    <Text className="text-muted text-xs tracking-widest uppercase mb-2" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
      {label}
    </Text>
  );
}

function InputField({
  label, value, onChangeText, placeholder, multiline = false,
  keyboardType = 'default', icon, maxLength,
}: {
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder: string; multiline?: boolean; keyboardType?: any;
  icon?: IoniconsName; maxLength?: number;
}) {
  return (
    <View className="mb-4">
      <SectionLabel label={label} />
      <View className={`flex-row items-${multiline ? 'start' : 'center'} bg-dark-2 border border-faint rounded-2xl px-4 ${multiline ? 'py-3' : 'h-14'} gap-3`}>
        {icon && <Ionicons name={icon} size={18} color="#6B5E50" style={{ marginTop: multiline ? 2 : 0 }} />}
        <StyledInput
          className="flex-1 text-cream text-base"
          placeholder={placeholder}
          placeholderTextColor="#6B5E50"
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          keyboardType={keyboardType}
          maxLength={maxLength}
          style={{ textAlignVertical: multiline ? 'top' : 'center', minHeight: multiline ? 90 : undefined }}
        />
      </View>
      {maxLength && (
        <Text className="text-muted text-xs text-right mt-1">{value.length}/{maxLength}</Text>
      )}
    </View>
  );
}

// ── Native time picker ───────────────────────────────────────────────────
function TimeInput({ label, value, onChange, icon }: {
  label: string; value: string; onChange: (v: string) => void; icon: IoniconsName;
}) {
  const [show, setShow] = useState(false);
  // Temp holds the spinning value on iOS before confirming
  const [tempDate, setTempDate] = useState<Date | null>(null);

  const toDate = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const d = new Date();
    d.setHours(isNaN(h) ? 8 : h, isNaN(m) ? 0 : m, 0, 0);
    return d;
  };

  const fmt = (d: Date) => {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const onPickerChange = (_: any, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
      if (selected) onChange(fmt(selected));
    } else {
      // iOS — just update temp, wait for Done
      if (selected) setTempDate(selected);
    }
  };

  const confirmIOS = () => {
    if (tempDate) onChange(fmt(tempDate));
    setTempDate(null);
    setShow(false);
  };

  const cancelIOS = () => {
    setTempDate(null);
    setShow(false);
  };

  return (
    <View className="flex-1 mb-4">
      <SectionLabel label={label} />
      <TouchableOpacity
        onPress={() => { setTempDate(toDate(value)); setShow(true); }}
        activeOpacity={0.8}
        className="flex-row items-center bg-dark-2 border border-faint rounded-2xl px-4 h-14 gap-3"
      >
        <Ionicons name={icon} size={18} color="#6B5E50" />
        <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', color: '#FDF6EC', fontSize: 16, flex: 1 }}>
          {value || '--:--'}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#6B5E50" />
      </TouchableOpacity>

      {/* Android: renders inline below the button */}
      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={toDate(value)}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={onPickerChange}
        />
      )}

      {/* iOS: modal with dark sheet + Done/Cancel */}
      {Platform.OS === 'ios' && (
        <Modal visible={show} transparent animationType="slide">
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
            activeOpacity={1}
            onPress={cancelIOS}
          />
          <View style={{ backgroundColor: '#1A1208', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#2A1F14' }}>
              <TouchableOpacity onPress={cancelIOS} style={{ padding: 4 }}>
                <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', color: '#9A8570', fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', color: '#FDF6EC', fontSize: 15 }}>{label}</Text>
              <TouchableOpacity onPress={confirmIOS} style={{ padding: 4 }}>
                <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', color: '#E8521A', fontSize: 15 }}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDate ?? toDate(value)}
              mode="time"
              is24Hour={true}
              display="spinner"
              onChange={onPickerChange}
              themeVariant="dark"
              style={{ height: 180 }}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}

// ── Leaflet map (OpenStreetMap, zero API key) ─────────────────────────────
function LeafletMap({ lat, lng, onPin }: {
  lat: number; lng: number; onPin: (lat: number, lng: number) => void;
}) {
  const webviewRef = useRef<any>(null);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; background:#0F0A06; }
    .leaflet-tile { filter: brightness(0.85) saturate(0.9); }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
  }).addTo(map);

  var marker = null;
  var icon = L.divIcon({
    html: '<div style="width:28px;height:28px;background:#E8521A;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    className: ''
  });

  function placeMarker(latlng) {
    if (marker) map.removeLayer(marker);
    marker = L.marker(latlng, { icon: icon }).addTo(map);
    window.ReactNativeWebView.postMessage(JSON.stringify({ lat: latlng.lat, lng: latlng.lng }));
  }

  map.on('click', function(e) { placeMarker(e.latlng); });

  // Place initial marker
  placeMarker(L.latLng(${lat}, ${lng}));
</script>
</body>
</html>`;

  return (
    <WebView
      ref={webviewRef}
      source={{ html }}
      style={{ flex: 1, backgroundColor: '#0F0A06' }}
      scrollEnabled={false}
      onMessage={(e) => {
        try {
          const { lat, lng } = JSON.parse(e.nativeEvent.data);
          onPin(lat, lng);
        } catch {}
      }}
    />
  );
}

export default function BecomeVendorScreen() {
  const { user, setUser } = useAuthStore();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pinCoords, setPinCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const [form, setForm] = useState<FormData>({
    business_name: '',
    category: '',
    description: '',
    address: '',
    use_current_location: false,
    phone: '',
    whatsapp: '',
    instagram: '',
    twitter: '',
    open_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    open_time: '08:00',
    close_time: '20:00',
    logo_uri: null,
    banner_uri: null,
  });

  const update = (key: keyof FormData, value: any) =>
    setForm(f => ({ ...f, [key]: value }));

  const goToStep = (s: number) => {
    Animated.spring(progressAnim, { toValue: s / (STEPS.length - 1), useNativeDriver: false }).start();
    setStep(s);
  };

  // When user taps "Use Current Location" — only tick once loading:false and address filled
  const handleUseCurrentLocation = () => {
    if (location.loading) {
      Alert.alert('Still loading', 'Your location is being fetched. Please wait a moment.');
      return;
    }
    if (location.error) {
      Alert.alert('Location error', location.error);
      return;
    }
    const newVal = !form.use_current_location;
    update('use_current_location', newVal);
    if (newVal && location.address) {
      update('address', location.address);
      if (location.lat && location.lng) {
        setPinCoords({ lat: location.lat, lng: location.lng });
      }
    }
  };

  const pickImage = async (type: 'logo' | 'banner') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to upload images.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      aspect: type === 'banner' ? [16, 9] : [1, 1],
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      update(type === 'logo' ? 'logo_uri' : 'banner_uri', result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string, path: string): Promise<string | null> => {
    try {
      return await uploadFile({
        bucket: 'vendor-images',
        path,
        uri,
        contentType: 'image/jpeg',
      });
    } catch { return null; }
  };

  const validateStep = (): string | null => {
    if (step === 0) {
      if (!form.business_name.trim()) return 'Enter your business name';
      if (!form.category) return 'Select a category';
      if (!form.description.trim()) return 'Add a short description';
    }
    if (step === 1) {
      if (!form.use_current_location && !form.address.trim()) return 'Enter your address or use current location';
    }
    if (step === 2) {
      if (!form.phone.trim()) return 'Enter a phone number';
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) { Alert.alert('Missing info', err); return; }
    if (step < STEPS.length - 1) goToStep(step + 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (!user?.id) throw new Error('Not logged in');

      // Upload images if provided
      let logoUrl: string | null = null;
      let bannerUrl: string | null = null;
      if (form.logo_uri) {
        logoUrl = await uploadImage(form.logo_uri, `${user.id}/logo_${Date.now()}.jpg`);
        if (!logoUrl) throw new Error('Failed to upload logo');
      }
      if (form.banner_uri) {
        bannerUrl = await uploadImage(form.banner_uri, `${user.id}/banner_${Date.now()}.jpg`);
        if (!bannerUrl) throw new Error('Failed to upload banner');
      }

      const vendorLat = form.use_current_location ? location.lat : (pinCoords?.lat ?? null);
      const vendorLng = form.use_current_location ? location.lng : (pinCoords?.lng ?? null);
      const vendorAddress = form.use_current_location ? location.address : form.address;

      // Create vendor via backend API
      const { data: vendor } = await apiFetch('/vendors', {
        method: 'POST',
        body: JSON.stringify({
          business_name: form.business_name.trim(),
          category: form.category,
          description: form.description.trim(),
          address: vendorAddress,
          lat: vendorLat ?? 6.5244,
          lng: vendorLng ?? 3.3792,
          phone: form.phone.trim(),
          whatsapp: form.whatsapp?.trim() || undefined,
          instagram: form.instagram?.trim() || undefined,
          twitter: form.twitter?.trim() || undefined,
          open_days: form.open_days,
          open_time: form.open_time,
          close_time: form.close_time,
          logo_url: logoUrl,
          banner_url: bannerUrl,
        }),
      });

      // Update user in auth store with is_vendor flag
      setUser({
        ...user,
        is_vendor: true,
      });

      Alert.alert(
        'Welcome to Vendr!',
        'Your vendor account has been created. Our team will verify your business within 24 hours.',
        [{ text: 'Go to Dashboard', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Location button state
  const locationReady = !location.loading && !location.error && !!location.address;

  return (
    <KeyboardAvoidingView className="flex-1 bg-dark" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />

      {/* Header */}
      <View className="px-5 pt-14 pb-4">
        <View className="flex-row items-center justify-between mb-5">
          <TouchableOpacity
            className="w-10 h-10 rounded-xl bg-dark-2 border border-faint items-center justify-center"
            onPress={() => step === 0 ? router.back() : goToStep(step - 1)}
          >
            <Ionicons name="arrow-back" size={20} color="#FDF6EC" />
          </TouchableOpacity>
          <Text className="text-muted text-sm">
            Step <Text className="text-cream" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>{step + 1}</Text> of {STEPS.length}
          </Text>
          <View className="w-10" />
        </View>

        <View className="h-1.5 bg-dark-3 rounded-full overflow-hidden mb-5">
          <Animated.View className="h-full bg-orange rounded-full" style={{ width: progressWidth }} />
        </View>

        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-xl bg-orange/20 border border-orange/30 items-center justify-center">
            <Ionicons name={STEPS[step].icon} size={20} color="#E8521A" />
          </View>
          <View>
            <Text className="text-cream text-xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>{STEPS[step].title}</Text>
            <Text className="text-muted text-sm">{STEPS[step].subtitle}</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Step 0: Business Info ── */}
        {step === 0 && (
          <View>
            {/* Logo + Banner pickers */}
            <View className="mb-5">
              <SectionLabel label="Store Banner (optional)" />
              <TouchableOpacity
                onPress={() => pickImage('banner')}
                activeOpacity={0.8}
                className="w-full h-32 bg-dark-2 border border-faint rounded-2xl overflow-hidden items-center justify-center mb-3"
              >
                {form.banner_uri ? (
                  <Image source={{ uri: form.banner_uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <View className="items-center gap-2">
                    <Ionicons name="image-outline" size={28} color="#3D3026" />
                    <Text className="text-muted text-xs">Tap to upload banner (16:9)</Text>
                  </View>
                )}
                <View style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 6 }}>
                  <Ionicons name="camera-outline" size={14} color="white" />
                </View>
              </TouchableOpacity>

              <SectionLabel label="Store Logo (optional)" />
              <View className="flex-row items-center gap-4">
                <TouchableOpacity
                  onPress={() => pickImage('logo')}
                  activeOpacity={0.8}
                  className="w-20 h-20 bg-dark-2 border border-faint rounded-2xl overflow-hidden items-center justify-center"
                >
                  {form.logo_uri ? (
                    <Image source={{ uri: form.logo_uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View className="items-center gap-1">
                      <Ionicons name="storefront-outline" size={24} color="#3D3026" />
                      <Text style={{ fontSize: 9, color: '#6B5E50', fontFamily: 'SpaceGrotesk_400Regular' }}>Logo</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View className="flex-1">
                  <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Store Logo</Text>
                  <Text className="text-muted text-xs mt-1">Square image, shown on your store card and profile. Tap to upload.</Text>
                </View>
              </View>
            </View>

            <InputField label="Business Name" value={form.business_name} onChangeText={t => update('business_name', t)} placeholder="e.g. Mama Temi's Kitchen" icon="storefront-outline" maxLength={60} />

            <View className="mb-4">
              <SectionLabel label="Category" />
              <View className="flex-row flex-wrap gap-2">
                {CATEGORIES.map(cat => {
                  const active = form.category === cat.label;
                  return (
                    <TouchableOpacity key={cat.label} onPress={() => update('category', cat.label)}
                      className={`flex-row items-center gap-2 px-3 py-2.5 rounded-2xl border ${active ? 'bg-orange border-orange' : 'bg-dark-2 border-faint'}`}
                    >
                      <Ionicons name={cat.icon} size={15} color={active ? 'white' : '#9A8570'} />
                      <Text className={active ? 'text-white text-sm' : 'text-muted text-sm'} style={{ fontFamily: active ? 'SpaceGrotesk_600SemiBold' : 'SpaceGrotesk_400Regular' }}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <InputField label="Description" value={form.description} onChangeText={t => update('description', t)} placeholder="Tell customers what you sell and what makes you special..." multiline icon="document-text-outline" maxLength={200} />
          </View>
        )}

        {/* ── Step 1: Location ── */}
        {step === 1 && (
          <View>
            {/* Use current location button */}
            <TouchableOpacity
              onPress={handleUseCurrentLocation}
              activeOpacity={0.8}
              className={`flex-row items-center gap-3 p-4 rounded-2xl border mb-5 ${
                form.use_current_location && locationReady ? 'bg-brand-green/10 border-brand-green/30' : 'bg-dark-2 border-faint'
              }`}
            >
              <View className={`w-10 h-10 rounded-xl items-center justify-center ${form.use_current_location && locationReady ? 'bg-brand-green/20' : 'bg-dark-3'}`}>
                {location.loading ? (
                  <ActivityIndicator size="small" color="#9A8570" />
                ) : (
                  <Ionicons name="navigate-outline" size={20} color={form.use_current_location && locationReady ? '#2D8653' : '#9A8570'} />
                )}
              </View>
              <View className="flex-1">
                <Text
                  className="text-sm"
                  style={{ fontFamily: 'SpaceGrotesk_600SemiBold', color: form.use_current_location && locationReady ? '#2D8653' : '#FDF6EC' }}
                >
                  {location.loading ? 'Fetching your location...' : 'Use Current Location'}
                </Text>
                <Text className="text-muted text-xs mt-0.5">
                  {location.loading
                    ? 'Please wait'
                    : form.use_current_location && location.address
                      ? location.address
                      : 'Tap to use your GPS location'}
                </Text>
              </View>
              {/* Only show tick when location is actually ready AND selected */}
              {form.use_current_location && locationReady && (
                <View className="w-5 h-5 rounded-full bg-brand-green border-2 border-brand-green items-center justify-center">
                  <Ionicons name="checkmark" size={12} color="white" />
                </View>
              )}
              {/* Show spinner in tick position while loading */}
              {location.loading && (
                <ActivityIndicator size="small" color="#6B5E50" />
              )}
            </TouchableOpacity>

            <View className="flex-row items-center gap-3 mb-5">
              <View className="flex-1 h-px bg-faint" />
              <Text className="text-subtle text-xs">or enter manually</Text>
              <View className="flex-1 h-px bg-faint" />
            </View>

            <InputField label="Street Address" value={form.address} onChangeText={t => { update('address', t); update('use_current_location', false); }} placeholder="e.g. 14 Allen Avenue, Ikeja, Lagos" icon="location-outline" />

            {/* Pick on Map button */}
            <View className="mb-4">
              <SectionLabel label="Pin Your Location" />
              <TouchableOpacity
                onPress={() => setShowMapPicker(true)}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  padding: 16, borderRadius: 16,
                  backgroundColor: pinCoords ? 'rgba(232,82,26,0.08)' : '#1A1208',
                  borderWidth: 1,
                  borderColor: pinCoords ? 'rgba(232,82,26,0.35)' : '#2A1F14',
                }}
              >
                <View style={{
                  width: 44, height: 44, borderRadius: 14,
                  backgroundColor: pinCoords ? 'rgba(232,82,26,0.15)' : '#2E2214',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="map-outline" size={22} color={pinCoords ? '#E8521A' : '#9A8570'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: pinCoords ? '#E8521A' : '#FDF6EC' }}>
                    {pinCoords ? 'Location pinned' : 'Pick on Map'}
                  </Text>
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50', marginTop: 2 }}>
                    {pinCoords
                      ? `${pinCoords.lat.toFixed(5)}, ${pinCoords.lng.toFixed(5)}`
                      : 'Open map and drop a pin at your exact location'}
                  </Text>
                </View>
                {pinCoords ? (
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#E8521A', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="checkmark" size={14} color="white" />
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color="#3D3026" />
                )}
              </TouchableOpacity>
              {pinCoords && (
                <TouchableOpacity onPress={() => setShowMapPicker(true)} style={{ marginTop: 8, alignSelf: 'flex-end' }}>
                  <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12, color: '#9A8570' }}>
                    Change pin
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Step 2: Contact ── */}
        {step === 2 && (
          <View>
            <InputField label="Phone Number" value={form.phone} onChangeText={t => update('phone', t)} placeholder="+234 800 000 0000" icon="call-outline" keyboardType="phone-pad" />
            <InputField label="WhatsApp (optional)" value={form.whatsapp} onChangeText={t => update('whatsapp', t)} placeholder="+234 800 000 0000" icon="logo-whatsapp" keyboardType="phone-pad" />
            <InputField label="Instagram (optional)" value={form.instagram} onChangeText={t => update('instagram', t)} placeholder="@yourbusiness" icon="logo-instagram" />
            <InputField label="Twitter / X (optional)" value={form.twitter} onChangeText={t => update('twitter', t)} placeholder="@yourbusiness" icon="logo-twitter" />
          </View>
        )}

        {/* ── Step 3: Opening Hours ── */}
        {step === 3 && (
          <View>
            <View className="mb-5">
              <SectionLabel label="Open Days" />
              <View className="flex-row flex-wrap gap-2">
                {DAYS.map(day => {
                  const active = form.open_days.includes(day);
                  return (
                    <TouchableOpacity key={day}
                      onPress={() => {
                        const days = active ? form.open_days.filter(d => d !== day) : [...form.open_days, day];
                        update('open_days', days);
                      }}
                      className={`w-12 h-12 rounded-xl items-center justify-center border ${active ? 'bg-orange border-orange' : 'bg-dark-2 border-faint'}`}
                    >
                      <Text className={active ? 'text-white text-xs' : 'text-muted text-xs'} style={{ fontFamily: active ? 'SpaceGrotesk_700Bold' : 'SpaceGrotesk_400Regular' }}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View className="flex-row gap-4">
              <TimeInput label="Opening Time" value={form.open_time} onChange={v => update('open_time', v)} icon="sunny-outline" />
              <TimeInput label="Closing Time" value={form.close_time} onChange={v => update('close_time', v)} icon="moon-outline" />
            </View>

            <View className="bg-dark-2 border border-faint rounded-2xl p-4 mt-2">
              <Text className="text-muted text-xs mb-2" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>PREVIEW</Text>
              <View className="flex-row items-center gap-2 mb-1">
                <Ionicons name="time-outline" size={14} color="#9A8570" />
                <Text className="text-cream text-sm">{form.open_time} – {form.close_time}</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Ionicons name="calendar-outline" size={14} color="#9A8570" />
                <Text className="text-cream text-sm">{form.open_days.join(', ') || 'No days selected'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Step 4: Review ── */}
        {step === 4 && (
          <View className="gap-3">
            {[
              { label: 'Business Name', value: form.business_name, icon: 'storefront-outline' as IoniconsName },
              { label: 'Category', value: form.category, icon: 'pricetag-outline' as IoniconsName },
              { label: 'Description', value: form.description, icon: 'document-text-outline' as IoniconsName },
              { label: 'Address', value: form.use_current_location ? (location.address ?? 'Current location') : form.address, icon: 'location-outline' as IoniconsName },
              { label: 'Phone', value: form.phone, icon: 'call-outline' as IoniconsName },
              { label: 'Hours', value: `${form.open_time} – ${form.close_time} (${form.open_days.join(', ')})`, icon: 'time-outline' as IoniconsName },
            ].map(row => (
              <View key={row.label} className="bg-dark-2 border border-faint rounded-2xl p-4 flex-row items-start gap-3">
                <View className="w-8 h-8 rounded-xl bg-dark-3 items-center justify-center mt-0.5">
                  <Ionicons name={row.icon} size={15} color="#9A8570" />
                </View>
                <View className="flex-1">
                  <Text className="text-muted text-xs mb-1" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>{row.label.toUpperCase()}</Text>
                  <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_500Medium' }}>{row.value || '—'}</Text>
                </View>
                <TouchableOpacity onPress={() => goToStep(
                  row.label === 'Business Name' || row.label === 'Category' || row.label === 'Description' ? 0
                  : row.label === 'Address' ? 1
                  : row.label === 'Phone' ? 2 : 3
                )}>
                  <Ionicons name="pencil-outline" size={16} color="#6B5E50" />
                </TouchableOpacity>
              </View>
            ))}

            {/* Image preview */}
            {(form.logo_uri || form.banner_uri) && (
              <View className="bg-dark-2 border border-faint rounded-2xl p-4 gap-3">
                <Text className="text-muted text-xs" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>STORE IMAGES</Text>
                <View className="flex-row gap-3">
                  {form.banner_uri && (
                    <Image source={{ uri: form.banner_uri }} style={{ flex: 1, height: 60, borderRadius: 12 }} resizeMode="cover" />
                  )}
                  {form.logo_uri && (
                    <Image source={{ uri: form.logo_uri }} style={{ width: 60, height: 60, borderRadius: 12 }} resizeMode="cover" />
                  )}
                </View>
              </View>
            )}

            <View className="bg-gold/10 border border-gold/30 rounded-2xl p-4 flex-row items-start gap-3 mt-2">
              <Ionicons name="information-circle-outline" size={20} color="#F5A623" />
              <Text className="text-muted text-sm flex-1 leading-relaxed">
                Your business will be reviewed by our team within{' '}
                <Text className="text-gold" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>24 hours</Text>
                {' '}before going live to customers.
              </Text>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Bottom CTA */}
      <View className="px-5 pb-10 pt-4 border-t border-faint bg-dark">
        {step < STEPS.length - 1 ? (
          <Button label="Continue" onPress={handleNext} iconRight="arrow-forward" />
        ) : (
          <Button label={loading ? 'Submitting...' : 'Launch My Business'} onPress={handleSubmit} loading={loading} iconRight="rocket-outline" />
        )}
      </View>
      {/* Fullscreen Map Picker Modal */}
      <Modal visible={showMapPicker} animationType="slide" statusBarTranslucent onRequestClose={() => setShowMapPicker(false)}>
        <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
          <StatusBar style="light" />

          {/* Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
            backgroundColor: '#0F0A06', borderBottomWidth: 1, borderBottomColor: '#2A1F14',
          }}>
            <TouchableOpacity
              onPress={() => setShowMapPicker(false)}
              style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={20} color="#FDF6EC" />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FDF6EC' }}>Pin Your Location</Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50', marginTop: 2 }}>Tap anywhere on the map to drop a pin</Text>
            </View>
            <View style={{ width: 38 }} />
          </View>

          {/* Map */}
          <View style={{ flex: 1 }}>
            <LeafletMap
              lat={pinCoords?.lat ?? location.lat ?? 6.5244}
              lng={pinCoords?.lng ?? location.lng ?? 3.3792}
              onPin={(lat, lng) => {
                setPinCoords({ lat, lng });
                update('use_current_location', false);
                import('expo-location').then(Loc => {
                  Loc.reverseGeocodeAsync({ latitude: lat, longitude: lng }).then(([place]) => {
                    if (place) {
                      const addr = [place.street, place.district, place.city].filter(Boolean).join(', ');
                      update('address', addr);
                    }
                  });
                });
              }}
            />
          </View>

          {/* Bottom action bar */}
          <View style={{
            padding: 20, paddingBottom: 36,
            backgroundColor: '#0F0A06', borderTopWidth: 1, borderTopColor: '#2A1F14',
          }}>
            {pinCoords ? (
              <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="location" size={14} color="#E8521A" />
                <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, color: '#9A8570', flex: 1 }} numberOfLines={1}>
                  {form.address || `${pinCoords.lat.toFixed(5)}, ${pinCoords.lng.toFixed(5)}`}
                </Text>
              </View>
            ) : (
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#6B5E50', textAlign: 'center', marginBottom: 12 }}>
                No pin dropped yet — tap on the map above
              </Text>
            )}
            <TouchableOpacity
              onPress={() => setShowMapPicker(false)}
              disabled={!pinCoords}
              style={{
                height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                backgroundColor: pinCoords ? '#E8521A' : '#2A1F14',
                shadowColor: '#E8521A', shadowOffset: { width: 0, height: 4 },
                shadowOpacity: pinCoords ? 0.3 : 0, shadowRadius: 10, elevation: pinCoords ? 6 : 0,
              }}
            >
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: pinCoords ? 'white' : '#6B5E50' }}>
                {pinCoords ? 'Confirm Location' : 'Drop a pin first'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}