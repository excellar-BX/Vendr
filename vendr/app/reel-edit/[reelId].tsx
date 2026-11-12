import { useEffect, useState } from 'react';
import {
  View, ScrollView, TouchableOpacity, Image, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/ui/StyledText';
import { useVendrAlert } from '../../components/ui/VendrAlert';
import { CaptionEditor } from '../../components/reel/CaptionEditor';
import { FeedReel, normalizeReel, editMinutesLeft, emitReelUpdated } from '../../components/reel/ReelViewer';
import { useAuthStore } from '../../stores/authStore';
import { reelApi, productApi } from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import { T, useTheme } from '../../constants/theme';

const MAX_CAPTION = 300;

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
}

/** Edit a post's caption (hashtags) and tagged product — allowed for 15 minutes after posting. */
export default function ReelEditScreen() {
  useTheme();
  const { reelId } = useLocalSearchParams<{ reelId: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { showAlert, alertElement } = useVendrAlert();

  const [reel, setReel] = useState<FeedReel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [, setTick] = useState(0);

  // Re-render every 15s so the countdown stays honest
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!reelId) return;
    (async () => {
      try {
        const { data } = await reelApi.getReel(reelId);
        const r = normalizeReel(data);
        if (r.user_id !== user?.id) {
          setLoadError('You can only edit your own posts.');
          return;
        }
        setReel(r);
        setCaption(r.caption ?? '');
        setProductId(r.product_id);
        productApi.getProducts(r.vendor_id)
          .then(({ data: ps }: any) => setProducts((ps ?? []).map((p: any) => ({ id: p.id, name: p.name, price: p.price, image_url: p.image_url }))))
          .catch(() => {});
      } catch (e: any) {
        setLoadError(e?.statusCode === 404 ? 'This post no longer exists.' : "Couldn't load this post. Check your connection.");
      }
    })();
  }, [reelId, user?.id]);

  const minsLeft = reel ? editMinutesLeft(reel) : 0;
  const locked = !!reel && minsLeft === 0;
  const selected = products.find((p) => p.id === productId)
    ?? (reel && productId === reel.product_id && reel.product_name
      ? { id: productId!, name: reel.product_name, price: reel.product_price ?? 0, image_url: reel.product_image }
      : null);
  const changed = !!reel && (caption.trim() !== (reel.caption ?? '').trim() || productId !== reel.product_id);

  const save = async () => {
    if (!reel || !changed || locked) return;
    setSaving(true);
    try {
      const { data } = await reelApi.updateReel(reel.id, {
        caption: caption.trim() || null,
        product_id: productId,
      });
      emitReelUpdated(normalizeReel(data));
      router.back();
    } catch (e: any) {
      showAlert({
        title: "Couldn't save",
        message: e?.statusCode ? (e?.message ?? 'Please try again.') : 'Check your connection and try again.',
        type: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: insets.top + 8, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: T.line }}>
      <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 8, paddingVertical: 8 }}>
        <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.ink2 }}>Cancel</Text>
      </TouchableOpacity>
      <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>Edit post</Text>
      <TouchableOpacity
        onPress={save}
        disabled={!changed || saving || locked}
        style={{ paddingHorizontal: 14, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: changed && !locked ? T.primary : T.surface2 }}
      >
        {saving
          ? <ActivityIndicator size="small" color={T.onPrimary} />
          : <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: changed && !locked ? T.onPrimary : T.ink4 }}>Save</Text>}
      </TouchableOpacity>
    </View>
  );

  if (!reel) {
    return (
      <View style={{ flex: 1, backgroundColor: T.canvas }}>
        <StatusBar style={T.statusBar} />
        {header}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 10 }}>
          {loadError
            ? <><Ionicons name="alert-circle-outline" size={36} color={T.ink4} /><Text style={{ fontSize: 15, color: T.ink, textAlign: 'center' }}>{loadError}</Text></>
            : <ActivityIndicator color={T.primary} />}
        </View>
      </View>
    );
  }

  const filtered = products.filter((p) => p.name.toLowerCase().includes(productSearch.trim().toLowerCase()));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style={T.statusBar} />
      {header}

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
        {/* Edit window */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, marginBottom: 18,
          backgroundColor: locked ? T.dangerSoft : T.goldSoft,
        }}>
          <Ionicons name={locked ? 'lock-closed' : 'time-outline'} size={18} color={locked ? T.dangerInk : T.goldInk} />
          <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: locked ? T.dangerInk : T.goldInk, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
            {locked
              ? 'The 15-minute edit window has closed. Delete the post and post it again to make changes.'
              : `You can edit for ${minsLeft} more minute${minsLeft === 1 ? '' : 's'}. Photos and video can't be changed.`}
          </Text>
        </View>

        {/* What's being edited */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <View style={{ width: 64, height: 86, borderRadius: 12, overflow: 'hidden', backgroundColor: T.surface2 }}>
            {reel.thumbnail_url && <Image source={{ uri: reel.thumbnail_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />}
            <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 6, padding: 3 }}>
              <Ionicons name={reel.media_type === 'photo' ? 'albums' : 'play'} size={11} color="white" />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>
              {reel.media_type === 'photo' ? `Photo post · ${reel.image_urls.length} photo${reel.image_urls.length === 1 ? '' : 's'}` : 'Video post'}
            </Text>
            <Text style={{ fontSize: 13, color: T.ink3, marginTop: 2 }}>Posted to {reel.vendor_name}</Text>
          </View>
        </View>

        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink3, letterSpacing: 1, marginBottom: 8 }}>CAPTION</Text>
        <View pointerEvents={locked ? 'none' : 'auto'} style={{ opacity: locked ? 0.5 : 1 }}>
          <CaptionEditor value={caption} onChange={setCaption} maxLength={MAX_CAPTION} />
        </View>

        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink3, letterSpacing: 1, marginTop: 20, marginBottom: 8 }}>TAGGED PRODUCT</Text>
        <View pointerEvents={locked ? 'none' : 'auto'} style={{ opacity: locked ? 0.5 : 1 }}>
          {selected ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: T.primarySoft, borderWidth: 1, borderColor: T.primaryBorder, marginBottom: 10 }}>
              {selected.image_url
                ? <Image source={{ uri: selected.image_url }} style={{ width: 46, height: 46, borderRadius: 11 }} />
                : <View style={{ width: 46, height: 46, borderRadius: 11, backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="cube-outline" size={20} color={T.ink4} /></View>}
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.ink }}>{selected.name}</Text>
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: T.primaryInk }}>{formatPrice(selected.price)}</Text>
              </View>
              <TouchableOpacity onPress={() => setProductId(null)} hitSlop={10} accessibilityLabel="Remove tagged product">
                <Ionicons name="close-circle" size={22} color={T.ink3} />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={{ fontSize: 13, color: T.ink3, marginBottom: 10 }}>No product tagged. Pick one to add a “Chat to buy” button.</Text>
          )}

          {products.length > 0 && (
            <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 16, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line }}>
                <Ionicons name="search-outline" size={16} color={T.ink3} />
                <TextInput
                  value={productSearch}
                  onChangeText={setProductSearch}
                  placeholder={`Search ${products.length} product${products.length === 1 ? '' : 's'}`}
                  placeholderTextColor={T.ink4}
                  style={{ flex: 1, color: T.ink, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13.5, paddingVertical: 0 }}
                />
              </View>
              {filtered.slice(0, 30).map((p, i, arr) => {
                const isSel = p.id === productId;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setProductId(isSel ? null : p.id)}
                    activeOpacity={0.75}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: T.line, backgroundColor: isSel ? T.primarySoft : 'transparent' }}
                  >
                    {p.image_url
                      ? <Image source={{ uri: p.image_url }} style={{ width: 42, height: 42, borderRadius: 10 }} />
                      : <View style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: T.surface2, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="cube-outline" size={18} color={T.ink4} /></View>}
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.ink }}>{p.name}</Text>
                      <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: T.primaryInk }}>{formatPrice(p.price)}</Text>
                    </View>
                    <Ionicons name={isSel ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={isSel ? T.primary : T.ink4} />
                  </TouchableOpacity>
                );
              })}
              {filtered.length === 0 && <Text style={{ padding: 16, fontSize: 13, color: T.ink3, textAlign: 'center' }}>No products match “{productSearch}”</Text>}
            </View>
          )}
        </View>
      </ScrollView>
      {alertElement}
    </KeyboardAvoidingView>
  );
}
