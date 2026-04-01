import { useState, useEffect, useRef } from 'react';
import {
  View, ScrollView, TouchableOpacity, Image, Modal,
  Share, Animated, Dimensions, ActivityIndicator,
  TextInput as RNTextInput, Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/ui/StyledText';
import { useVendrAlert } from '../../components/ui/VendrAlert';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { formatDistance, formatPrice } from '../../lib/utils';
import { Vendor, Product } from '../../types';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const { width } = Dimensions.get('window');
const BANNER_HEIGHT = 260;
const HEADER_HEIGHT = 60;

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ product, onEnquire }: { product: Product; onEnquire: (p: Product) => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onEnquire(product)}
      className="bg-dark-3 border border-faint rounded-2xl overflow-hidden"
      style={{ width: (width - 56) / 2 }}
    >
      <View className="h-28 bg-dark-4 items-center justify-center">
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <Ionicons name="image-outline" size={32} color="#3D3026" />
        )}
      </View>
      <View className="p-3">
        <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }} numberOfLines={1}>
          {product.name}
        </Text>
        {product.description && (
          <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>{product.description}</Text>
        )}
        <Text className="text-orange text-sm mt-1.5" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
          {formatPrice(product.price)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Review Card ──────────────────────────────────────────────────────────────
function ReviewCard({ review, currentUserId, onDelete }: {
  review: any;
  currentUserId?: string;
  onDelete?: (id: string) => void;
}) {
  const isOwn = currentUserId && review.user_id === currentUserId;

  return (
    <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 20, padding: 16, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(232,82,26,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="person-outline" size={16} color="#E8521A" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }}>
              {review.reviewer_name ?? 'Anonymous'}
            </Text>
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#6B5E50' }}>
              {new Date(review.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 2 }}>
            {[1,2,3,4,5].map(i => (
              <Ionicons key={i} name={i <= review.rating ? 'star' : 'star-outline'} size={14} color="#F5A623" />
            ))}
          </View>
          {isOwn && onDelete && (
            <TouchableOpacity
              onPress={() => onDelete(review.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginLeft: 4 }}
            >
              <Ionicons name="trash-outline" size={16} color="#E85555" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {review.comment ? (
        <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570', lineHeight: 20 }}>
          {review.comment}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Star Picker ──────────────────────────────────────────────────────────────
function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', marginVertical: 8 }}>
      {[1,2,3,4,5].map(i => (
        <TouchableOpacity key={i} onPress={() => onChange(i)} activeOpacity={0.7}>
          <Ionicons name={i <= value ? 'star' : 'star-outline'} size={36} color="#F5A623" />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Write Review Modal ───────────────────────────────────────────────────────
function WriteReviewModal({
  visible, vendorName, existingReview, onClose, onSubmit,
}: {
  visible: boolean;
  vendorName: string;
  existingReview: any | null;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => Promise<void>;
}) {
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setRating(existingReview?.rating ?? 0);
      setComment(existingReview?.comment ?? '');
    }
  }, [visible, existingReview]);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    await onSubmit(rating, comment.trim());
    setSubmitting(false);
  };

  const labels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <View style={{
          backgroundColor: '#120E07', borderTopLeftRadius: 28, borderTopRightRadius: 28,
          borderWidth: 1, borderColor: '#2A1F14', padding: 24, paddingBottom: 40,
        }}>
          {/* Handle */}
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#3D3026', alignSelf: 'center', marginBottom: 20 }} />

          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC', textAlign: 'center', marginBottom: 4 }}>
            {existingReview ? 'Edit Your Review' : 'Write a Review'}
          </Text>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570', textAlign: 'center', marginBottom: 24 }}>
            {vendorName}
          </Text>

          {/* Stars */}
          <StarPicker value={rating} onChange={setRating} />
          {rating > 0 && (
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#F5A623', textAlign: 'center', marginTop: 4, marginBottom: 20 }}>
              {labels[rating]}
            </Text>
          )}
          {rating === 0 && <View style={{ height: 38 }} />}

          {/* Comment */}
          <View style={{
            backgroundColor: '#1A1208', borderWidth: 1,
            borderColor: comment ? '#E8521A' : '#2A1F14',
            borderRadius: 16, padding: 14, marginBottom: 20, minHeight: 100,
          }}>
            <RNTextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Share your experience (optional)..."
              placeholderTextColor="#6B5E50"
              multiline
              style={{ color: '#FDF6EC', fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, lineHeight: 22, backgroundColor: 'transparent' }}
            />
          </View>

          {/* Buttons */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{ flex: 1, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14' }}
            >
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, color: '#9A8570' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={rating === 0 || submitting}
              style={{
                flex: 2, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                backgroundColor: rating > 0 ? '#E8521A' : '#2A1F14',
                shadowColor: '#E8521A', shadowOffset: { width: 0, height: 4 },
                shadowOpacity: rating > 0 ? 0.3 : 0, shadowRadius: 10, elevation: rating > 0 ? 6 : 0,
              }}
            >
              {submitting
                ? <ActivityIndicator size="small" color="white" />
                : <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: rating > 0 ? 'white' : '#6B5E50' }}>
                    {existingReview ? 'Update Review' : 'Submit Review'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


// ─── Static Store Locator Map ─────────────────────────────────────────────────
function StoreLocatorMap({ lat, lng, vendorName }: { lat: number; lng: number; vendorName: string }) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; background:#0F0A06; }
    .leaflet-tile { filter: brightness(0.8) saturate(0.85); }
    .leaflet-control-zoom { display: none; }
    .leaflet-control-attribution { display: none; }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false }).setView([${lat}, ${lng}], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  var icon = L.divIcon({
    html: '<div style="display:flex;flex-direction:column;align-items:center;"><div style="width:32px;height:32px;background:#E8521A;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.5);"></div></div>',
    iconSize: [32, 32], iconAnchor: [16, 32], className: ''
  });
  L.marker([${lat}, ${lng}], { icon: icon }).addTo(map);
  var circle = L.circle([${lat}, ${lng}], { radius: 80, color: '#E8521A', fillColor: '#E8521A', fillOpacity: 0.08, weight: 1.5, opacity: 0.4 }).addTo(map);
</script>
</body>
</html>`;

  return (
    <View style={{ height: 180, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#2A1F14' }}>
      <WebView
        source={{ html }}
        style={{ flex: 1, backgroundColor: '#0F0A06' }}
        scrollEnabled={false}
        pointerEvents="none"
      />
      {/* Overlay label */}
      <View style={{
        position: 'absolute', bottom: 10, left: 10,
        backgroundColor: 'rgba(15,10,6,0.85)', borderRadius: 10,
        paddingHorizontal: 10, paddingVertical: 6,
        flexDirection: 'row', alignItems: 'center', gap: 6,
        borderWidth: 1, borderColor: '#2A1F14',
      }}>
        <Ionicons name="location" size={13} color="#E8521A" />
        <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12, color: '#FDF6EC' }} numberOfLines={1}>
          {vendorName}
        </Text>
      </View>
    </View>
  );
}

// ─── Info Row ─────────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value, iconColor = '#9A8570' }: {
  icon: IoniconsName; label: string; value: string; iconColor?: string;
}) {
  return (
    <View className="flex-row items-start gap-3 py-3">
      <View className="w-8 h-8 rounded-xl bg-dark-3 border border-faint items-center justify-center mt-0.5">
        <Ionicons name={icon} size={15} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text className="text-muted text-xs mb-0.5" style={{ fontFamily: 'SpaceGrotesk_500Medium' }}>
          {label}
        </Text>
        <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_500Medium' }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function VendorProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuthStore();
  const { showAlert: vendrAlert, alertElement } = useVendrAlert();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [ownerProfile, setOwnerProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [savingLoading, setSavingLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'reviews' | 'about' | 'reels'>('products');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [myReview, setMyReview] = useState<any | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      const [vendorRes, productsRes, reelsRes] = await Promise.all([
        supabase.from('vendors').select('*').eq('id', id).single(),
        supabase.from('products').select('*').eq('vendor_id', id).eq('is_available', true),
        supabase.from('reels').select('id, thumbnail_url, video_url, view_count, caption, vendor_id').eq('vendor_id', id).order('created_at', { ascending: false }),
      ]);

      // Fetch reviews separately — join profiles by user_id manually to avoid FK hint issues
      const { data: reviewsRaw, error: reviewsErr } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, user_id')
        .eq('vendor_id', id)
        .order('created_at', { ascending: false });

      if (reviewsErr) console.warn('Reviews fetch error:', reviewsErr.message);

      if (reviewsRaw && reviewsRaw.length > 0) {
        // Fetch reviewer names in one query
        const userIds = [...new Set(reviewsRaw.map((r: any) => r.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);
        const nameMap: Record<string, string> = {};
        (profilesData ?? []).forEach((p: any) => { nameMap[p.id] = p.name; });

        const flat = reviewsRaw.map((r: any) => ({
          ...r,
          reviewer_name: nameMap[r.user_id] ?? 'Anonymous',
        }));
        setReviews(flat);
        if (session?.user?.id) {
          setMyReview(flat.find((r: any) => r.user_id === session.user.id) ?? null);
        }
      }

      if (vendorRes.data) {
        setVendor(vendorRes.data);
        // Fetch owner profile using vendor.user_id
        const { data: ownerData } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, created_at')
          .eq('id', vendorRes.data.user_id)
          .single();
        if (ownerData) setOwnerProfile(ownerData);
      }
      if (productsRes.data) setProducts(productsRes.data);
      if (reelsRes.data) setReels(reelsRes.data);

      // Check if current user has saved this vendor
      if (session?.user?.id) {
        const { data: savedData } = await supabase
          .from('saved_vendors')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('vendor_id', id)
          .maybeSingle();
        setSaved(!!savedData);
      }

      setLoading(false);
    };
    fetchAll();
  }, [id]);

  const handleShare = async () => {
    await Share.share({
      message: `Check out ${vendor?.business_name} on Vendr! vendr://vendor/${id}`,
    });
  };

  const handleChat = () => {
    router.push({ pathname: '/chat/[conversationId]', params: { vendorId: id } });
  };

  const handleProductEnquire = (product: Product) => {
    if (isOwner) {
      router.push('/my-stores');
      return;
    }
    router.push({
      pathname: '/chat/[conversationId]',
      params: {
        vendorId: id,
        productId: product.id,
        productName: product.name,
        productPrice: formatPrice(product.price),
      },
    });
  };

  const handleToggleSave = async () => {
    if (!session?.user?.id) {
      vendrAlert({ title: 'Sign in required', message: 'You need to be logged in to save vendors.', type: 'warning' });
      return;
    }
    if (!vendor) return;
    // Don't allow owners to save their own store
    if (vendor.user_id === session.user.id) return;

    setSavingLoading(true);
    try {
      if (saved) {
        const { error } = await supabase
          .from('saved_vendors')
          .delete()
          .eq('user_id', session.user.id)
          .eq('vendor_id', vendor.id);
        if (error) throw error;
        setSaved(false);
      } else {
        const { error } = await supabase
          .from('saved_vendors')
          .insert({ user_id: session.user.id, vendor_id: vendor.id });
        if (error) throw error;
        setSaved(true);
      }
    } catch (e: any) {
      vendrAlert({ title: 'Could not save', message: e?.message ?? 'Something went wrong. Please try again.', type: 'danger' });
    } finally {
      setSavingLoading(false);
    }
  };

  // Owner check — vendor.user_id compared to logged-in user
  const isOwner = !!session?.user?.id && !!vendor && vendor.user_id === session.user.id;

  const handleSubmitReview = async (rating: number, comment: string) => {
    if (!session?.user?.id || !vendor) return;
    const { data, error } = await supabase
      .from('reviews')
      .insert({ vendor_id: id, user_id: session.user.id, rating, comment })
      .select('id, rating, comment, created_at, user_id')
      .single();
    if (!error && data) {
      const newReview = { ...data, reviewer_name: session.user.user_metadata?.name ?? 'You' };
      setMyReview(newReview);
      setReviews(prev => [newReview, ...prev]);
    }
    setShowReviewModal(false);
  };

  const handleDeleteReview = async (reviewId: string) => {
    vendrAlert({
      title: 'Delete Review?',
      message: 'This will remove your review and update the store rating.',
      type: 'danger',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
          if (!error) {
            setReviews(prev => prev.filter(r => r.id !== reviewId));
            setMyReview(null);
          }
        }},
      ],
    });
  };
  const headerBg = scrollY.interpolate({
    inputRange: [BANNER_HEIGHT - HEADER_HEIGHT - 20, BANNER_HEIGHT - HEADER_HEIGHT],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  if (loading) {
    return (
      <View className="flex-1 bg-dark items-center justify-center">
        <ActivityIndicator size="large" color="#E8521A" />
      </View>
    );
  }

  if (!vendor) {
    return (
      <View className="flex-1 bg-dark items-center justify-center gap-3 px-8">
        <Ionicons name="storefront-outline" size={48} color="#3D3026" />
        <Text className="text-cream text-lg text-center" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
          Vendor not found
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-orange text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
            Go back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />

      {/* Sticky animated header */}
      <Animated.View
        className="absolute top-0 left-0 right-0 z-10 flex-row items-center justify-between px-5"
        style={{
          paddingTop: 52,
          paddingBottom: 12,
          backgroundColor: scrollY.interpolate({
            inputRange: [BANNER_HEIGHT - 80, BANNER_HEIGHT - 40],
            outputRange: ['transparent', '#0F0A06'],
            extrapolate: 'clamp',
          }) as any,
        }}
      >
        <TouchableOpacity
          className="w-9 h-9 rounded-xl bg-dark-2/80 border border-faint items-center justify-center"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color="#FDF6EC" />
        </TouchableOpacity>

        <Animated.View style={{ opacity: headerBg }}>
          <Text className="text-cream text-base" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
            {vendor.business_name}
          </Text>
        </Animated.View>

        <TouchableOpacity
          className="w-9 h-9 rounded-xl bg-dark-2/80 border border-faint items-center justify-center"
          onPress={handleShare}
        >
          <Ionicons name="share-outline" size={18} color="#FDF6EC" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Banner + Logo */}
        <View style={{ marginBottom: vendor.logo_url ? 44 : 0 }}>
          <View style={{ height: BANNER_HEIGHT }} className="bg-dark-3 items-center justify-center">
            {vendor.banner_url ? (
              <Image source={{ uri: vendor.banner_url }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <View className="items-center gap-3">
                <View className="w-20 h-20 rounded-2xl bg-orange/20 border border-orange/30 items-center justify-center">
                  <Ionicons name="storefront-outline" size={40} color="#E8521A" />
                </View>
              </View>
            )}
          </View>
          {vendor.logo_url && (
            <View style={{ position: 'absolute', bottom: -40, left: 20 }}>
              <View style={{
                width: 72, height: 72, borderRadius: 18,
                borderWidth: 3, borderColor: '#0F0A06',
                overflow: 'hidden',
                shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
              }}>
                <Image source={{ uri: vendor.logo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </View>
            </View>
          )}
        </View>

        {/* Vendor info card */}
        <View className="mx-4 bg-dark-2 border border-faint rounded-3xl p-4 mb-4"
          style={{ marginTop: vendor.logo_url ? 0 : -24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 }}>

          <View className="flex-row items-start justify-between mb-3">
            <View className="flex-1 mr-3">
              <View className="flex-row items-center gap-2 mb-1">
                <Text className="text-cream text-xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
                  {vendor.business_name}
                </Text>
                {vendor.is_verified && (
                  <Ionicons name="checkmark-circle" size={18} color="#2D8653" />
                )}
              </View>

              <View className="flex-row items-center gap-1 mb-2">
                <Ionicons name="location-outline" size={13} color="#9A8570" />
                <Text className="text-muted text-xs">
                  {vendor.distance != null ? formatDistance(vendor.distance) : vendor.address ?? 'Nearby'}
                </Text>
              </View>

              {/* Category pill */}
              <View style={{ alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "#E8521A", flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="pricetag-outline" size={11} color="white" />
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12, color: 'white' }}>
                  {vendor.category}
                </Text>
              </View>
            </View>

            {/* Rating */}
            <View className="items-center bg-dark-3 border border-faint rounded-2xl px-3 py-2">
              <Ionicons name="star" size={16} color="#F5A623" />
              <Text className="text-cream text-sm mt-1" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
                {vendor.rating > 0 ? vendor.rating.toFixed(1) : 'New'}
              </Text>
              <Text className="text-muted text-xs">{vendor.review_count} reviews</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View className="flex-row gap-2 mt-1">
            {/* Chat — hidden for store owner */}
            {isOwner ? (
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/store/[storeId]', params: { storeId: id } })}
                activeOpacity={0.85}
                className="flex-1 bg-orange rounded-2xl py-3 flex-row items-center justify-center gap-2"
                style={{ shadowColor: '#E8521A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 }}
              >
                <Ionicons name="settings-outline" size={16} color="white" />
                <Text className="text-white text-sm" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
                  Manage Store
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleChat}
                activeOpacity={0.85}
                className="flex-1 bg-orange rounded-2xl py-3 flex-row items-center justify-center gap-2"
                style={{ shadowColor: '#E8521A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 }}
              >
                <Ionicons name="chatbubble-outline" size={16} color="white" />
                <Text className="text-white text-sm" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
                  Chat
                </Text>
              </TouchableOpacity>
            )}

            {/* Save + Share — hidden for owner */}
            {!isOwner && (
              <>
                <TouchableOpacity
                  onPress={handleToggleSave}
                  activeOpacity={0.85}
                  style={{
                    width: 48, height: 48, borderRadius: 16,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: saved ? 'rgba(245,166,35,0.15)' : '#1A1208',
                    borderWidth: 1,
                    borderColor: saved ? 'rgba(245,166,35,0.4)' : '#2A1F14',
                  }}
                >
                  {savingLoading
                    ? <ActivityIndicator size="small" color="#F5A623" />
                    : <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? '#F5A623' : '#9A8570'} />
                  }
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleShare}
                  activeOpacity={0.85}
                  style={{
                    width: 48, height: 48, borderRadius: 16,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
                  }}
                >
                  <Ionicons name="share-outline" size={20} color="#9A8570" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Tab bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 4 }}
          style={{ marginBottom: 12 }}
        >
          {(['products', 'reviews', 'about', 'reels'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16,
                backgroundColor: activeTab === tab ? '#E8521A' : '#1A1208',
                borderWidth: 1,
                borderColor: activeTab === tab ? '#E8521A' : '#2A1F14',
              }}
            >
              <Text style={{
                fontFamily: activeTab === tab ? 'SpaceGrotesk_600SemiBold' : 'SpaceGrotesk_400Regular',
                fontSize: 13,
                color: activeTab === tab ? 'white' : '#6B5E50',
              }}>
                {tab === 'products' ? 'Products'
                  : tab === 'reviews' ? `Reviews (${reviews.length})`
                  : tab === 'reels' ? `Reels (${reels.length})`
                  : 'About'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tab content */}
        <View className="px-4">

          {/* Products tab */}
          {activeTab === 'products' && (
            products.length === 0 ? (
              <View className="items-center py-12 gap-3">
                <View className="w-14 h-14 rounded-2xl bg-dark-2 border border-faint items-center justify-center">
                  <Ionicons name="cube-outline" size={28} color="#3D3026" />
                </View>
                <Text className="text-cream text-base" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
                  No products yet
                </Text>
                <Text className="text-muted text-sm text-center">
                  This vendor hasn't listed any products yet.
                </Text>
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-4">
                {products.map(p => <ProductCard key={p.id} product={p} onEnquire={handleProductEnquire} />)}
              </View>
            )
          )}

          {/* Reviews tab */}
          {activeTab === 'reviews' && (
            <View>
              {/* Write review — hidden for owner */}
              {!isOwner && !myReview && (
                <TouchableOpacity
                  onPress={() => setShowReviewModal(true)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 8, marginBottom: 16, paddingVertical: 14, borderRadius: 16,
                    backgroundColor: 'rgba(232,82,26,0.1)',
                    borderWidth: 1, borderColor: 'rgba(232,82,26,0.3)',
                  }}
                >
                  <Ionicons name="star-outline" size={18} color="#E8521A" />
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#E8521A' }}>
                    Write a Review
                  </Text>
                </TouchableOpacity>
              )}

              {/* Already reviewed — static badge, no tap */}
              {!isOwner && myReview && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 8, marginBottom: 16, paddingVertical: 12, borderRadius: 16,
                  backgroundColor: 'rgba(245,166,35,0.08)',
                  borderWidth: 1, borderColor: 'rgba(245,166,35,0.2)',
                }}>
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    {[1,2,3,4,5].map(i => (
                      <Ionicons key={i} name={i <= myReview.rating ? 'star' : 'star-outline'} size={14} color="#F5A623" />
                    ))}
                  </View>
                  <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, color: '#F5A623' }}>
                    Your review
                  </Text>
                </View>
              )}

              {reviews.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="star-outline" size={26} color="#3D3026" />
                  </View>
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, color: '#FDF6EC' }}>No reviews yet</Text>
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570', textAlign: 'center' }}>
                    {isOwner ? 'Reviews from buyers will appear here.' : 'Be the first to leave a review.'}
                  </Text>
                </View>
              ) : (
                reviews.map(r => <ReviewCard key={r.id} review={r} currentUserId={session?.user?.id} onDelete={handleDeleteReview} />)
              )}
            </View>
          )}

          {/* About tab */}
          {activeTab === 'about' && (
            <View className="gap-4">
              <View className="bg-dark-2 border border-faint rounded-3xl overflow-hidden">
              {vendor.description && (
                <View className="p-4 border-b border-faint">
                  <Text className="text-muted text-xs mb-1.5" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
                    ABOUT
                  </Text>
                  <Text className="text-cream text-sm leading-relaxed">{vendor.description}</Text>
                </View>
              )}
              <View className="px-4 divide-y divide-faint">
                <InfoRow icon="pricetag-outline" label="Category" value={vendor.category} iconColor="#E8521A" />
                <View className="h-px bg-faint" />
                {vendor.address && (
                  <>
                    <InfoRow icon="location-outline" label="Address" value={vendor.address} iconColor="#2D8653" />
                    <View className="h-px bg-faint" />
                  </>
                )}
                <InfoRow
                  icon="ellipse"
                  label="Status"
                  value={vendor.is_active ? 'Open now' : 'Closed'}
                  iconColor={vendor.is_active ? '#2D8653' : '#9A8570'}
                />
                {vendor.is_verified && (
                  <>
                    <View className="h-px bg-faint" />
                    <InfoRow icon="shield-checkmark-outline" label="Verification" value="Verified vendor" iconColor="#2D8653" />
                  </>
                )}
              </View>
            </View>

            {/* Store Locator Map */}
            {vendor.lat && vendor.lng && (
              <View style={{ marginTop: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: '#9A8570', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                    Store Location
                  </Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${vendor.lat},${vendor.lng}`)}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 5,
                      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
                      backgroundColor: 'rgba(232,82,26,0.1)',
                      borderWidth: 1, borderColor: 'rgba(232,82,26,0.3)',
                    }}
                  >
                    <Ionicons name="navigate-outline" size={13} color="#E8521A" />
                    <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12, color: '#E8521A' }}>
                      Open in Maps
                    </Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${vendor.lat},${vendor.lng}`)}
                >
                  <StoreLocatorMap lat={vendor.lat} lng={vendor.lng} vendorName={vendor.business_name} />
                </TouchableOpacity>
                {vendor.address && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <Ionicons name="location-outline" size={13} color="#6B5E50" />
                    <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50', flex: 1 }}>
                      {vendor.address}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Seller card */}
            {ownerProfile && (
              <View className="bg-dark-2 border border-faint rounded-3xl p-4 mt-4">
                <Text className="text-muted text-xs mb-3 tracking-widest uppercase" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
                  Sold by
                </Text>
                <View className="flex-row items-center gap-4">
                  {/* Avatar */}
                  {ownerProfile.avatar_url ? (
                    <Image
                      source={{ uri: ownerProfile.avatar_url }}
                      style={{ width: 52, height: 52, borderRadius: 14, borderWidth: 2, borderColor: '#2A1F14' }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(232,82,26,0.15)', borderWidth: 1, borderColor: 'rgba(232,82,26,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#E8521A' }}>
                        {(ownerProfile.name ?? 'V').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </Text>
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-cream text-base" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
                      {ownerProfile.name ?? 'Vendor'}
                    </Text>
                    <View className="flex-row items-center gap-1.5 mt-1">
                      <Ionicons name="calendar-outline" size={12} color="#6B5E50" />
                      <Text className="text-muted text-xs">
                        Member since {new Date(ownerProfile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                      </Text>
                    </View>
                    {vendor.is_verified && (
                      <View className="flex-row items-center gap-1 mt-1">
                        <Ionicons name="shield-checkmark" size={12} color="#2D8653" />
                        <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 11, color: '#2D8653' }}>Verified seller</Text>
                      </View>
                    )}
                  </View>
                  {!isOwner && (
                    <TouchableOpacity
                      onPress={handleChat}
                      className="bg-orange/15 border border-orange/30 rounded-xl px-3 py-2"
                    >
                      <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12, color: '#E8521A' }}>Chat</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
            </View>
          )}

          {/* Reels tab */}
          {activeTab === 'reels' && (
            <View>
              {reels.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 48, gap: 12 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="videocam-outline" size={26} color="#3D3026" />
                  </View>
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, color: '#FDF6EC' }}>No reels yet</Text>
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570', textAlign: 'center' }}>
                    This vendor hasn't posted any reels yet.
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {reels.map((reel, idx) => (
                    <TouchableOpacity
                      key={reel.id}
                      activeOpacity={0.85}
                      onPress={() => router.push({
                        pathname: '/reel/[reelId]',
                        params: { reelId: reel.id, vendorId: reel.vendor_id, startIndex: String(idx) },
                      })}
                      style={{ width: (width - 56) / 3, height: ((width - 56) / 3) * 1.5, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1A1208' }}
                    >
                      {reel.thumbnail_url ? (
                        <Image source={{ uri: reel.thumbnail_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="play-circle-outline" size={28} color="#3D3026" />
                        </View>
                      )}
                      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 7, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="eye-outline" size={10} color="white" />
                        <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 10, color: 'white' }}>
                          {reel.view_count > 999 ? `${(reel.view_count / 1000).toFixed(1)}k` : reel.view_count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

        </View>
      </Animated.ScrollView>

      {/* Review Modal */}
      <WriteReviewModal
        visible={showReviewModal}
        vendorName={vendor?.business_name ?? ''}
        existingReview={null}
        onClose={() => setShowReviewModal(false)}
        onSubmit={handleSubmitReview}
      />

      {alertElement}
    </View>
  );
}