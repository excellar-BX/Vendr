import { useState, useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, TextInput, Switch, Modal, Image, Dimensions,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { uploadFile, deleteFiles } from '../../lib/storage';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '../../components/ui/StyledText';
import { apiFetch } from '../../lib/api';
import { useVendrAlert } from '../../components/ui/VendrAlert';
import { T, useTheme } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_H = 160;
const REEL_SIZE = (SCREEN_WIDTH - 48) / 3;

interface Product {
  id: string;
  vendor_id: string; 
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

interface Store {
  id: string;
  user_id: string;
  shop_name: string;
  category: string;
  description?: string | null;
  address: string;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  twitter?: string | null;
  open_days: string[];
  open_time: string;
  close_time: string;
  logo_url?: string | null;
  banner_url?: string | null;
  is_active: boolean;
  is_verified: boolean;
  is_suspended: boolean;
  rating: number;
  review_count: number;
  product_count?: number;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
  };
}

interface ReelThumb {
  id: string;
  vendor_id: string;
  user_id: string;
  video_url: string;
  thumbnail_url?: string | null;
  caption?: string | null;
  product_id?: string | null;
  view_count: number;
  like_count: number;
  save_count: number;
  is_active: boolean;
  created_at: string;
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
  useTheme();
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const { alert, alertElement } = useVendrAlert();

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
      try {
        // Fetch vendor, products, and reels in parallel
        const [vendorRes, productsRes, reelsRes] = await Promise.all([
          apiFetch(`/vendors/${storeId}`),
          apiFetch(`/products?vendor_id=${storeId}&include_all=true`),
          apiFetch(`/reels?vendor_id=${storeId}`),
        ]);

        const vendorData = vendorRes.data;
        setStore(vendorData);
        setProducts(productsRes.data);
        setReels(reelsRes.data);

        // Check if vendor is suspended
        if (vendorData.is_suspended) {
          alert(
            'Account Suspended',
            'Your vendor account has been suspended and is under review. Please contact support for assistance.',
            [{ text: 'Go Back', onPress: () => router.back() }],
            { type: 'danger' }
          );
        }
      } catch (error: any) {
        Alert.alert('Error', error.message ?? 'Failed to load store data');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [storeId]));

  // ─── Banner Upload ──────────────────────────────────────────────────────
  const handleBannerUpload = async () => {
    const uri = await pickImage();
    if (!uri) return;
    try {
      setUploadingBanner(true);
      const path = `stores/${storeId}/banner_${Date.now()}.jpg`;
      const url = await uploadImage('vendor-images', path, uri);
      await apiFetch(`/vendors/${storeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ banner_url: url }),
      });
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
      const path = `stores/${storeId}/logo_${Date.now()}.jpg`;
      const url = await uploadImage('vendor-images', path, uri);
      await apiFetch(`/vendors/${storeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ logo_url: url }),
      });
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
    if (store?.is_suspended) {
      alert(
        'Account Suspended',
        'Your vendor account has been suspended and is under review. Please contact support for assistance.',
        undefined,
        { type: 'danger' }
      );
      return;
    }
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
    if (store?.is_suspended) {
      alert(
        'Account Suspended',
        'Your vendor account has been suspended and is under review. Please contact support for assistance.',
        undefined,
        { type: 'danger' }
      );
      return;
    }
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
        const path = `stores/${storeId}/products/${pid}_${Date.now()}.jpg`;
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
      description: pDesc.trim() || null,
      price,
      is_available: pAvailable,
      image_url: finalImageUrl ?? null,
    };

    try {
      if (editingProduct) {
        const res = await apiFetch(`/products/${editingProduct.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? res.data : p));
      } else {
        const res = await apiFetch(`/products`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setProducts(prev => [res.data, ...prev]);
      }
      setSaving(false);
      setShowAddProduct(false);
    } catch (error: any) {
      Alert.alert('Error', error.message);
      setSaving(false);
    }
  };

  const deleteProduct = (p: Product) => {
    Alert.alert('Delete product?', `Remove "${p.name}" from your store?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setProducts(prev => prev.filter(x => x.id !== p.id));
          await apiFetch(`/products/${p.id}`, { method: 'DELETE' });
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
            // Extract storage paths and delete files from R2
            const keysToDelete: string[] = [];
            const videoPath = reel.video_url.split('/reels/')[1];
            if (videoPath) {
              keysToDelete.push(`reels/${videoPath}`);
            }
            if (reel.thumbnail_url) {
              const thumbPath = reel.thumbnail_url.split('/reels/')[1];
              if (thumbPath) keysToDelete.push(`reels/${thumbPath}`);
            }

            if (keysToDelete.length > 0) {
              await apiFetch('/storage/files', {
                method: 'DELETE',
                body: JSON.stringify({ keys: keysToDelete }),
              });
            }

            // Delete reel record from backend
            await apiFetch(`/reels/${reel.id}`, { method: 'DELETE' });
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
    await apiFetch(`/vendors/${storeId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: newVal }),
    });
  };

  const toggleProductAvailable = async (p: Product) => {
    const newVal = !p.is_available;
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_available: newVal } : x));
    await apiFetch(`/products/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_available: newVal }),
    });
  };

  const handleDeleteStore = async () => {
    if (!store) return;
    if (deleteConfirmText.trim().toLowerCase() !== store.shop_name.toLowerCase()) return;
    try {
      setDeletingStore(true);
      // Backend handles cascade deactivation or deletion
      await apiFetch(`/vendors/${storeId}`, { method: 'DELETE' });
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
      await apiFetch(`/vendors/${storeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ category: cat }),
      });
      setStore(prev => prev ? { ...prev, category: cat } : null);
      setShowCategoryPicker(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingCategory(false);
    }
  };

  const inputStyle = {
    fontFamily: 'PlusJakartaSans_400Regular' as const,
    color: T.ink,
    fontSize: 15,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.lineStrong,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  };

  if (loading) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator size="large" color="#E8521A" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      {alertElement}
      <StatusBar style={T.statusBar} />

      {/* Header */}
      <View className="flex-row items-center px-5 pt-14 pb-4 border-b border-line gap-3">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-ink text-xl" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{store?.shop_name}</Text>
          <Text className="text-ink-2 text-xs">{store?.category}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/vendor/[id]', params: { id: storeId } })}
          className="w-9 h-9 bg-surface border border-line rounded-xl items-center justify-center"
        >
          <Ionicons name="eye-outline" size={18} color={T.ink2} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* ── Banner + Logo ── */}
        <View style={{ marginBottom: 60 }}>
          <TouchableOpacity activeOpacity={0.85} onPress={handleBannerUpload} style={{ height: BANNER_H }}>
            {store?.banner_url ? (
              <Image source={{ uri: store.banner_url }} style={{ width: '100%', height: BANNER_H }} resizeMode="cover" />
            ) : (
              <View style={{ width: '100%', height: BANNER_H, backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center', gap: 8, borderBottomWidth: 1, borderColor: T.line }}>
                <Ionicons name="image-outline" size={32} color={T.ink4} />
                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: T.ink3 }}>Tap to add banner</Text>
              </View>
            )}
            <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {uploadingBanner
                ? <ActivityIndicator size="small" color="white" />
                : <Ionicons name="camera" size={13} color="white" />}
              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: 'white' }}>
                {uploadingBanner ? 'Uploading…' : 'Edit banner'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={{ position: 'absolute', bottom: -44, left: 20 }}>
            <TouchableOpacity activeOpacity={0.85} onPress={handleLogoUpload}>
              <View style={{ width: 80, height: 80, borderRadius: 20, borderWidth: 3, borderColor: T.canvas, backgroundColor: T.surface, overflow: 'hidden', shadowColor: '#1C1917', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 8, elevation: 8 }}>
                {store?.logo_url ? (
                  <Image source={{ uri: store.logo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="storefront-outline" size={28} color={T.ink4} />
                  </View>
                )}
              </View>
              <View style={{ position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: '#E8521A', borderWidth: 2, borderColor: T.canvas, alignItems: 'center', justifyContent: 'center' }}>
                {uploadingLogo
                  ? <ActivityIndicator size="small" color="white" />
                  : <Ionicons name="camera" size={12} color="white" />}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 20 }}>

          {/* Store status card */}
          <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 20, padding: 16, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: T.ink }}>Store Status</Text>
                <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: T.ink2, marginTop: 2 }}>
                  {store?.is_active ? 'Customers can find and message you' : 'Your store is hidden from search'}
                </Text>
              </View>
              <Switch value={store?.is_active ?? false} onValueChange={toggleStoreActive} trackColor={{ false: T.ink4, true: '#E8521A' }} thumbColor="white" />
            </View>

            <View style={{ height: 1, backgroundColor: T.line }} />

            <TouchableOpacity onPress={() => setShowCategoryPicker(true)} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(232,82,26,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="pricetag-outline" size={16} color="#E8521A" />
                </View>
                <View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: T.ink3 }}>Category</Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: T.ink, marginTop: 1 }}>{store?.category}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={T.ink3} />
            </TouchableOpacity>

            {store?.is_verified && (
              <>
                <View style={{ height: 1, backgroundColor: T.line }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="shield-checkmark" size={16} color="#2D8653" />
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: T.successInk }}>Verified store</Text>
                </View>
              </>
            )}
            {store && store.review_count > 0 && (
              <>
                <View style={{ height: 1, backgroundColor: T.line }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="star" size={14} color="#F5A623" />
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.goldInk }}>
                    {store.rating?.toFixed(1)} · {store.review_count} review{store.review_count !== 1 ? 's' : ''}
                  </Text>
                </View>
              </>
            )}

            <View style={{ height: 1, backgroundColor: T.line }} />

            <TouchableOpacity onPress={() => { setDeleteConfirmText(''); setShowDeleteStore(true); }} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(232,85,85,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="trash-outline" size={16} color="#DC2626" />
              </View>
              <View>
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: T.dangerInk }}>Delete Store</Text>
                <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: T.ink3, marginTop: 1 }}>Permanently remove this store</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Tabs ── */}
          <View style={{ flexDirection: 'row', backgroundColor: T.surface, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: T.line }}>
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
                  fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13,
                  color: activeTab === tab ? 'white' : T.ink3,
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
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: 'white', fontSize: 14 }}>Add Product</Text>
              </TouchableOpacity>

              {products.length === 0 ? (
                <View className="bg-surface border border-line border-dashed rounded-2xl p-8 items-center gap-3">
                  <Ionicons name="cube-outline" size={32} color={T.ink4} />
                  <Text className="text-ink-2 text-sm text-center">No products yet. Add your first product to start selling.</Text>
                </View>
              ) : (
                products.map(p => (
                  <View key={p.id} className="bg-surface border border-line rounded-2xl overflow-hidden">
                    {p.image_url ? (
                      <Image source={{ uri: p.image_url }} style={{ width: '100%', height: 120 }} resizeMode="cover" />
                    ) : (
                      <View style={{ width: '100%', height: 72, backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="image-outline" size={24} color={T.ink4} />
                      </View>
                    )}
                    <View className="p-4 gap-2">
                      <View className="flex-row items-start gap-3">
                        <View className="flex-1">
                          <Text className="text-ink text-sm" style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>{p.name}</Text>
                          {p.description ? <Text className="text-ink-2 text-xs mt-0.5" numberOfLines={2}>{p.description}</Text> : null}
                          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: T.primaryInk, marginTop: 4 }}>{formatPrice(p.price)}</Text>
                        </View>
                      </View>
                      <View className="flex-row items-center justify-between pt-2 border-t border-line">
                        <View className="flex-row items-center gap-2">
                          <Switch value={p.is_available} onValueChange={() => toggleProductAvailable(p)} trackColor={{ false: T.ink4, true: '#E8521A' }} thumbColor="white" style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }} />
                          <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: p.is_available ? T.ink : T.ink3 }}>
                            {p.is_available ? 'Available' : 'Unavailable'}
                          </Text>
                        </View>
                        <View className="flex-row gap-2">
                          <TouchableOpacity onPress={() => openEditProduct(p)} className="w-8 h-8 bg-surface-2 border border-line rounded-xl items-center justify-center">
                            <Ionicons name="pencil-outline" size={14} color={T.ink2} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => deleteProduct(p)} className="w-8 h-8 bg-surface-2 border border-line rounded-xl items-center justify-center">
                            <Ionicons name="trash-outline" size={14} color="#DC2626" />
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
                onPress={() => {
                  if (store?.is_suspended) {
                    alert(
                      'Account Suspended',
                      'Your vendor account has been suspended and is under review. Please contact support for assistance.',
                      undefined,
                      { type: 'danger' }
                    );
                    return;
                  }
                  router.push('/reel-upload');
                }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#E8521A', borderRadius: 14, paddingVertical: 13 }}
              >
                <Ionicons name="add" size={18} color="white" />
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: 'white', fontSize: 14 }}>Upload Reel</Text>
              </TouchableOpacity>

              {reels.length === 0 ? (
                <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderStyle: 'dashed', borderRadius: 20, padding: 40, alignItems: 'center', gap: 12 }}>
                  <Ionicons name="videocam-outline" size={36} color={T.ink4} />
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: T.ink3 }}>No reels yet</Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: T.ink3, textAlign: 'center' }}>
                    Upload short videos to showcase your products and attract more customers.
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {reels.map((reel, idx) => (
                    <View key={reel.id} style={{ width: REEL_SIZE, height: REEL_SIZE * 1.5, borderRadius: 14, overflow: 'hidden', backgroundColor: T.surface }}>
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
                            <Ionicons name="play-circle-outline" size={28} color={T.ink4} />
                          </View>
                        )}
                        {/* View count */}
                        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 7, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="eye-outline" size={10} color="white" />
                          <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: 'white' }}>
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
                          : <Ionicons name="trash-outline" size={14} color="#DC2626" />}
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
        <View style={{ backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: T.line, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36 }}>
          <View style={{ width: 40, height: 4, backgroundColor: T.line, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: T.ink, textAlign: 'center', marginBottom: 20 }}>
            {editingProduct ? 'Edit Product' : 'Add Product'}
          </Text>

          <TouchableOpacity
            onPress={handlePickProductImage}
            activeOpacity={0.85}
            style={{ width: '100%', height: 140, borderRadius: 18, overflow: 'hidden', backgroundColor: T.canvas, borderWidth: 1, borderColor: T.lineStrong, borderStyle: (pImageUri || pImageUrl) ? 'solid' : 'dashed', marginBottom: 16, alignItems: 'center', justifyContent: 'center' }}
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
                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: T.ink3 }}>Add product photo</Text>
                <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: T.ink3 }}>Tap to choose from gallery</Text>
              </View>
            )}
            {(pImageUri || pImageUrl) && (
              <View style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="camera" size={12} color="white" />
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: 'white' }}>Change photo</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={{ gap: 12 }}>
            <TextInput value={pName} onChangeText={setPName} placeholder="Product name" placeholderTextColor={T.ink3} style={inputStyle} />
            <TextInput value={pDesc} onChangeText={setPDesc} placeholder="Description (optional)" placeholderTextColor={T.ink3} multiline style={[inputStyle, { height: 80, paddingTop: 14, textAlignVertical: 'top' }]} />
            <TextInput value={pPrice} onChangeText={setPPrice} placeholder="Price (₦)" placeholderTextColor={T.ink3} keyboardType="numeric" style={inputStyle} />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: T.canvas, borderWidth: 1, borderColor: T.line, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: T.ink }}>Available now</Text>
              <Switch value={pAvailable} onValueChange={setPAvailable} trackColor={{ false: T.ink4, true: '#E8521A' }} thumbColor="white" />
            </View>

            <TouchableOpacity
              onPress={saveProduct}
              disabled={saving || uploadingProductImg}
              style={{ backgroundColor: '#E8521A', borderRadius: 16, height: 56, alignItems: 'center', justifyContent: 'center', marginTop: 4, shadowColor: '#E8521A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 }}
            >
              {(saving || uploadingProductImg)
                ? <ActivityIndicator size="small" color="white" />
                : <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: 'white', fontSize: 16 }}>{editingProduct ? 'Save Changes' : 'Add Product'}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Category Picker Modal ── */}
      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} activeOpacity={1} onPress={() => setShowCategoryPicker(false)} />
        <View style={{ backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: T.line, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36 }}>
          <View style={{ width: 40, height: 4, backgroundColor: T.line, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: T.ink, textAlign: 'center', marginBottom: 20 }}>Change Category</Text>
          <View style={{ gap: 10 }}>
            {CATEGORIES.map(cat => {
              const active = store?.category === cat.label;
              return (
                <TouchableOpacity
                  key={cat.label}
                  onPress={() => handleChangeCategory(cat.label)}
                  activeOpacity={0.8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: active ? 'rgba(232,82,26,0.12)' : T.canvas, borderWidth: 1, borderColor: active ? '#E8521A' : T.line, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: active ? 'rgba(232,82,26,0.2)' : T.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={cat.icon} size={18} color={active ? '#E8521A' : T.ink2} />
                  </View>
                  <Text style={{ flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: active ? T.primaryInk : T.ink }}>{cat.label}</Text>
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
          <View style={{ backgroundColor: T.surface, borderRadius: 24, borderWidth: 1, borderColor: T.lineStrong, padding: 24 }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(232,85,85,0.12)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 }}>
              <Ionicons name="trash" size={26} color="#DC2626" />
            </View>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: T.ink, textAlign: 'center', marginBottom: 8 }}>Delete Store?</Text>
            <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: T.ink2, textAlign: 'center', lineHeight: 20, marginBottom: 20 }}>
              This will permanently delete <Text style={{ color: T.ink, fontFamily: 'PlusJakartaSans_600SemiBold' }}>{store?.shop_name}</Text>, all its products, and conversation history.
            </Text>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: T.ink3, marginBottom: 8 }}>
                Type <Text style={{ color: T.ink }}>{store?.shop_name}</Text> to confirm:
              </Text>
              <TextInput
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                placeholder={store?.shop_name}
                placeholderTextColor={T.ink4}
                autoCapitalize="none"
                style={{ fontFamily: 'PlusJakartaSans_400Regular', color: T.ink, fontSize: 15, backgroundColor: T.canvas, borderWidth: 1, borderColor: deleteConfirmText.trim().toLowerCase() === store?.shop_name.toLowerCase() ? '#DC2626' : T.lineStrong, borderRadius: 14, paddingHorizontal: 16, height: 52 }}
              />
            </View>

            <View style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={handleDeleteStore}
                disabled={deletingStore || deleteConfirmText.trim().toLowerCase() !== store?.shop_name.toLowerCase()}
                style={{ backgroundColor: deleteConfirmText.trim().toLowerCase() === store?.shop_name.toLowerCase() ? '#DC2626' : T.line, borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center' }}
              >
                {deletingStore
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: deleteConfirmText.trim().toLowerCase() === store?.shop_name.toLowerCase() ? 'white' : T.ink3 }}>Delete Store</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDeleteStore(false)} style={{ backgroundColor: T.canvas, borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.line }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: T.ink2 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}