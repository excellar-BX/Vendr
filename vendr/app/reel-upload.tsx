import { useState, useRef, useEffect } from 'react';
import {
  View, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, TextInput as RNTextInput, Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system/legacy';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Text } from '../components/ui/StyledText';
import { useVendrAlert } from '../components/ui/VendrAlert';
import { useAuthStore } from '../stores/authStore';
import { formatPrice } from '../lib/utils';
import { reelApi, storageApi, vendorApi, productApi } from '../lib/api';

const { width: SW } = Dimensions.get('window');

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  vendor_id: string;
  store_name: string;
}

type UploadStage = 'pick' | 'preview' | 'uploading' | 'done';

// Upload video/thumbnail to R2 via pre-signed URL
async function uploadVideoToR2(
  uri: string,
  path: string,
  bucket: string,
  mimeType: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  // Get pre-signed URL from backend storage API
  onProgress?.(10);
  const { data: { uploadUrl, publicUrl } } = await storageApi.signUpload(
    `${bucket}/${path}`,
    mimeType
  );

  onProgress?.(20);

  // Read file as base64
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64' as any,
  });
  onProgress?.(50);

  // Convert base64 → Uint8Array
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  onProgress?.(70);

  // Upload directly to R2
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: bytes.buffer,
  });
  onProgress?.(90);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`R2 upload failed: ${response.status} — ${text}`);
  }

  return publicUrl;
}


// ── Video Preview Component (uses hook at top level) ─────────────────────────
function VideoViewPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: '100%' }}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

// ─── Preview Video (needs hook at component level) ──────────────────────────
function PreviewVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: '100%' }}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

export default function ReelUploadScreen() {
  const { user } = useAuthStore();
  const { showAlert, alertElement } = useVendrAlert();

  const [stage, setStage] = useState<UploadStage>('pick');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [caption, setCaption] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [productSearch, setProductSearch] = useState('');

  // Fetch products for the current user's vendor
  useEffect(() => {
    if (!user?.id) return;
    const fetchAllProducts = async () => {
      try {
        // Get current user's vendor
        const { data: vendor } = await vendorApi.getMyVendor();
        if (!vendor) {
          return; // User is not a vendor or vendor not set up yet
        }

        // Fetch products for this vendor
        const { data: products } = await productApi.getProducts(vendor.id);

        // Map to component format with store name
        setProducts(products.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          image_url: p.image_url,
          vendor_id: p.vendor_id,
          store_name: vendor.shop_name || '',
        })));
      } catch (e: any) {
        if (e.statusCode === 401) {
          showAlert({
            title: 'Session expired',
            message: 'Your session has expired. Please log in again.',
            type: 'warning',
          });
          router.replace('/(auth)/login?expired=true');
        } else {
          console.error('Failed to fetch products:', e);
          showAlert({ title: 'Error', message: 'Failed to load products. Please try again.', type: 'danger' });
        }
      }
    };
    fetchAllProducts();
  }, [user?.id]);

  const handlePickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert({ title: 'Permission needed', message: 'Please allow access to your media library to upload videos.', type: 'warning' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      videoMaxDuration: 30,
      quality: 0,           // lowest quality = smallest file size
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Automatic,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const durationSec = (asset.duration ?? 0) / 1000;
      if (durationSec > 31) {
        showAlert({ title: 'Too long', message: 'Reels must be 30 seconds or less. Please trim your video.', type: 'warning' });
        return;
      }

      // Warn if file is still large (>30MB) even after quality reduction
      const fileSize = asset.fileSize ?? 0;
      const fileMB = fileSize / (1024 * 1024);
      if (fileMB > 30) {
        showAlert({
          title: 'Video too large',
          message: `This video is ${fileMB.toFixed(0)}MB. Please trim it shorter or record at a lower resolution.`,
          type: 'warning',
        });
        return;
      }

      setVideoUri(asset.uri);
      setDuration(Math.round(durationSec));
      setStage('preview');
    }
  };

  const handlePost = async () => {
    if (!videoUri || !selectedProduct || !user?.id) return;
    setUploading(true);
    setStage('uploading');

    try {
      const userId = user.id;
      const timestamp = Date.now();
      const videoPath = `${userId}/${timestamp}_reel.mp4`;

      // Upload video (0-80%)
      const videoUrl = await uploadVideoToR2(
        videoUri,
        videoPath,
        'reels',
        'video/mp4',
        (pct) => setUploadProgress(Math.round(pct * 0.8)),
      );

      // Generate + upload thumbnail (80-95%)
      let thumbnailUrl: string | null = null;
      try {
        const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
          time: 1000,
          quality: 0.7,
        });
        const thumbPath = `${userId}/${timestamp}_thumb.jpg`;
        thumbnailUrl = await uploadVideoToR2(
          thumbUri,
          thumbPath,
          'reels',
          'image/jpeg',
          (pct) => setUploadProgress(80 + Math.round(pct * 0.15)),
        );
      } catch (_) {
        // Thumbnail generation failed — non-critical, continue without it
      }

      setUploadProgress(98);

      // Create reel via backend API
      await reelApi.createReel({
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        caption: caption.trim() || null,
        product_id: selectedProduct?.id ?? null,
      });

      setUploadProgress(100);
      setStage('done');
    } catch (e: any) {
      if (e.statusCode === 401) {
        showAlert({
          title: 'Session expired',
          message: 'Your session has expired. Please log in again.',
          type: 'warning',
        });
        router.replace('/(auth)/login?expired=true');
      } else {
        setUploading(false);
        setStage('preview');
        showAlert({ title: 'Upload failed', message: e?.message ?? 'Something went wrong. Please try again.', type: 'danger' });
      }
    }
  };

  // ── Pick stage ───────────────────────────────────────────────────────────────
  if (stage === 'pick') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
        <StatusBar style="light" />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}
          >
            <Ionicons name="close" size={20} color="#FDF6EC" />
          </TouchableOpacity>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#FDF6EC' }}>New Reel</Text>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <TouchableOpacity
            onPress={handlePickVideo}
            activeOpacity={0.85}
            style={{
              width: SW - 64, aspectRatio: 9/16, borderRadius: 24,
              backgroundColor: '#1A1208', borderWidth: 1.5,
              borderColor: '#2A1F14', borderStyle: 'dashed',
              alignItems: 'center', justifyContent: 'center', gap: 16,
            }}
          >
            <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(232,82,26,0.15)', borderWidth: 1, borderColor: 'rgba(232,82,26,0.3)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="videocam-outline" size={36} color="#E8521A" />
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC' }}>Choose a Video</Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#6B5E50', textAlign: 'center' }}>
                Pick a short video from your library
              </Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#3D3026', marginTop: 4 }}>
                Max 60 seconds
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {alertElement}
      </View>
    );
  }

  // ── Uploading stage ──────────────────────────────────────────────────────────
  if (stage === 'uploading') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0A06', alignItems: 'center', justifyContent: 'center', gap: 24, paddingHorizontal: 40 }}>
        <StatusBar style="light" />
        <View style={{ width: 80, height: 80, borderRadius: 28, backgroundColor: 'rgba(232,82,26,0.15)', borderWidth: 1, borderColor: 'rgba(232,82,26,0.3)', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#E8521A" />
        </View>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#FDF6EC' }}>Posting your reel...</Text>
        <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#6B5E50', textAlign: 'center' }}>
          Uploading your video. This may take a moment.
        </Text>
        {/* Progress bar */}
        <View style={{ width: '100%', height: 6, borderRadius: 3, backgroundColor: '#1A1208', overflow: 'hidden' }}>
          <View style={{ height: '100%', borderRadius: 3, backgroundColor: '#E8521A', width: `${uploadProgress}%` }} />
        </View>
        <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#9A8570' }}>{uploadProgress}%</Text>
      </View>
    );
  }

  // ── Done stage ───────────────────────────────────────────────────────────────
  if (stage === 'done') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0A06', alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 40 }}>
        <StatusBar style="light" />
        <View style={{ width: 88, height: 88, borderRadius: 28, backgroundColor: 'rgba(45,134,83,0.15)', borderWidth: 1, borderColor: 'rgba(45,134,83,0.3)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark-circle" size={48} color="#2D8653" />
        </View>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: '#FDF6EC' }}>Reel posted!</Text>
        <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#9A8570', textAlign: 'center' }}>
          Your reel is live. Buyers in your category will see it in their feed.
        </Text>
        <View style={{ flexDirection: 'row', gap: 12, width: '100%', marginTop: 8 }}>
          <TouchableOpacity
            onPress={() => { setStage('pick'); setVideoUri(null); setCaption(''); setSelectedProduct(null); }}
            activeOpacity={0.85}
            style={{ flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14' }}
          >
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#9A8570' }}>Post Another</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.85}
            style={{ flex: 2, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8521A' }}
          >
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: 'white' }}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Preview + details stage ───────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 }}>
        <TouchableOpacity
          onPress={() => setStage('pick')}
          style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}
        >
          <Ionicons name="arrow-back" size={20} color="#FDF6EC" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#FDF6EC', flex: 1 }}>Preview & Post</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>

        {/* Video preview */}
        <View style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 20, aspectRatio: 9/16, backgroundColor: '#1A1208' }}>
          <PreviewVideo uri={videoUri!} />
          {/* Duration badge */}
          <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12, color: 'white' }}>{duration}s</Text>
          </View>
          {/* Change video */}
          <TouchableOpacity
            onPress={handlePickVideo}
            style={{ position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Ionicons name="swap-horizontal" size={14} color="white" />
            <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12, color: 'white' }}>Change</Text>
          </TouchableOpacity>
        </View>

        {/* Caption */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12, color: '#6B5E50', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>Caption</Text>
          <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: caption ? '#E8521A' : '#2A1F14', borderRadius: 16, padding: 14, minHeight: 90 }}>
            <RNTextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Describe what you're showing..."
              placeholderTextColor="#6B5E50"
              multiline
              maxLength={200}
              style={{ color: '#FDF6EC', fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, lineHeight: 22, backgroundColor: 'transparent' }}
            />
          </View>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#3D3026', textAlign: 'right', marginTop: 4 }}>
            {caption.length}/200
          </Text>
        </View>

        {/* Tag a product */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12, color: '#6B5E50', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>
            Tag a Product (required)
          </Text>

          {/* Selected product pill */}
          {selectedProduct && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12,
              backgroundColor: 'rgba(232,82,26,0.08)', borderWidth: 1, borderColor: 'rgba(232,82,26,0.3)',
              borderRadius: 14, padding: 12,
            }}>
              {selectedProduct.image_url ? (
                <Image source={{ uri: selectedProduct.image_url }} style={{ width: 44, height: 44, borderRadius: 10 }} resizeMode="cover" />
              ) : (
                <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#2A1F14', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="cube-outline" size={20} color="#3D3026" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }} numberOfLines={1}>{selectedProduct.name}</Text>
                <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#9A8570', marginTop: 1 }} numberOfLines={1}>{selectedProduct.store_name}</Text>
                <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: '#E8521A', marginTop: 1 }}>{formatPrice(selectedProduct.price)}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedProduct(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={22} color="#6B5E50" />
              </TouchableOpacity>
            </View>
          )}

          {products.length === 0 ? (
            <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 14, padding: 16, alignItems: 'center', gap: 6 }}>
              <Ionicons name="cube-outline" size={24} color="#3D3026" />
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#6B5E50' }}>
                No products in your stores yet
              </Text>
            </View>
          ) : (
            <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 16, overflow: 'hidden' }}>
              {/* Search */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2A1F14' }}>
                <Ionicons name="search-outline" size={16} color="#6B5E50" />
                <RNTextInput
                  value={productSearch}
                  onChangeText={setProductSearch}
                  placeholder={`Search ${products.length} product${products.length !== 1 ? 's' : ''}...`}
                  placeholderTextColor="#6B5E50"
                  style={{ flex: 1, color: '#FDF6EC', fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, backgroundColor: 'transparent' }}
                />
                {productSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setProductSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color="#6B5E50" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Product list */}
              {(() => {
                const filtered = products.filter(p =>
                  p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                  p.store_name.toLowerCase().includes(productSearch.toLowerCase())
                );
                if (filtered.length === 0) {
                  return (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#6B5E50' }}>No products match your search</Text>
                    </View>
                  );
                }
                return filtered.map((product, i) => {
                  const isSelected = selectedProduct?.id === product.id;
                  return (
                    <TouchableOpacity
                      key={product.id}
                      onPress={() => setSelectedProduct(isSelected ? null : product)}
                      activeOpacity={0.75}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 12,
                        paddingHorizontal: 14, paddingVertical: 12,
                        borderBottomWidth: i < filtered.length - 1 ? 1 : 0,
                        borderBottomColor: '#2A1F14',
                        backgroundColor: isSelected ? 'rgba(232,82,26,0.07)' : 'transparent',
                      }}
                    >
                      {/* Thumbnail */}
                      {product.image_url ? (
                        <Image source={{ uri: product.image_url }} style={{ width: 48, height: 48, borderRadius: 12 }} resizeMode="cover" />
                      ) : (
                        <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#2A1F14', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="cube-outline" size={22} color="#3D3026" />
                        </View>
                      )}

                      {/* Info */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: isSelected ? '#FDF6EC' : '#FDF6EC' }} numberOfLines={1}>
                          {product.name}
                        </Text>
                        <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#6B5E50', marginTop: 1 }} numberOfLines={1}>
                          {product.store_name}
                        </Text>
                        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: '#E8521A', marginTop: 2 }}>
                          {formatPrice(product.price)}
                        </Text>
                      </View>

                      {/* Select indicator */}
                      <View style={{
                        width: 24, height: 24, borderRadius: 12,
                        backgroundColor: isSelected ? '#E8521A' : 'transparent',
                        borderWidth: isSelected ? 0 : 1.5,
                        borderColor: '#3D3026',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isSelected && <Ionicons name="checkmark" size={14} color="white" />}
                      </View>
                    </TouchableOpacity>
                  );
                });
              })()}
            </View>
          )}
        </View>

        {/* Post button */}
        <TouchableOpacity
          onPress={handlePost}
          disabled={uploading || !selectedProduct}
          activeOpacity={0.85}
          style={{
            height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10,
            backgroundColor: selectedProduct ? '#E8521A' : '#3D3026',
            shadowColor: '#E8521A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
          }}
        >
          <Ionicons name="cloud-upload-outline" size={20} color="white" />
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: 'white' }}>Post Reel</Text>
        </TouchableOpacity>

      </ScrollView>

      {alertElement}
    </View>
  );
}