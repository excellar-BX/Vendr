import { useState, useRef, useEffect } from 'react';
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

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const VEHICLE_TYPES = [
  { label: 'Bicycle', icon: 'bicycle-outline' as IoniconsName },
  { label: 'Motorcycle', icon: 'bicycle-outline' as IoniconsName },
  { label: 'Car', icon: 'car-outline' as IoniconsName },
  { label: 'Scooter', icon: 'bicycle-outline' as IoniconsName },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STEPS = [
  { title: 'Personal Info', subtitle: 'Tell us about yourself', icon: 'person-outline' as IoniconsName },
  { title: 'Vehicle Info', subtitle: 'What do you ride?', icon: 'bicycle-outline' as IoniconsName },
  { title: 'Location', subtitle: 'Where will you deliver?', icon: 'location-outline' as IoniconsName },
  { title: 'Availability', subtitle: 'When are you available?', icon: 'time-outline' as IoniconsName },
  { title: 'Review', subtitle: 'Almost there — review your info', icon: 'checkmark-circle-outline' as IoniconsName },
];

interface FormData {
  full_name: string;
  phone: string;
  email: string;
  vehicle_type: string;
  plate_number: string;
  vehicle_color: string;
  address: string;
  use_current_location: boolean;
  operating_radius: number;
  available_days: string[];
  start_time: string;
  end_time: string;
  profile_photo_uri: string | null;
  vehicle_photo_uri: string | null;
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

function TimeInput({ label, value, onChange, icon }: {
  label: string; value: string; onChange: (v: string) => void; icon: IoniconsName;
}) {
  const [show, setShow] = useState(false);
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

      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={toDate(value)}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={onPickerChange}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={show} transparent animationType="slide">
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
            activeOpacity={1}
            onPress={cancelIOS}
          />
          <View style={{ backgroundColor: '#1A1208', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#2A1F14' }}>
              <TouchableOpacity onPress={cancelIOS} style={{ padding: 4 }}>
                <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', color: '#9A8570', fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', color: '#FDF6EC', fontSize: 15 }}>{label}</Text>
              <TouchableOpacity onPress={confirmIOS} style={{ padding: 4 }}>
                <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', color: '#2D8653', fontSize: 15 }}>Done</Text>
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
    html: '<div style="width:28px;height:28px;background:#2D8653;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>',
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
  placeMarker(L.latLng(${lat}, ${lng}));
</script>
</body>
</html>
  `;

  return (
    <View className="h-48 rounded-2xl overflow-hidden mb-4">
      <WebView
        ref={webviewRef}
        source={{ html }}
        onMessage={(event) => {
          const data = JSON.parse(event.nativeEvent.data);
          onPin(data.lat, data.lng);
        }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        scalesPageToFit={false}
      />
    </View>
  );
}

function PhotoUpload({ label, uri, onChange }: {
  label: string; uri: string | null; onChange: (uri: string | null) => void;
}) {
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      onChange(result.assets[0].uri);
    }
  };

  return (
    <View className="mb-4">
      <SectionLabel label={label} />
      <TouchableOpacity
        onPress={pickImage}
        activeOpacity={0.8}
        className="bg-dark-2 border border-faint rounded-2xl p-4 items-center justify-center h-32"
      >
        {uri ? (
          <Image source={{ uri }} className="w-full h-full rounded-xl" resizeMode="cover" />
        ) : (
          <View className="items-center">
            <Ionicons name="camera-outline" size={32} color="#6B5E50" />
            <Text className="text-muted text-xs mt-2">Tap to upload</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function BecomeRunnerScreen() {
  const { user, setUser } = useAuthStore();
  const { lat, lng, address } = useLocation();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    vehicle_type: '',
    plate_number: '',
    vehicle_color: '',
    address: address || '',
    use_current_location: true,
    operating_radius: 5,
    available_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    start_time: '08:00',
    end_time: '18:00',
    profile_photo_uri: user?.avatar_url || null,
    vehicle_photo_uri: null,
  });

  const [mapLat, setMapLat] = useState(lat || 6.5244);
  const [mapLng, setMapLng] = useState(lng || 3.3792);

  const updateField = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      available_days: prev.available_days.includes(day)
        ? prev.available_days.filter(d => d !== day)
        : [...prev.available_days, day],
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // TODO: Upload photos and submit to API
      // const profilePhotoUrl = formData.profile_photo_uri ? await uploadFile(formData.profile_photo_uri) : null;
      // const vehiclePhotoUrl = formData.vehicle_photo_uri ? await uploadFile(formData.vehicle_photo_uri) : null;
      
      // await apiFetch('/runner/register', {
      //   method: 'POST',
      //   body: JSON.stringify({
      //     ...formData,
      //     profile_photo: profilePhotoUrl,
      //     vehicle_photo: vehiclePhotoUrl,
      //   }),
      // });

      // Update user as runner
      setUser({ ...user, is_runner: true });

      Alert.alert('Success!', 'Your runner account has been created.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/profile') },
      ]);
    } catch (err) {
      Alert.alert('Error', 'Failed to create runner account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0: // Personal Info
        return (
          <View>
            <PhotoUpload
              label="Profile Photo"
              uri={formData.profile_photo_uri}
              onChange={(uri) => updateField('profile_photo_uri', uri)}
            />
            <InputField
              label="Full Name"
              value={formData.full_name}
              onChangeText={(v) => updateField('full_name', v)}
              placeholder="Enter your full name"
              icon="person-outline"
            />
            <InputField
              label="Phone Number"
              value={formData.phone}
              onChangeText={(v) => updateField('phone', v)}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
              icon="call-outline"
            />
            <InputField
              label="Email"
              value={formData.email}
              onChangeText={(v) => updateField('email', v)}
              placeholder="Enter email address"
              keyboardType="email-address"
              icon="mail-outline"
            />
          </View>
        );

      case 1: // Vehicle Info
        return (
          <View>
            <SectionLabel label="Vehicle Type" />
            <View className="flex-row flex-wrap gap-2 mb-4">
              {VEHICLE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.label}
                  onPress={() => updateField('vehicle_type', type.label)}
                  activeOpacity={0.8}
                  className={`flex-1 min-w-[45%] bg-dark-2 border rounded-2xl p-3 items-center ${
                    formData.vehicle_type === type.label ? 'border-green-500 bg-green-500/10' : 'border-faint'
                  }`}
                >
                  <Ionicons name={type.icon} size={24} color={formData.vehicle_type === type.label ? '#2D8653' : '#6B5E50'} />
                  <Text
                    className={`text-xs mt-2 ${formData.vehicle_type === type.label ? 'text-green-500' : 'text-muted'}`}
                    style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <PhotoUpload
              label="Vehicle Photo"
              uri={formData.vehicle_photo_uri}
              onChange={(uri) => updateField('vehicle_photo_uri', uri)}
            />
            <InputField
              label="Plate Number"
              value={formData.plate_number}
              onChangeText={(v) => updateField('plate_number', v.toUpperCase())}
              placeholder="ABC 123 XYZ"
              icon="document-text-outline"
            />
            <InputField
              label="Vehicle Color"
              value={formData.vehicle_color}
              onChangeText={(v) => updateField('vehicle_color', v)}
              placeholder="e.g., Red, Black"
              icon="color-palette-outline"
            />
          </View>
        );

      case 2: // Location
        return (
          <View>
            <SectionLabel label="Operating Location" />
            <LeafletMap
              lat={mapLat}
              lng={mapLng}
              onPin={(lat, lng) => {
                setMapLat(lat);
                setMapLng(lng);
              }}
            />
            <TouchableOpacity
              onPress={() => {
                if (lat && lng) {
                  setMapLat(lat);
                  setMapLng(lng);
                  updateField('address', address || '');
                }
              }}
              className="flex-row items-center gap-2 mb-4"
            >
              <Ionicons name="location-outline" size={16} color="#2D8653" />
              <Text className="text-green-500 text-xs" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
                Use current location
              </Text>
            </TouchableOpacity>
            <InputField
              label="Address"
              value={formData.address}
              onChangeText={(v) => updateField('address', v)}
              placeholder="Enter your address"
              icon="location-outline"
            />
            <SectionLabel label="Operating Radius (km)" />
            <View className="flex-row items-center gap-4 bg-dark-2 border border-faint rounded-2xl px-4 h-14">
              <Ionicons name="resize-outline" size={18} color="#6B5E50" />
              <Text className="text-cream text-base flex-1">{formData.operating_radius} km</Text>
              <View className="flex-row gap-2">
                {[3, 5, 10, 15].map((radius) => (
                  <TouchableOpacity
                    key={radius}
                    onPress={() => updateField('operating_radius', radius)}
                    className={`px-3 py-1 rounded-lg ${
                      formData.operating_radius === radius ? 'bg-green-500/20' : 'bg-dark-3'
                    }`}
                  >
                    <Text
                      className={`text-xs ${formData.operating_radius === radius ? 'text-green-500' : 'text-muted'}`}
                      style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}
                    >
                      {radius}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        );

      case 3: // Availability
        return (
          <View>
            <SectionLabel label="Available Days" />
            <View className="flex-row flex-wrap gap-2 mb-4">
              {DAYS.map((day) => (
                <TouchableOpacity
                  key={day}
                  onPress={() => toggleDay(day)}
                  activeOpacity={0.8}
                  className={`flex-1 min-w-[13%] bg-dark-2 border rounded-xl py-2.5 items-center ${
                    formData.available_days.includes(day) ? 'border-green-500 bg-green-500/10' : 'border-faint'
                  }`}
                >
                  <Text
                    className={`text-xs ${formData.available_days.includes(day) ? 'text-green-500' : 'text-muted'}`}
                    style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TimeInput
              label="Start Time"
              value={formData.start_time}
              onChange={(v) => updateField('start_time', v)}
              icon="time-outline"
            />
            <TimeInput
              label="End Time"
              value={formData.end_time}
              onChange={(v) => updateField('end_time', v)}
              icon="time-outline"
            />
          </View>
        );

      case 4: // Review
        return (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="bg-dark-2 border border-faint rounded-2xl p-4 mb-4">
              <Text className="text-green-500 text-sm mb-3" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
                Personal Info
              </Text>
              <View className="space-y-2">
                <Text className="text-cream text-sm">{formData.full_name}</Text>
                <Text className="text-muted text-xs">{formData.phone}</Text>
                <Text className="text-muted text-xs">{formData.email}</Text>
              </View>
            </View>

            <View className="bg-dark-2 border border-faint rounded-2xl p-4 mb-4">
              <Text className="text-green-500 text-sm mb-3" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
                Vehicle Info
              </Text>
              <View className="space-y-2">
                <Text className="text-cream text-sm">{formData.vehicle_type}</Text>
                <Text className="text-muted text-xs">{formData.plate_number}</Text>
                <Text className="text-muted text-xs">{formData.vehicle_color}</Text>
              </View>
            </View>

            <View className="bg-dark-2 border border-faint rounded-2xl p-4 mb-4">
              <Text className="text-green-500 text-sm mb-3" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
                Location
              </Text>
              <View className="space-y-2">
                <Text className="text-cream text-sm">{formData.address}</Text>
                <Text className="text-muted text-xs">Radius: {formData.operating_radius} km</Text>
              </View>
            </View>

            <View className="bg-dark-2 border border-faint rounded-2xl p-4 mb-4">
              <Text className="text-green-500 text-sm mb-3" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
                Availability
              </Text>
              <View className="space-y-2">
                <Text className="text-cream text-sm">{formData.available_days.join(', ')}</Text>
                <Text className="text-muted text-xs">{formData.start_time} - {formData.end_time}</Text>
              </View>
            </View>
          </ScrollView>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return formData.full_name && formData.phone && formData.email;
      case 1:
        return formData.vehicle_type && formData.plate_number && formData.vehicle_color;
      case 2:
        return formData.address;
      case 3:
        return formData.available_days.length > 0 && formData.start_time && formData.end_time;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-dark"
    >
      <StatusBar style="light" />
      <View className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-green-500 opacity-[0.06]" />

      {/* Header */}
      <View className="px-5 pt-14 pb-4">
        <View className="flex-row items-center gap-3 mb-4">
          {step > 0 && (
            <TouchableOpacity onPress={() => setStep(step - 1)} className="w-10 h-10 bg-dark-2 border border-faint rounded-xl items-center justify-center">
              <Ionicons name="chevron-back" size={20} color="#FDF6EC" />
            </TouchableOpacity>
          )}
          <View className="flex-1">
            <Text className="text-cream text-xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
              {STEPS[step].title}
            </Text>
            <Text className="text-muted text-xs">{STEPS[step].subtitle}</Text>
          </View>
        </View>

        {/* Progress */}
        <View className="flex-row gap-2">
          {STEPS.map((_, index) => (
            <View
              key={index}
              className={`flex-1 h-1 rounded-full ${
                index <= step ? 'bg-green-500' : 'bg-dark-3'
              }`}
            />
          ))}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
      >
        {renderStep()}
      </ScrollView>

      {/* Bottom Action */}
      <View className="absolute bottom-0 left-0 right-0 bg-dark border-t border-faint p-5">
        {step === STEPS.length - 1 ? (
          <Button
            label="Submit Application"
            onPress={handleSubmit}
            disabled={loading}
            loading={loading}
            variant="primary"
            size="lg"
          />
        ) : (
          <Button
            label="Continue"
            onPress={() => setStep(step + 1)}
            disabled={!canProceed()}
            variant="primary"
            size="lg"
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
