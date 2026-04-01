import { useState } from 'react';
import {
  View, ScrollView, TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { TextInput } from 'react-native';
import { Button } from '../components/ui/Button';
import { uploadFile } from '../lib/storage';
import { useVendrAlert } from '../components/ui/VendrAlert';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export default function EditProfileScreen() {
  const { session, profile, setProfile } = useAuthStore();
  const { alert, alertElement } = useVendrAlert();

  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loading, setLoading] = useState(false);

  const initials = (name || profile?.name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission needed', 'Allow photo access to change your profile picture.', undefined, { type: 'warning' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadAvatar(result.assets[0].uri);
  };

  const takeAvatarPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission needed', 'Allow camera access to take a profile photo.', undefined, { type: 'warning' });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadAvatar(result.assets[0].uri);
  };

  const showAvatarOptions = () => {
    alert('Profile Photo', 'Choose how you want to update your photo', [
      { text: 'Take Photo', onPress: takeAvatarPhoto },
      { text: 'Choose from Gallery', onPress: pickAvatar },
      ...(avatarUri ? [{
        text: 'Remove Photo',
        style: 'destructive' as const,
        onPress: () => setAvatarUri(null),
      }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ], { type: 'question', icon: 'camera-outline' });
  };

  const uploadAvatar = async (uri: string) => {
    if (!session?.user?.id) return;
    setUploadingAvatar(true);
    try {
      const path = `${session.user.id}_${Date.now()}.jpg`;
      const publicUrl = await uploadFile({
        bucket: 'avatars',
        path,
        uri,
        contentType: 'image/jpeg',
      });

      const { data, error } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', session.user.id)
        .select('*')
        .single();

      if (error) throw error;
      setAvatarUri(publicUrl);
      setProfile(data);
    } catch (e: any) {
      alert('Upload failed', e.message ?? 'Could not upload photo', undefined, { type: 'danger' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Missing info', 'Please enter your name', undefined, { type: 'warning' });
      return;
    }
    if (!session?.user?.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('profiles')
      .update({ name: name.trim(), phone: phone.trim(), avatar_url: avatarUri })
      .eq('id', session.user.id)
      .select('*')
      .single();

    if (error) {
      alert('Error', error.message, undefined, { type: 'danger' });
      setLoading(false);
      return;
    }

    setProfile(data);
    alert('Saved!', 'Your profile has been updated.', [
      { text: 'OK', onPress: () => router.back() },
    ], { type: 'success' });
    setLoading(false);
  };

  return (
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />
      {alertElement}

      {/* Header */}
      <View className="flex-row items-center px-5 pt-14 pb-4 border-b border-faint gap-3">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>
        <Text className="text-cream text-xl flex-1" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading
            ? <ActivityIndicator size="small" color="#E8521A" />
            : <Text className="text-orange text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }} showsVerticalScrollIndicator={false}>

        {/* Avatar */}
        <View className="items-center gap-3">
          <TouchableOpacity onPress={showAvatarOptions} activeOpacity={0.8} style={{ position: 'relative' }}>
            {uploadingAvatar ? (
              <View className="w-24 h-24 rounded-3xl bg-orange/20 border border-orange/30 items-center justify-center">
                <ActivityIndicator size="large" color="#E8521A" />
              </View>
            ) : avatarUri ? (
              <Image source={{ uri: avatarUri }} style={{ width: 96, height: 96, borderRadius: 24 }} resizeMode="cover" />
            ) : (
              <View className="w-24 h-24 rounded-3xl bg-orange/20 border border-orange/30 items-center justify-center">
                <Text className="text-orange text-3xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>{initials}</Text>
              </View>
            )}
            <View style={{
              position: 'absolute', bottom: -6, right: -6,
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: '#E8521A', alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: '#0F0A06',
            }}>
              <Ionicons name="camera" size={13} color="white" />
            </View>
          </TouchableOpacity>
          <Text className="text-muted text-xs">Tap to change photo</Text>
        </View>

        {/* Fields */}
        <View className="gap-4">
          <View>
            <Text className="text-muted text-xs tracking-widest uppercase mb-2" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Full Name</Text>
            <TextInput
              value={name} onChangeText={setName}
              placeholder="Your full name" placeholderTextColor="#6B5E50"
              autoCapitalize="words"
              style={{ fontFamily: 'SpaceGrotesk_400Regular', color: '#FDF6EC', fontSize: 15, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#3D3026', borderRadius: 16, paddingHorizontal: 16, height: 56 }}
            />
          </View>
          <View>
            <Text className="text-muted text-xs tracking-widest uppercase mb-2" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Email</Text>
            <View className="bg-dark-2 border border-faint rounded-2xl px-4 h-14 justify-center opacity-50">
              <Text className="text-muted text-base">{session?.user?.email}</Text>
            </View>
            <Text className="text-muted text-xs mt-1.5 px-1">Email cannot be changed</Text>
          </View>
          <View>
            <Text className="text-muted text-xs tracking-widest uppercase mb-2" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Phone Number</Text>
            <TextInput
              value={phone} onChangeText={setPhone}
              placeholder="+234 800 000 0000" placeholderTextColor="#6B5E50"
              keyboardType="phone-pad"
              style={{ fontFamily: 'SpaceGrotesk_400Regular', color: '#FDF6EC', fontSize: 15, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#3D3026', borderRadius: 16, paddingHorizontal: 16, height: 56 }}
            />
          </View>
        </View>

        <Button label="Save Changes" onPress={handleSave} loading={loading} />
      </ScrollView>
    </View>
  );
}