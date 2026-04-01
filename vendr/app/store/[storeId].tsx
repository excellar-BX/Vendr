import { useState, useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, TextInput, Switch, Modal, Image, Dimensions, FlatList,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { uploadFile } from '../../lib/storage';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '../../components/ui/StyledText';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_H = 160;
const SUPABASE_URL = 'https://mbdojwirmtknzpwccthb.supabase.co';
const REEL_SIZE = (SCREEN_WIDTH - 48) / 3;

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  is_available: boolean;
  image_url?: string;
}

interface Store {
  id: string;
  business_name: string;
  category: string;
  description: string;
  address: string;
  is_active: boolean;
  is_verified: boolean;
  rating: number;
  review_count: number;
  logo_url?: string;
  banner_url?: string;
}

interface ReelThumb {
  id: string;
  thumbnail_url: string | null;
  video_url: string;
  view_count: number;
  caption: string | null;
  vendor_id: string;
}

function formatPrice(n: number) {
  return '₦' + n.toLocaleString('en-NG');
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
const CATEGORIES: { label: string; icon: IoniconsName }[] = [
  { label: 'Food & Drinks',  icon: 'fast-food-outline' },
  { label: 'Fashion',        icon: 'shirt-outline' },
  { label: 'Accessories',    icon: 'diamond-outline' },
  { label: 'Beauty & Hair',  icon: 'cut-outline' },
  { label: 'Electronics',    icon: 'phone-portrait-outline' },
  { label: 'Groceries',      icon: 'basket-outline' },
];

const TABS = ['Products', 'Reels'] as const;
type Tab = typeof TABS[number];

// ─── Upload Helper — now routes to R2 via storage.ts ───────────────────────
async function uploadImage(bucket: string, path: string, uri: string): Promise<string> {
  return uploadFile({
    bucket: bucket as any,
    path,
    uri,
    contentType: 'image/jpeg',
  });
}

async function pickImage() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to upload images.'); return null; }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.85,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0].uri;
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function StoreDashboardScreen() {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const { session } = useAuthStore();

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reels, setReels] = useState<ReelThumb[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('Products');
  const [loading, setLoading] = useState(true);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showDeleteStore, setShowDeleteStore] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingStore, setDeletingStore] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [deletingReelId, setDeletingReelId] = useState<string | null>(null);

  // Product form state
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pAvailable, setPAvailable] = useState(true);
  const [pImageUri, setPImageUri] = useState<string | null>(null);
  const [pImageUrl, setPImageUrl] = useState<string | null>(null);
  const [uploadingProductImg, setUploadingProductImg] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!storeId) return;
    const fetch = async () => {
      setLoading(true);
      const [{ data: storeData }, { data: productData }, { data: reelData }] = await Promise.all([
        supabase.from('vendors').select('*').eq('id', storeId).single(),
        supabase.from('products').select('*').eq('vendor_id', storeId).order('created_at', { ascending: false }),
        supabase.from('reels').select('id, thumbnail_url, video_url, view_count, caption, vendor_id').eq('vendor_id', storeId).order('created_at', { ascending: false }),
      ]);
      setStore(storeData);
      setProducts(productData ?? []);
      setReels(reelData ?? []);
      setLoading(false);
    };
    fetch();
  }, [storeId]));

  // ─── Banner Upload ──────────────────────────────────────────────────────
  const handleBannerUpload = async () => {
    const uri = await pickImage();
    if (!uri) return;
    try {
      setUploadingBanner(true);
      const path = `${storeId}/banner_${Date.now()}.jpg`;
      const url = await uploadImage('vendor-images', path, uri);
      await supabase.from('vendors').update({ banner_url: url }).eq('id', storeId);
      setStore(prev => prev ? { ...prev, banner_url: url } : null);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setUploadingBanner(false);
    }
  };

  // ─── Logo Upload ────────────────────────────────────────────────────────
  const handleLogoUpload = async () => {
    const uri = await pickImage();
    if (!uri) return;
    try {
      setUploadingLogo(true);
      const path = `${storeId}/logo_${Date.now()}.jpg`;
      const url = await uploadImage('vendor-images', path, uri);
      await supabase.from('vendors').update({ logo_url: url }).eq('id', storeId);
      setStore(prev => prev ? { ...prev, logo_url: url } : null);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handlePickProductImage = async () => {
    const uri = await pickImage();
    if (uri) setPImageUri(uri);
  };

  // ─── Product Modal ───────────────────────────────────────────────────────
  const openAddProduct = () => {
    setEditingProduct(null);
    setPName(''); setPDesc(''); setPPrice(''); setPAvailable(true);
    setPImageUri(null); setPImageUrl(null);
    setShowAddProduct(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setPName(p.name);
    setPDesc(p.description ?? '');
    setPPrice(String(p.price));
    setPAvailable(p.is_available);
    setPImageUri(null);
    setPImageUrl(p.image_url ?? null);
    setShowAddProduct(true);
  };

  const saveProduct = async () => {
    if (!pName.trim() || !pPrice.trim()) {
      Alert.alert('Missing info', 'Please enter a product name and price.');
      return;
    }
    const price = parseFloat(pPrice.replace(/[^0-9.]/g, ''));
    if (isNaN(price)) { Alert.alert('Invalid price', 'Enter a valid number.'); return; }

    setSaving(true);

    let finalImageUrl = pImageUrl;
    if (pImageUri) {
      try {
        setUploadingProductImg(true);
        const pid = editingProduct?.id ?? `new_${Date.now()}`;
        const path = `${storeId}/product_${pid}_${Date.now()}.jpg`;
        finalImageUrl = await uploadImage('vendor-images', path, pImageUri);
        setUploadingProductImg(false);
      } catch (e: any) {
        Alert.alert('Image upload failed', e.message);
        setUploadingProductImg(false);
        setSaving(false);
        return;
      }
    }

    const payload = {
      name: pName.trim(),
      description: pDesc.trim(),
      price,
      is_available: pAvailable,
      image_url: finalImageUrl ?? null,
    };

    if (editingProduct) {
      const { data, error } = await supabase
        .from('products').update(payload).eq('id', editingProduct.id).select().single();
      if (error) { Alert.alert('Error', error.message); setSaving(false); return; }
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? data : p));
    } else {
      const { data, error } = await supabase
        .from('products').insert({ vendor_id: storeId, ...payload }).select().single();
      if (error) { Alert.alert('Error', error.message); setSaving(false); return; }
      setProducts(prev => [data, ...prev]);
    }

    setSaving(false);
    setShowAddProduct(false);
  };

  const deleteProduct = (p: Product) => {
    Alert.alert('Delete product?', `Remove "${p.name}" from your store?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setProducts(prev => prev.filter(x => x.id !== p.id));
          await supabase.from('products').delete().eq('id', p.id);
        },
      },
    ]);
  };

  // ─── Delete Reel ─────────────────────────────────────────────────────────
  const handleDeleteReel = (reel: ReelThumb) => {
    Alert.alert('Delete Reel?', 'This will permanently remove the reel and its video.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          // Optimistically remove from UI
          setReels(prev => prev.filter(r => r.id !== reel.id));
          setDeletingReelId(reel.id);
          try {
            // Extract storage path from URL and delete file
            const videoPath = reel.video_url.split('/reels/')[1];
            if (videoPath) {
              await supabase.storage.from('reels').remove([videoPath]);
            }
            if (reel.thumbnail_url) {
              const thumbPath = reel.thumbnail_url.split('/reels/')[1];
              if (thumbPath) await supabase.storage.from('reels').remove([thumbPath]);
            }
            await supabase.from('reels').delete().eq('id', reel.id);
          } catch (e: any) {
            Alert.alert('Error', 'Could not fully delete reel files.');
          } finally {
            setDeletingReelId(null);
          }
        },
      },
    ]);
  };

  const toggleStoreActive = async () => {
    if (!store) return;
    const newVal = !store.is_active;
    setStore(prev => prev ? { ...prev, is_active: newVal } : null);
    await supabase.from('vendors').update({ is_active: newVal }).eq('id', storeId);
  };

  const toggleProductAvailable = async (p: Product) => {
    const newVal = !p.is_available;
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_available: newVal } : x));
    await supabase.from('products').update({ is_available: newVal }).eq('id', p.id);
  };

  const handleDeleteStore = async () => {
    if (deleteConfirmText.trim().toLowerCase() !== store?.business_name.toLowerCase()) return;
    try {
      setDeletingStore(true);
      await supabase.from('products').delete().eq('vendor_id', storeId);
      await supabase.from('conversations').delete().eq('vendor_id', storeId);
      await supabase.from('vendors').delete().eq('id', storeId);
      setShowDeleteStore(false);
      router.replace('/my-stores');
    } catch (e: any) {
      Alert.alert('Error', e.message);
      setDeletingStore(false);
    }
  };

  const handleChangeCategory = async (cat: string) => {
    try {
      setSavingCategory(true);
      await supabase.from('vendors').update({ category: cat }).eq('id', storeId);
      setStore(prev => prev ? { ...prev, category: cat } : null);
      setShowCategoryPicker(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingCategory(false);
    }
  };

  const inputStyle = {
    fontFamily: 'SpaceGrotesk_400Regular' as const,
    color: '#FDF6EC',
    fontSize: 15,
    backgroundColor: '#1A1208',
    borderWidth: 1,
    borderColor: '#3D3026',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  };

  if (loading) {
    return (
      <View className="flex-1 bg-dark items-center justify-center">
        <ActivityIndicator size="large" color="#E8521A" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />

      {/* Header */}
      <View className="flex-row items-center px-5 pt-14 pb-4 border-b border-faint gap-3">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-cream text-xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>{store?.business_name}</Text>
          <Text className="text-muted text-xs">{store?.category}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/vendor/[id]', params: { id: storeId } })}
          className="w-9 h-9 bg-dark-2 border border-faint rounded-xl items-center justify-center"
        >
          <Ionicons name="eye-outline" size={18} color="#9A8570" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* ── Banner + Logo ── */}
        <View style={{ marginBottom: 60 }}>
          <TouchableOpacity activeOpacity={0.85} onPress={handleBannerUpload} style={{ height: BANNER_H }}>
            {store?.banner_url ? (
              <Image source={{ uri: store.banner_url }} style={{ width: '100%', height: BANNER_H }} resizeMode="cover" />
            ) : (
              <View style={{ width: '100%', height: BANNER_H, backgroundColor: '#1A1208', alignItems: 'center', justifyContent: 'center', gap: 8, borderBottomWidth: 1, borderColor: '#2A1F14' }}>
                <Ionicons name="image-outline" size={32} color="#3D3026" />
                <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, color: '#6B5E50' }}>Tap to add banner</Text>
              </View>
            )}
            <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {uploadingBanner
                ? <ActivityIndicator size="small" color="white" />
                : <Ionicons name="camera" size={13} color="white" />}
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: 'white' }}>
                {uploadingBanner ? 'Uploading…' : 'Edit banner'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={{ position: 'absolute', bottom: -44, left: 20 }}>
            <TouchableOpacity activeOpacity={0.85} onPress={handleLogoUpload}>
              <View style={{ width: 80, height: 80, borderRadius: 20, borderWidth: 3, borderColor: '#0F0A06', backgroundColor: '#1A1208', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 }}>
                {store?.logo_url ? (
                  <Image source={{ uri: store.logo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="storefront-outline" size={28} color="#3D3026" />
                  </View>
                )}
              </View>
              <View style={{ position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: '#E8521A', borderWidth: 2, borderColor: '#0F0A06', alignItems: 'center', justifyContent: 'center' }}>
                {uploadingLogo
                  ? <ActivityIndicator size="small" color="white" />
                  : <Ionicons name="camera" size={12} color="white" />}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 20 }}>

          {/* Store status card */}
          <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 20, padding: 16, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: '#FDF6EC' }}>Store Status</Text>
                <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#9A8570', marginTop: 2 }}>
                  {store?.is_active ? 'Customers can find and message you' : 'Your store is hidden from search'}
                </Text>
              </View>
              <Switch value={store?.is_active ?? false} onValueChange={toggleStoreActive} trackColor={{ false: '#3D3026', true: '#E8521A' }} thumbColor="white" />
            </View>

            <View style={{ height: 1, backgroundColor: '#2A1F14' }} />

            <TouchableOpacity onPress={() => setShowCategoryPicker(true)} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(232,82,26,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="pricetag-outline" size={16} color="#E8521A" />
                </View>
                <View>
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#6B5E50' }}>Category</Text>
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC', marginTop: 1 }}>{store?.category}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#6B5E50" />
            </TouchableOpacity>

            {store?.is_verified && (
              <>
                <View style={{ height: 1, backgroundColor: '#2A1F14' }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="shield-checkmark" size={16} color="#2D8653" />
                  <Text style={{ fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', color: '#2D8653' }}>Verified store</Text>
                </View>
              </>
            )}
            {store && store.review_count > 0 && (
              <>
                <View style={{ height: 1, backgroundColor: '#2A1F14' }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="star" size={14} color="#F5A623" />
                  <Text style={{ fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold', color: '#F5A623' }}>
                    {store.rating?.toFixed(1)} · {store.review_count} review{store.review_count !== 1 ? 's' : ''}
                  </Text>
                </View>
              </>
            )}

            <View style={{ height: 1, backgroundColor: '#2A1F14' }} />

            <TouchableOpacity onPress={() => { setDeleteConfirmText(''); setShowDeleteStore(true); }} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(232,85,85,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="trash-outline" size={16} color="#E85555" />
              </View>
              <View>
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#E85555' }}>Delete Store</Text>
                <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#6B5E50', marginTop: 1 }}>Permanently remove this store</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Tabs ── */}
          <View style={{ flexDirection: 'row', backgroundColor: '#1A1208', borderRadius: 16, padding: 4, borderWidth: 1, borderColor: '#2A1F14' }}>
            {TABS.map(tab => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
                  backgroundColor: activeTab === tab ? '#E8521A' : 'transparent',
                }}
              >
                <Text style={{
                  fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13,
                  color: activeTab === tab ? 'white' : '#6B5E50',
                }}>
                  {tab}{tab === 'Products' ? ` (${products.length})` : ` (${reels.length})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Products Tab ── */}
          {activeTab === 'Products' && (
            <View style={{ gap: 12 }}>
              <TouchableOpacity onPress={openAddProduct} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#E8521A', borderRadius: 14, paddingVertical: 13 }}>
                <Ionicons name="add" size={18} color="white" />
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', color: 'white', fontSize: 14 }}>Add Product</Text>
              </TouchableOpacity>

              {products.length === 0 ? (
                <View className="bg-dark-2 border border-faint border-dashed rounded-2xl p-8 items-center gap-3">
                  <Ionicons name="cube-outline" size={32} color="#3D3026" />
                  <Text className="text-muted text-sm text-center">No products yet. Add your first product to start selling.</Text>
                </View>
              ) : (
                products.map(p => (
                  <View key={p.id} className="bg-dark-2 border border-faint rounded-2xl overflow-hidden">
                    {p.image_url ? (
                      <Image source={{ uri: p.image_url }} style={{ width: '100%', height: 120 }} resizeMode="cover" />
                    ) : (
                      <View style={{ width: '100%', height: 72, backgroundColor: '#1A1208', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="image-outline" size={24} color="#3D3026" />
                      </View>
                    )}
                    <View className="p-4 gap-2">
                      <View className="flex-row items-start gap-3">
                        <View className="flex-1">
                          <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>{p.name}</Text>
                          {p.description ? <Text className="text-muted text-xs mt-0.5" numberOfLines={2}>{p.description}</Text> : null}
                          <Text style={{ fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', color: '#E8521A', marginTop: 4 }}>{formatPrice(p.price)}</Text>
                        </View>
                      </View>
                      <View className="flex-row items-center justify-between pt-2 border-t border-faint">
                        <View className="flex-row items-center gap-2">
                          <Switch value={p.is_available} onValueChange={() => toggleProductAvailable(p)} trackColor={{ false: '#3D3026', true: '#E8521A' }} thumbColor="white" style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }} />
                          <Text style={{ fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', color: p.is_available ? '#FDF6EC' : '#6B5E50' }}>
                            {p.is_available ? 'Available' : 'Unavailable'}
                          </Text>
                        </View>
                        <View className="flex-row gap-2">
                          <TouchableOpacity onPress={() => openEditProduct(p)} className="w-8 h-8 bg-dark-3 border border-faint rounded-xl items-center justify-center">
                            <Ionicons name="pencil-outline" size={14} color="#9A8570" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => deleteProduct(p)} className="w-8 h-8 bg-dark-3 border border-faint rounded-xl items-center justify-center">
                            <Ionicons name="trash-outline" size={14} color="#E85555" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* ── Reels Tab ── */}
          {activeTab === 'Reels' && (
            <View style={{ gap: 12 }}>
              <TouchableOpacity
                onPress={() => router.push('/reel-upload')}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#E8521A', borderRadius: 14, paddingVertical: 13 }}
              >
                <Ionicons name="add" size={18} color="white" />
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', color: 'white', fontSize: 14 }}>Upload Reel</Text>
              </TouchableOpacity>

              {reels.length === 0 ? (
                <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderStyle: 'dashed', borderRadius: 20, padding: 40, alignItems: 'center', gap: 12 }}>
                  <Ionicons name="videocam-outline" size={36} color="#3D3026" />
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, color: '#6B5E50' }}>No reels yet</Text>
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#3D3026', textAlign: 'center' }}>
                    Upload short videos to showcase your products and attract more customers.
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {reels.map((reel, idx) => (
                    <View key={reel.id} style={{ width: REEL_SIZE, height: REEL_SIZE * 1.5, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1A1208' }}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => router.push({
                          pathname: '/reel/[reelId]',
                          params: { reelId: reel.id, vendorId: reel.vendor_id, startIndex: String(idx) },
                        })}
                        style={{ flex: 1 }}
                      >
                        {reel.thumbnail_url ? (
                          <Image source={{ uri: reel.thumbnail_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        ) : (
                          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="play-circle-outline" size={28} color="#3D3026" />
                          </View>
                        )}
                        {/* View count */}
                        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 7, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="eye-outline" size={10} color="white" />
                          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 10, color: 'white' }}>
                            {reel.view_count > 999 ? `${(reel.view_count / 1000).toFixed(1)}k` : reel.view_count}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Delete button */}
                      <TouchableOpacity
                        onPress={() => handleDeleteReel(reel)}
                        style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {deletingReelId === reel.id
                          ? <ActivityIndicator size="small" color="white" />
                          : <Ionicons name="trash-outline" size={14} color="#FF6B6B" />}
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Add / Edit Product Modal ── */}
      <Modal visible={showAddProduct} transparent animationType="slide">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} activeOpacity={1} onPress={() => setShowAddProduct(false)} />
        <View style={{ backgroundColor: '#1A1208', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: '#2A1F14', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36 }}>
          <View style={{ width: 40, height: 4, backgroundColor: '#3D3026', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC', textAlign: 'center', marginBottom: 20 }}>
            {editingProduct ? 'Edit Product' : 'Add Product'}
          </Text>

          <TouchableOpacity
            onPress={handlePickProductImage}
            activeOpacity={0.85}
            style={{ width: '100%', height: 140, borderRadius: 18, overflow: 'hidden', backgroundColor: '#0F0A06', borderWidth: 1, borderColor: '#3D3026', borderStyle: (pImageUri || pImageUrl) ? 'solid' : 'dashed', marginBottom: 16, alignItems: 'center', justifyContent: 'center' }}
          >
            {pImageUri ? (
              <Image source={{ uri: pImageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : pImageUrl ? (
              <Image source={{ uri: pImageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(232,82,26,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="camera-outline" size={24} color="#E8521A" />
                </View>
                <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, color: '#6B5E50' }}>Add product photo</Text>
                <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#3D3026' }}>Tap to choose from gallery</Text>
              </View>
            )}
            {(pImageUri || pImageUrl) && (
              <View style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="camera" size={12} color="white" />
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: 'white' }}>Change photo</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={{ gap: 12 }}>
            <TextInput value={pName} onChangeText={setPName} placeholder="Product name" placeholderTextColor="#6B5E50" style={inputStyle} />
            <TextInput value={pDesc} onChangeText={setPDesc} placeholder="Description (optional)" placeholderTextColor="#6B5E50" multiline style={[inputStyle, { height: 80, paddingTop: 14, textAlignVertical: 'top' }]} />
            <TextInput value={pPrice} onChangeText={setPPrice} placeholder="Price (₦)" placeholderTextColor="#6B5E50" keyboardType="numeric" style={inputStyle} />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0F0A06', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 14, color: '#FDF6EC' }}>Available now</Text>
              <Switch value={pAvailable} onValueChange={setPAvailable} trackColor={{ false: '#3D3026', true: '#E8521A' }} thumbColor="white" />
            </View>

            <TouchableOpacity
              onPress={saveProduct}
              disabled={saving || uploadingProductImg}
              style={{ backgroundColor: '#E8521A', borderRadius: 16, height: 56, alignItems: 'center', justifyContent: 'center', marginTop: 4, shadowColor: '#E8521A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
            >
              {(saving || uploadingProductImg)
                ? <ActivityIndicator size="small" color="white" />
                : <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', color: 'white', fontSize: 16 }}>{editingProduct ? 'Save Changes' : 'Add Product'}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Category Picker Modal ── */}
      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} activeOpacity={1} onPress={() => setShowCategoryPicker(false)} />
        <View style={{ backgroundColor: '#1A1208', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: '#2A1F14', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36 }}>
          <View style={{ width: 40, height: 4, backgroundColor: '#3D3026', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC', textAlign: 'center', marginBottom: 20 }}>Change Category</Text>
          <View style={{ gap: 10 }}>
            {CATEGORIES.map(cat => {
              const active = store?.category === cat.label;
              return (
                <TouchableOpacity
                  key={cat.label}
                  onPress={() => handleChangeCategory(cat.label)}
                  activeOpacity={0.8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: active ? 'rgba(232,82,26,0.12)' : '#0F0A06', borderWidth: 1, borderColor: active ? '#E8521A' : '#2A1F14', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: active ? 'rgba(232,82,26,0.2)' : '#1A1208', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={cat.icon} size={18} color={active ? '#E8521A' : '#9A8570'} />
                  </View>
                  <Text style={{ flex: 1, fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, color: active ? '#E8521A' : '#FDF6EC' }}>{cat.label}</Text>
                  {savingCategory && active && <ActivityIndicator size="small" color="#E8521A" />}
                  {active && !savingCategory && <Ionicons name="checkmark-circle" size={20} color="#E8521A" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* ── Delete Store Modal ── */}
      <Modal visible={showDeleteStore} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: '#1A1208', borderRadius: 24, borderWidth: 1, borderColor: '#3D3026', padding: 24 }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(232,85,85,0.12)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 }}>
              <Ionicons name="trash" size={26} color="#E85555" />
            </View>
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC', textAlign: 'center', marginBottom: 8 }}>Delete Store?</Text>
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570', textAlign: 'center', lineHeight: 20, marginBottom: 20 }}>
              This will permanently delete <Text style={{ color: '#FDF6EC', fontFamily: 'SpaceGrotesk_600SemiBold' }}>{store?.business_name}</Text>, all its products, and conversation history.
            </Text>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12, color: '#6B5E50', marginBottom: 8 }}>
                Type <Text style={{ color: '#FDF6EC' }}>{store?.business_name}</Text> to confirm:
              </Text>
              <TextInput
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                placeholder={store?.business_name}
                placeholderTextColor="#3D3026"
                autoCapitalize="none"
                style={{ fontFamily: 'SpaceGrotesk_400Regular', color: '#FDF6EC', fontSize: 15, backgroundColor: '#0F0A06', borderWidth: 1, borderColor: deleteConfirmText.trim().toLowerCase() === store?.business_name.toLowerCase() ? '#E85555' : '#3D3026', borderRadius: 14, paddingHorizontal: 16, height: 52 }}
              />
            </View>

            <View style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={handleDeleteStore}
                disabled={deletingStore || deleteConfirmText.trim().toLowerCase() !== store?.business_name.toLowerCase()}
                style={{ backgroundColor: deleteConfirmText.trim().toLowerCase() === store?.business_name.toLowerCase() ? '#E85555' : '#2A1F14', borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center' }}
              >
                {deletingStore
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: deleteConfirmText.trim().toLowerCase() === store?.business_name.toLowerCase() ? 'white' : '#6B5E50' }}>Delete Store</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDeleteStore(false)} style={{ backgroundColor: '#0F0A06', borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2A1F14' }}>
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, color: '#9A8570' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}