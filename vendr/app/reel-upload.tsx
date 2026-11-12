import { useState, useEffect, useRef } from 'react';
import {
  View, ScrollView, TouchableOpacity, Image, FlatList, ActivityIndicator,
  TextInput as RNTextInput, useWindowDimensions, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Text } from '../components/ui/StyledText';
import { useVendrAlert } from '../components/ui/VendrAlert';
import { reelFeedSignal } from '../components/reel/ReelViewer';
import { useAuthStore } from '../stores/authStore';
import { formatPrice } from '../lib/utils';
import { reelApi, storageApi, vendorApi, productApi } from '../lib/api';
import { CaptionEditor } from '../components/reel/CaptionEditor';
import { T, useTheme } from '../constants/theme';

const MAX_PHOTOS = 10;
const MAX_VIDEO_SECONDS = 30;
const MAX_VIDEO_MB = 30;
const MAX_CAPTION = 300;

type Mode = 'photo' | 'video';
type Stage = 'choose' | 'compose' | 'uploading' | 'done';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  vendor_id: string;
  store_name: string;
}

interface Store {
  id: string;
  name: string;
  logo_url: string | null;
}

interface Photo {
  uri: string;
  width?: number;
  height?: number;
}

// Upload a local file to R2 through a pre-signed URL
async function uploadFile(
  uri: string,
  key: string,
  mimeType: string,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const { data: { uploadUrl, publicUrl } } = await storageApi.signUpload(key, mimeType);
  // Streams the file from disk (no base64 copy in memory) and reports real bytes sent
  const task = FileSystem.createUploadTask(
    uploadUrl,
    uri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': mimeType },
    },
    ({ totalBytesSent, totalBytesExpectedToSend }) => {
      if (totalBytesExpectedToSend > 0) onProgress?.(Math.min(1, totalBytesSent / totalBytesExpectedToSend));
    },
  );
  const res = await task.uploadAsync();
  if (!res || res.status < 200 || res.status >= 300) {
    throw { statusCode: res?.status ?? 0, message: `Upload failed (${res?.status ?? 'network'})` };
  }
  onProgress?.(1);
  return publicUrl;
}

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} />;
}

export default function ReelUploadScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const { width: SW } = useWindowDimensions();
  const { user } = useAuthStore();
  const { showAlert, alertElement } = useVendrAlert();

  const [vendorState, setVendorState] = useState<'loading' | 'vendor' | 'not-vendor' | 'error'>('loading');
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('choose');
  const [mode, setMode] = useState<Mode>('photo');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [video, setVideo] = useState<{ uri: string; seconds: number } | null>(null);
  const [caption, setCaption] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [progress, setProgress] = useState({ pct: 0, label: '' });
  const previewRef = useRef<FlatList<Photo>>(null);

  const previewW = SW - 40;
  const previewH = Math.round(previewW * 1.25); // 4:5, the classic product-photo frame

  // Only vendors can post. A user can run several stores — load all of them and
  // every store's products, so any of *your* products can be tagged.
  const loadVendor = async () => {
    setVendorState('loading');
    try {
      const { data } = await vendorApi.getMyStores();
      const mine: Store[] = (data ?? []).map((v: any) => ({ id: v.id, name: v.shop_name || v.business_name || 'My store', logo_url: v.logo_url ?? null }));
      if (mine.length === 0) { setVendorState('not-vendor'); return; }
      setStores(mine);
      setStoreId((cur) => cur ?? mine[0].id);
      setVendorState('vendor');
      const lists = await Promise.all(mine.map((st) =>
        productApi.getProducts(st.id)
          .then(({ data: ps }: any) => (ps ?? []).map((p: any) => ({
            id: p.id, name: p.name, price: p.price, image_url: p.image_url, vendor_id: st.id, store_name: st.name,
          })))
          .catch(() => [] as Product[])
      ));
      setProducts(lists.flat());
    } catch (e: any) {
      setVendorState(e?.statusCode === 404 ? 'not-vendor' : 'error');
    }
  };
  useEffect(() => { if (user?.id) loadVendor(); }, [user?.id]);

  // ── Picking ───────────────────────────────────────────────────────────────
  const ensureLibraryPermission = async () => {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!res.granted) {
      showAlert({ title: 'Permission needed', message: 'Allow access to your photos to create a post.', type: 'warning' });
      return false;
    }
    return true;
  };

  const pickPhotos = async () => {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      showAlert({ title: 'That’s the max', message: `A post can have up to ${MAX_PHOTOS} photos.`, type: 'warning' });
      return;
    }
    if (!(await ensureLibraryPermission())) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      orderedSelection: true,
      selectionLimit: room,
      quality: 0.75,
    });
    if (result.canceled || !result.assets?.length) return;
    const added = result.assets.slice(0, room).map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
    setPhotos((prev) => [...prev, ...added]);
    setMode('photo');
    setStage('compose');
  };

  const takePhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showAlert({ title: 'Permission needed', message: 'Allow camera access to take photos.', type: 'warning' });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    setPhotos((prev) => [...prev, { uri: a.uri, width: a.width, height: a.height }]);
    setMode('photo');
    setStage('compose');
  };

  const pickVideo = async () => {
    if (!(await ensureLibraryPermission())) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      videoMaxDuration: MAX_VIDEO_SECONDS,
      quality: 0.6,
      // iOS: export at 720p — much smaller uploads on mobile data
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const seconds = (asset.duration ?? 0) / 1000;
    if (seconds > MAX_VIDEO_SECONDS + 1) {
      showAlert({ title: 'Too long', message: `Videos can be up to ${MAX_VIDEO_SECONDS} seconds. Trim it and try again.`, type: 'warning' });
      return;
    }
    const mb = (asset.fileSize ?? 0) / (1024 * 1024);
    if (mb > MAX_VIDEO_MB) {
      showAlert({ title: 'Video too large', message: `This video is ${mb.toFixed(0)}MB (max ${MAX_VIDEO_MB}MB). Try a shorter clip.`, type: 'warning' });
      return;
    }
    setVideo({ uri: asset.uri, seconds: Math.round(seconds) });
    setMode('video');
    setStage('compose');
  };

  // ── Arranging photos ──────────────────────────────────────────────────────
  const move = (from: number, to: number) => {
    if (to < 0 || to >= photos.length) return;
    Haptics.selectionAsync().catch(() => {});
    setPhotos((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setPreviewIndex(to);
    previewRef.current?.scrollToOffset({ offset: to * previewW, animated: true });
  };

  const removePhoto = (i: number) => {
    setPhotos((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      if (next.length === 0) setStage('choose');
      return next;
    });
    setPreviewIndex((p) => Math.max(0, Math.min(p, photos.length - 2)));
  };

  const resetAll = () => {
    setStage('choose');
    setPhotos([]);
    setVideo(null);
    setCaption('');
    setSelectedProduct(null);
    setPreviewIndex(0);
  };

  // ── Posting ───────────────────────────────────────────────────────────────
  const canPost = mode === 'photo' ? photos.length > 0 : !!video;

  const post = async () => {
    if (!user?.id || !canPost) return;
    setStage('uploading');
    const stamp = Date.now();
    try {
      if (mode === 'photo') {
        const urls: string[] = [];
        for (let i = 0; i < photos.length; i++) {
          const label = `Uploading photo ${i + 1} of ${photos.length}`;
          setProgress({ pct: Math.round((i / photos.length) * 92), label });
          urls.push(await uploadFile(photos[i].uri, `reels/${user.id}/${stamp}_${i}.jpg`, 'image/jpeg', (f) =>
            setProgress({ pct: Math.round(((i + f) / photos.length) * 92), label })
          ));
        }
        setProgress({ pct: 96, label: 'Publishing…' });
        await reelApi.createReel({
          media_type: 'photo',
          vendor_id: selectedProduct?.vendor_id ?? storeId,
          image_urls: urls,
          thumbnail_url: urls[0],
          caption: caption.trim() || null,
          product_id: selectedProduct?.id ?? null,
        });
      } else if (video) {
        setProgress({ pct: 2, label: 'Uploading video' });
        const videoUrl = await uploadFile(video.uri, `reels/${user.id}/${stamp}_reel.mp4`, 'video/mp4', (f) =>
          setProgress({ pct: 2 + Math.round(f * 78), label: `Uploading video · ${Math.round(f * 100)}%` })
        );
        setProgress({ pct: 80, label: 'Creating cover' });
        let thumbnailUrl: string | null = null;
        try {
          const { uri } = await VideoThumbnails.getThumbnailAsync(video.uri, { time: 800, quality: 0.7 });
          thumbnailUrl = await uploadFile(uri, `reels/${user.id}/${stamp}_thumb.jpg`, 'image/jpeg');
        } catch { /* cover is optional */ }
        setProgress({ pct: 95, label: 'Publishing…' });
        await reelApi.createReel({
          media_type: 'video',
          vendor_id: selectedProduct?.vendor_id ?? storeId,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          caption: caption.trim() || null,
          product_id: selectedProduct?.id ?? null,
        });
      }
      setProgress({ pct: 100, label: 'Done' });
      reelFeedSignal.dirty = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStage('done');
    } catch (e: any) {
      setStage('compose');
      showAlert({
        title: 'Couldn’t post',
        message: e?.statusCode ? (e?.message ?? 'Please try again.') : 'Check your connection and try again.',
        type: 'danger',
      });
    }
  };

  // ── Shared header ─────────────────────────────────────────────────────────
  const Header = ({ title, onBack, icon = 'close' }: { title: string; onBack: () => void; icon?: 'close' | 'arrow-back' }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 12, gap: 12 }}>
      <TouchableOpacity onPress={onBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color={T.ink} />
      </TouchableOpacity>
      <Text style={{ flex: 1, fontSize: 19, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>{title}</Text>
    </View>
  );

  // ── Gates ─────────────────────────────────────────────────────────────────
  if (vendorState !== 'vendor') {
    return (
      <View style={{ flex: 1, backgroundColor: T.canvas }}>
        <StatusBar style={T.statusBar} />
        <Header title="New post" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 12 }}>
          {vendorState === 'loading' ? <ActivityIndicator color={T.primary} /> : vendorState === 'error' ? (
            <>
              <Ionicons name="cloud-offline-outline" size={40} color={T.ink4} />
              <Text style={{ fontSize: 16, color: T.ink, textAlign: 'center' }}>Couldn’t check your store. Check your connection.</Text>
              <TouchableOpacity onPress={loadVendor} style={{ backgroundColor: T.primary, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 }}>
                <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: T.onPrimary }}>Retry</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={{ width: 80, height: 80, borderRadius: 26, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="storefront-outline" size={36} color={T.primary} />
              </View>
              <Text style={{ fontSize: 19, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink, textAlign: 'center' }}>Posts are for vendors</Text>
              <Text style={{ fontSize: 14, color: T.ink3, textAlign: 'center', lineHeight: 20 }}>Open a store to share videos and photo posts of what you sell.</Text>
              <TouchableOpacity onPress={() => router.replace('/become-vendor')} style={{ marginTop: 6, backgroundColor: T.primary, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 }}>
                <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: T.onPrimary }}>Become a vendor</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        {alertElement}
      </View>
    );
  }

  // ── Choose ────────────────────────────────────────────────────────────────
  if (stage === 'choose') {
    const Card = ({ icon, title, sub, onPress, accent }: { icon: any; title: string; sub: string; onPress: () => void; accent: string }) => (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, borderRadius: 22, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line }}>
        <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: `${accent}1F`, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={28} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16.5, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>{title}</Text>
          <Text style={{ fontSize: 13, color: T.ink3, marginTop: 2, lineHeight: 18 }}>{sub}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={T.ink4} />
      </TouchableOpacity>
    );
    return (
      <View style={{ flex: 1, backgroundColor: T.canvas }}>
        <StatusBar style={T.statusBar} />
        <Header title="New post" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
          <Text style={{ fontSize: 14, color: T.ink3, marginBottom: 4, lineHeight: 20 }}>
            Show off what you sell. Buyers can like, save and chat to buy right from your post.
          </Text>
          <Card icon="images" accent="#E8521A" title="Photo post" sub={`Up to ${MAX_PHOTOS} photos people swipe through`} onPress={pickPhotos} />
          <Card icon="camera" accent="#2563EB" title="Take photos" sub="Shoot with your camera, add more after" onPress={takePhoto} />
          <Card icon="videocam" accent="#2D8653" title="Video" sub={`A short clip, up to ${MAX_VIDEO_SECONDS} seconds`} onPress={pickVideo} />
        </ScrollView>
        {alertElement}
      </View>
    );
  }

  // ── Uploading ─────────────────────────────────────────────────────────────
  if (stage === 'uploading') {
    return (
      <View style={{ flex: 1, backgroundColor: T.canvas, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 40 }}>
        <StatusBar style={T.statusBar} />
        <View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={T.primary} />
        </View>
        <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>Posting…</Text>
        <Text style={{ fontSize: 14, color: T.ink3, textAlign: 'center' }}>{progress.label}</Text>
        <View style={{ width: '100%', height: 6, borderRadius: 3, backgroundColor: T.surface2, overflow: 'hidden' }}>
          <View style={{ height: '100%', borderRadius: 3, backgroundColor: T.primary, width: `${progress.pct}%` }} />
        </View>
        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.ink2 }}>{progress.pct}%</Text>
        <Text style={{ fontSize: 12, color: T.ink4, textAlign: 'center' }}>Keep the app open until it finishes.</Text>
      </View>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (stage === 'done') {
    return (
      <View style={{ flex: 1, backgroundColor: T.canvas, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 36 }}>
        <StatusBar style={T.statusBar} />
        <View style={{ width: 88, height: 88, borderRadius: 30, backgroundColor: T.successSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark-circle" size={50} color={T.success} />
        </View>
        <Text style={{ fontSize: 22, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>You’re live!</Text>
        <Text style={{ fontSize: 14, color: T.ink3, textAlign: 'center', lineHeight: 20 }}>Your post is now in the Reels feed and on your store page.</Text>
        <View style={{ flexDirection: 'row', gap: 12, width: '100%', marginTop: 10 }}>
          <TouchableOpacity onPress={resetAll} style={{ flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: T.surface, borderWidth: 1, borderColor: T.line }}>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.ink2 }}>Post another</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/reels')} style={{ flex: 1.4, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: T.primary }}>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: T.onPrimary }}>See it in Reels</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Compose ───────────────────────────────────────────────────────────────
  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(productSearch.trim().toLowerCase()));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style={T.statusBar} />
      <Header title={mode === 'photo' ? 'Photo post' : 'Video post'} icon="arrow-back" onBack={resetAll} />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 110 }}>
        {/* Preview */}
        {mode === 'photo' ? (
          <>
            <View style={{ width: previewW, height: previewH, borderRadius: 22, overflow: 'hidden', backgroundColor: '#000' }}>
              <FlatList
                ref={previewRef}
                data={photos}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(p, i) => `${i}-${p.uri}`}
                onMomentumScrollEnd={(e) => setPreviewIndex(Math.round(e.nativeEvent.contentOffset.x / previewW))}
                getItemLayout={(_, i) => ({ length: previewW, offset: previewW * i, index: i })}
                renderItem={({ item }) => (
                  <View style={{ width: previewW, height: previewH }}>
                    <Image source={{ uri: item.uri }} style={{ position: 'absolute', width: previewW, height: previewH }} blurRadius={24} resizeMode="cover" />
                    <View style={{ position: 'absolute', width: previewW, height: previewH, backgroundColor: 'rgba(0,0,0,0.3)' }} />
                    <Image source={{ uri: item.uri }} style={{ width: previewW, height: previewH }} resizeMode="contain" />
                  </View>
                )}
              />
              <View pointerEvents="none" style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>{Math.min(previewIndex + 1, photos.length)}/{photos.length}</Text>
              </View>
              {photos.length > 1 && (
                <View pointerEvents="none" style={{ position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
                  {photos.map((_, i) => (
                    <View key={i} style={{ width: i === previewIndex ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === previewIndex ? '#FFFFFF' : 'rgba(255,255,255,0.5)' }} />
                  ))}
                </View>
              )}
            </View>

            {/* Arrange strip */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink3, letterSpacing: 1 }}>PHOTOS · {photos.length}/{MAX_PHOTOS}</Text>
              <Text style={{ fontSize: 12, color: T.ink4 }}>First photo is the cover</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
              {photos.map((p, i) => (
                <View key={`${i}-${p.uri}`} style={{ width: 84 }}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => { setPreviewIndex(i); previewRef.current?.scrollToOffset({ offset: i * previewW, animated: true }); }}
                    style={{ width: 84, height: 105, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: i === previewIndex ? T.primary : 'transparent' }}
                  >
                    <Image source={{ uri: p.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    {i === 0 && (
                      <View style={{ position: 'absolute', left: 5, bottom: 5, backgroundColor: T.primary, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
                        <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>COVER</Text>
                      </View>
                    )}
                    <TouchableOpacity onPress={() => removePhoto(i)} hitSlop={8} style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="close" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <TouchableOpacity onPress={() => move(i, i - 1)} disabled={i === 0} hitSlop={6} style={{ opacity: i === 0 ? 0.25 : 1, padding: 2 }}>
                      <Ionicons name="chevron-back" size={18} color={T.ink2} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => move(i, i + 1)} disabled={i === photos.length - 1} hitSlop={6} style={{ opacity: i === photos.length - 1 ? 0.25 : 1, padding: 2 }}>
                      <Ionicons name="chevron-forward" size={18} color={T.ink2} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <View style={{ gap: 8 }}>
                  <TouchableOpacity onPress={pickPhotos} style={{ width: 84, height: 48, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: T.lineStrong, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}>
                    <Ionicons name="images-outline" size={16} color={T.ink2} />
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.ink2 }}>Add</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={takePhoto} style={{ width: 84, height: 48, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: T.lineStrong, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}>
                    <Ionicons name="camera-outline" size={16} color={T.ink2} />
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.ink2 }}>Shoot</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </>
        ) : video ? (
          <View style={{ width: previewW, aspectRatio: 9 / 16, maxHeight: previewH + 80, alignSelf: 'center', borderRadius: 22, overflow: 'hidden', backgroundColor: '#000' }}>
            <VideoPreview uri={video.uri} />
            <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>{video.seconds}s</Text>
            </View>
            <TouchableOpacity onPress={pickVideo} style={{ position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="swap-horizontal" size={14} color="#FFFFFF" />
              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#FFFFFF' }}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Post as (only when the user runs more than one store) */}
        {stores.length > 1 && (
          <>
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink3, letterSpacing: 1, marginTop: 22, marginBottom: 8 }}>POST AS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {stores.map((st) => {
                const active = (selectedProduct?.vendor_id ?? storeId) === st.id;
                const locked = !!selectedProduct && selectedProduct.vendor_id !== st.id;
                return (
                  <TouchableOpacity
                    key={st.id}
                    disabled={locked}
                    onPress={() => setStoreId(st.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6, paddingRight: 14, height: 40, borderRadius: 20, borderWidth: 1.5, opacity: locked ? 0.4 : 1, borderColor: active ? T.primary : T.line, backgroundColor: active ? T.primarySoft : T.surface }}
                  >
                    {st.logo_url
                      ? <Image source={{ uri: st.logo_url }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                      : <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: T.surface2, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="storefront" size={14} color={T.ink3} /></View>}
                    <Text style={{ fontSize: 13.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: active ? T.primaryInk : T.ink2 }}>{st.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {!!selectedProduct && (
              <Text style={{ fontSize: 12, color: T.ink4, marginTop: 6 }}>Posting to {selectedProduct.store_name} because you tagged one of its products.</Text>
            )}
          </>
        )}

        {/* Caption (with hashtag help) */}
        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink3, letterSpacing: 1, marginTop: 22, marginBottom: 8 }}>CAPTION</Text>
        <CaptionEditor value={caption} onChange={setCaption} maxLength={MAX_CAPTION} />

        {/* Product tag (optional) */}
        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink3, letterSpacing: 1, marginTop: 14, marginBottom: 4 }}>TAG A PRODUCT</Text>
        <Text style={{ fontSize: 12.5, color: T.ink4, marginBottom: 10 }}>Optional — adds a “Chat to buy” button to your post.</Text>

        {selectedProduct ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: T.primarySoft, borderWidth: 1, borderColor: T.primaryBorder }}>
            {selectedProduct.image_url
              ? <Image source={{ uri: selectedProduct.image_url }} style={{ width: 46, height: 46, borderRadius: 11 }} />
              : <View style={{ width: 46, height: 46, borderRadius: 11, backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="cube-outline" size={20} color={T.ink4} /></View>}
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.ink }}>{selectedProduct.name}</Text>
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: T.primaryInk }}>{formatPrice(selectedProduct.price)}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedProduct(null)} hitSlop={10}>
              <Ionicons name="close-circle" size={22} color={T.ink3} />
            </TouchableOpacity>
          </View>
        ) : products.length === 0 ? (
          <View style={{ padding: 14, borderRadius: 14, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Ionicons name="cube-outline" size={20} color={T.ink4} />
            <Text style={{ flex: 1, fontSize: 13, color: T.ink3 }}>No products in your store yet — you can still post.</Text>
          </View>
        ) : (
          <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 16, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line }}>
              <Ionicons name="search-outline" size={16} color={T.ink3} />
              <RNTextInput
                value={productSearch}
                onChangeText={setProductSearch}
                placeholder={`Search ${products.length} product${products.length === 1 ? '' : 's'}`}
                placeholderTextColor={T.ink4}
                style={{ flex: 1, color: T.ink, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13.5, paddingVertical: 0 }}
              />
            </View>
            {filteredProducts.slice(0, 30).map((p, i, arr) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => { setSelectedProduct(p); setStoreId(p.vendor_id); setProductSearch(''); }}
                activeOpacity={0.75}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: T.line }}
              >
                {p.image_url
                  ? <Image source={{ uri: p.image_url }} style={{ width: 42, height: 42, borderRadius: 10 }} />
                  : <View style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: T.surface2, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="cube-outline" size={18} color={T.ink4} /></View>}
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.ink }}>{p.name}</Text>
                  <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: T.primaryInk }}>
                    {formatPrice(p.price)}{stores.length > 1 ? <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: T.ink3 }}>{`  ·  ${p.store_name}`}</Text> : null}
                  </Text>
                </View>
                <Ionicons name="add-circle-outline" size={22} color={T.ink3} />
              </TouchableOpacity>
            ))}
            {filteredProducts.length === 0 && (
              <Text style={{ padding: 16, fontSize: 13, color: T.ink3, textAlign: 'center' }}>No products match “{productSearch}”</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Sticky post button */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: T.canvas, borderTopWidth: 1, borderTopColor: T.line }}>
        <TouchableOpacity
          onPress={post}
          disabled={!canPost}
          activeOpacity={0.85}
          style={{ height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: canPost ? T.primary : T.lineStrong }}
        >
          <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
          <Text style={{ fontSize: 15.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>
            {mode === 'photo' ? `Post ${photos.length} photo${photos.length === 1 ? '' : 's'}` : 'Post video'}
          </Text>
        </TouchableOpacity>
      </View>

      {alertElement}
    </KeyboardAvoidingView>
  );
}
