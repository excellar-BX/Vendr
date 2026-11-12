import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  View, FlatList, TouchableOpacity, TextInput, Image, Platform, Keyboard,
  ActivityIndicator, Dimensions, Modal, KeyboardAvoidingView, Pressable, StatusBar, AppState,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming, withDelay, withSequence,
  FadeIn, FadeOut, FadeInDown, FadeOutDown, ZoomIn, runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Text } from '../../components/ui/StyledText';
import { ChatAvatar } from '../../components/chat/ChatAvatar';
import { useVendrAlert } from '../../components/ui/VendrAlert';
import { chatApi, analyticsApi } from '../../lib/api';
import { onSocketEvent, onSocketStatus, joinConversation, leaveConversation, emitTyping, SocketStatus } from '../../lib/socket';
import { loadChat, peekChat, saveChatMeta, saveChatMessages, ChatMeta } from '../../lib/chatCache';
import { enqueueOutbox, removeFromOutbox, pendingForConversation, subscribeOutbox, isTransientError } from '../../lib/chatOutbox';
import { useAuthStore } from '../../stores/authStore';
import { usePresenceStore, usePresence, useIsTyping, formatLastSeen, useNow } from '../../stores/presenceStore';
import { markConversationReadLocally, conversationsKey, ConversationItem, getOtherName, getOtherAvatar, getOtherUserId } from '../../hooks/useConversations';
import { T, useTheme } from '../../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const REACTION_EMOJIS = ['❤️', '😂', '👍', '🔥', '😮', '😢'];
const PAGE_SIZE = 40;
const BUYER_QUICK_REPLIES = ['Hi! Is this available? 👋', 'How much is it?', 'Do you deliver?', 'Where are you located?'];

// ── Types ──────────────────────────────────────────────────────────────────
interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

interface ReplyPreview {
  id: string;
  sender_id: string;
  sender_name: string | null;
  content: string | null;
  image_url: string | null;
  type: string;
}

interface PaymentRequest {
  id: string;
  vendor_id: string;
  buyer_id: string;
  conversation_id: string | null;
  amount: number;
  delivery_fee?: number;
  is_delivery?: boolean;
  delivery_address?: string | null;
  description: string | null;
  status: 'pending' | 'paid' | 'cancelled' | 'expired' | string;
  paid_at?: string | null;
  created_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  type: 'text' | 'image' | 'payment_request';
  is_read: boolean;
  delivered: boolean;
  edited: boolean;
  deleted: boolean;
  reply_to_id: string | null;
  reply_to: ReplyPreview | null;
  reactions: Reaction[];
  created_at: string;
  payment_request?: PaymentRequest | null;
  // client-only
  client_id?: string | null;
  failed?: boolean;
  local_uri?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const looksLikeConversationId = (s?: string) => !!s && s !== '[conversationId]' && s !== 'new' && s.includes('-');
const newClientId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const isPending = (m: Message) => m.id.startsWith('temp-');

function formatTime(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatAmount(n: number) {
  return '₦' + (n ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function getDateLabel(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** Confirmed messages in time order, with still-sending ones kept at the end. */
function normalize(list: Message[]): Message[] {
  const confirmed = list.filter((m) => !isPending(m)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const pending = list.filter(isPending);
  return [...confirmed, ...pending];
}

/** Insert or merge a message from the server, reconciling optimistic bubbles. */
function upsertMessage(list: Message[], incoming: Message): Message[] {
  const tempIdx = incoming.client_id ? list.findIndex((m) => m.id === incoming.client_id) : -1;
  const realIdx = list.findIndex((m) => m.id === incoming.id);

  if (tempIdx !== -1) {
    const temp = list[tempIdx];
    const next = list.filter((_, i) => i !== tempIdx && i !== realIdx);
    next.push({
      ...incoming,
      reactions: incoming.reactions ?? [],
      reply_to: incoming.reply_to ?? temp.reply_to,
      failed: false,
    });
    return normalize(next);
  }

  if (realIdx !== -1) {
    const cur = list[realIdx];
    const next = [...list];
    next[realIdx] = {
      ...cur,
      ...incoming,
      reactions: incoming.reactions ?? cur.reactions,
      reply_to: incoming.reply_to ?? cur.reply_to,
      payment_request: incoming.payment_request ?? cur.payment_request,
      // receipts never go backwards
      is_read: cur.is_read || incoming.is_read,
      delivered: cur.delivered || incoming.delivered,
    };
    return next;
  }

  return normalize([...list, { ...incoming, reactions: incoming.reactions ?? [] }]);
}

/** Merge the freshest page into what we have, keeping older pages and unsent bubbles. */
function mergeLatest(prev: Message[], fresh: Message[]): Message[] {
  const freshIds = new Set(fresh.map((m) => m.id));
  const oldest = fresh[0]?.created_at;
  const older = oldest ? prev.filter((m) => !isPending(m) && !freshIds.has(m.id) && m.created_at < oldest) : [];
  const pending = prev.filter(isPending);
  return [...older, ...fresh.map((m) => ({ ...m, reactions: m.reactions ?? [] })), ...pending];
}

function useStableCallback<A extends any[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: A) => ref.current(...args), []);
}

// ── Typing Indicator ───────────────────────────────────────────────────────
const TypingDot = memo(function TypingDot({ delay }: { delay: number }) {
  useTheme();
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(delay, withRepeat(
      withSequence(withTiming(-4, { duration: 220 }), withTiming(0, { duration: 220 })),
      -1, false
    ));
  }, [delay]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: T.ink4, marginHorizontal: 2 }, style]} />;
});

const TypingBubble = memo(function TypingBubble() {
  useTheme();
  return (
    <Animated.View
      entering={FadeInDown.duration(160)}
      exiting={FadeOut.duration(120)}
      style={{ paddingHorizontal: 12, paddingTop: 2, paddingBottom: 6, alignItems: 'flex-start' }}
    >
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: T.surface, borderWidth: 1, borderColor: T.line,
        borderRadius: 18, borderBottomLeftRadius: 6,
        paddingHorizontal: 14, paddingVertical: 13,
      }}>
        <TypingDot delay={0} />
        <TypingDot delay={150} />
        <TypingDot delay={300} />
      </View>
    </Animated.View>
  );
});

// ── Separators ─────────────────────────────────────────────────────────────
const DateSeparator = memo(function DateSeparator({ label }: { label: string }) {
  useTheme();
  return (
    <View style={{ alignItems: 'center', marginVertical: 14 }}>
      <View style={{ backgroundColor: T.surface, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: T.line }}>
        <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.ink3 }}>{label}</Text>
      </View>
    </View>
  );
});

const UnreadSeparator = memo(function UnreadSeparator() {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10, paddingHorizontal: 16, gap: 10 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: T.primaryBorder }} />
      <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: T.primaryInk, letterSpacing: 0.3 }}>
        UNREAD MESSAGES
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: T.primaryBorder }} />
    </View>
  );
});

// ── Reply Quote inside bubble ──────────────────────────────────────────────
const ReplyQuote = memo(function ReplyQuote({ replyTo, isMine, myId, otherName }: {
  replyTo: ReplyPreview; isMine: boolean; myId: string; otherName: string;
}) {
  useTheme();
  const who = replyTo.sender_id === myId ? 'You' : (replyTo.sender_name || otherName);
  return (
    <View style={{
      backgroundColor: isMine ? 'rgba(255,255,255,0.18)' : T.surface2,
      borderLeftWidth: 3, borderLeftColor: isMine ? '#FFFFFF' : T.primary,
      borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, marginBottom: 6,
    }}>
      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: isMine ? '#FFFFFF' : T.primaryInk, marginBottom: 1 }}>
        {who}
      </Text>
      {replyTo.type === 'image' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="image-outline" size={12} color={isMine ? 'rgba(255,255,255,0.85)' : T.ink3} />
          <Text style={{ fontSize: 12.5, color: isMine ? 'rgba(255,255,255,0.85)' : T.ink3 }}>Photo</Text>
        </View>
      ) : (
        <Text numberOfLines={2} style={{ fontSize: 12.5, color: isMine ? 'rgba(255,255,255,0.85)' : T.ink3 }}>
          {replyTo.type === 'payment_request' ? 'Payment request' : replyTo.content ?? 'Message deleted'}
        </Text>
      )}
    </View>
  );
});

// ── Reaction Pill Row ──────────────────────────────────────────────────────
const ReactionRow = memo(function ReactionRow({ reactions, myId, onPress }: {
  reactions: Reaction[]; myId: string; onPress: (emoji: string) => void;
}) {
  useTheme();
  if (!reactions?.length) return null;
  const grouped: Record<string, { count: number; mine: boolean }> = {};
  reactions.forEach((r) => {
    if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, mine: false };
    grouped[r.emoji].count++;
    if (r.user_id === myId) grouped[r.emoji].mine = true;
  });
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: -6, paddingHorizontal: 6 }}>
      {Object.entries(grouped).map(([emoji, { count, mine }]) => (
        <TouchableOpacity
          key={emoji}
          onPress={() => onPress(emoji)}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 3,
            backgroundColor: mine ? T.primarySoft : T.surface,
            borderWidth: 1, borderColor: mine ? T.primaryBorder : T.line,
            borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2,
          }}
        >
          <Text style={{ fontSize: 13 }}>{emoji}</Text>
          {count > 1 && <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: mine ? T.primaryInk : T.ink3 }}>{count}</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
});

// ── Swipe Reply Indicator ──────────────────────────────────────────────────
const SwipeReplyIcon = memo(function SwipeReplyIcon({ translateX, isMine }: {
  translateX: SharedValue<number>; isMine: boolean;
}) {
  useTheme();
  const style = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.abs(translateX.value) / 55);
    return { opacity: progress, transform: [{ scale: 0.6 + progress * 0.4 }] };
  });
  return (
    <Animated.View style={[{
      position: 'absolute', [isMine ? 'right' : 'left']: -38,
      top: '50%', marginTop: -15, width: 30, height: 30, borderRadius: 15,
      backgroundColor: T.surface, borderWidth: 1, borderColor: T.line,
      alignItems: 'center', justifyContent: 'center',
    }, style]}>
      <Ionicons name="arrow-undo" size={14} color={T.primary} />
    </Animated.View>
  );
});

// ── Status ticks ───────────────────────────────────────────────────────────
function Ticks({ msg, onBubble }: { msg: Message; onBubble: boolean }) {
  useTheme();
  if (msg.failed) return <Ionicons name="alert-circle" size={13} color={onBubble ? '#FFFFFF' : T.danger} />;
  if (isPending(msg)) return <Ionicons name="time-outline" size={12} color={onBubble ? 'rgba(255,255,255,0.75)' : T.ink4} />;
  const read = msg.is_read;
  const double = read || msg.delivered;
  const color = onBubble ? (read ? '#FFFFFF' : 'rgba(255,255,255,0.6)') : (read ? T.info : T.ink4);
  return <Ionicons name={double ? 'checkmark-done' : 'checkmark'} size={14} color={color} />;
}

// ── Message Bubble ─────────────────────────────────────────────────────────
const MessageBubble = memo(function MessageBubble({
  msg, isMine, isFirstInGroup, isLastInGroup, myId, otherName, animate,
  onLongPress, onPress, onImagePress, onSwipeReply, onReactionPress,
  isSelected, selectionMode,
}: {
  msg: Message; isMine: boolean;
  isFirstInGroup: boolean; isLastInGroup: boolean;
  myId: string; otherName: string; animate: boolean;
  onLongPress: (msg: Message, pageY: number) => void;
  onPress: (msg: Message) => void;
  onImagePress: (url: string) => void;
  onSwipeReply: (msg: Message) => void;
  onReactionPress: (messageId: string, emoji: string) => void;
  isSelected: boolean; selectionMode: boolean;
}) {
  useTheme();
  const translateX = useSharedValue(0);
  const hasTriggered = useSharedValue(false);
  const bubbleRef = useRef<View>(null);
  const canSwipe = !msg.deleted && !isPending(msg) && !selectionMode;

  const swipeGesture = Gesture.Pan()
    .enabled(canSwipe)
    .activeOffsetX(isMine ? [-18, 999] : [-999, 18])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      translateX.value = isMine ? Math.max(-64, Math.min(0, e.translationX)) : Math.max(0, Math.min(64, e.translationX));
      const triggered = Math.abs(translateX.value) >= 50;
      if (triggered && !hasTriggered.value) {
        hasTriggered.value = true;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      }
      if (!triggered) hasTriggered.value = false;
    })
    .onEnd(() => {
      if (Math.abs(translateX.value) >= 50) runOnJS(onSwipeReply)(msg);
      translateX.value = withSpring(0, { damping: 16, stiffness: 380 });
    });

  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  const handleLongPress = () => {
    if (msg.deleted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    bubbleRef.current?.measureInWindow((_x, y) => onLongPress(msg, y));
  };

  const align = isMine ? 'flex-end' : 'flex-start';
  const marginBottom = isLastInGroup ? 8 : 2;

  if (msg.deleted) {
    return (
      <View style={{ alignItems: align, paddingHorizontal: 12, marginBottom }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          borderWidth: 1, borderColor: T.line, borderStyle: 'dashed',
          borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8,
        }}>
          <Ionicons name="ban-outline" size={13} color={T.ink4} />
          <Text style={{ fontSize: 13, color: T.ink3, fontStyle: 'italic' }}>
            {isMine ? 'You deleted this message' : 'This message was deleted'}
          </Text>
        </View>
      </View>
    );
  }

  const r = 20;
  const tight = 6;
  const radii = isMine
    ? { borderTopLeftRadius: r, borderBottomLeftRadius: r, borderTopRightRadius: isFirstInGroup ? r : tight, borderBottomRightRadius: isLastInGroup ? r : tight }
    : { borderTopRightRadius: r, borderBottomRightRadius: r, borderTopLeftRadius: isFirstInGroup ? r : tight, borderBottomLeftRadius: isLastInGroup ? r : tight };

  const imageUri = msg.image_url || msg.local_uri;
  const pending = isPending(msg);

  return (
    <View style={{ backgroundColor: isSelected ? T.primarySoft : 'transparent' }}>
      <GestureDetector gesture={swipeGesture}>
        <Animated.View
          entering={animate ? FadeInDown.duration(180) : undefined}
          style={[{ paddingHorizontal: 12, marginBottom, alignItems: align }, animStyle]}
        >
          <View style={{ maxWidth: SCREEN_WIDTH * 0.78, position: 'relative' }}>
            <SwipeReplyIcon translateX={translateX} isMine={isMine} />

            <Pressable
              ref={bubbleRef as any}
              onPress={() => onPress(msg)}
              onLongPress={handleLongPress}
              delayLongPress={280}
            >
              {msg.type === 'image' && imageUri ? (
                <View style={{
                  ...radii, overflow: 'hidden',
                  backgroundColor: isMine ? T.primary : T.surface,
                  borderWidth: isMine ? 0 : 1, borderColor: T.line, padding: 3,
                }}>
                  {msg.reply_to && (
                    <View style={{ padding: 6, paddingBottom: 0 }}>
                      <ReplyQuote replyTo={msg.reply_to} isMine={isMine} myId={myId} otherName={otherName} />
                    </View>
                  )}
                  <TouchableOpacity
                    activeOpacity={0.92}
                    disabled={selectionMode || pending}
                    onPress={() => onImagePress(imageUri)}
                    onLongPress={handleLongPress}
                    delayLongPress={280}
                  >
                    <Image
                      source={{ uri: imageUri }}
                      style={{ width: 232, height: 232, borderRadius: r - 4, backgroundColor: T.surface2, opacity: pending && !msg.failed ? 0.7 : 1 }}
                      resizeMode="cover"
                    />
                    <View style={{
                      position: 'absolute', right: 8, bottom: 8,
                      flexDirection: 'row', alignItems: 'center', gap: 3,
                      backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3,
                    }}>
                      <Text style={{ fontSize: 10.5, color: '#FFFFFF' }}>{formatTime(msg.created_at)}</Text>
                      {isMine && <Ticks msg={msg} onBubble />}
                    </View>
                    {pending && !msg.failed && (
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{
                  ...radii,
                  backgroundColor: isMine ? (msg.failed ? T.primaryPressed : T.primary) : T.surface,
                  borderWidth: isMine ? 0 : 1, borderColor: T.line,
                  paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6,
                  opacity: pending && !msg.failed ? 0.85 : 1,
                }}>
                  {msg.reply_to && <ReplyQuote replyTo={msg.reply_to} isMine={isMine} myId={myId} otherName={otherName} />}
                  <Text style={{ fontSize: 15, lineHeight: 21, color: isMine ? T.onPrimary : T.ink }}>
                    {msg.content}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 }}>
                    {msg.edited && (
                      <Text style={{ fontSize: 10.5, fontStyle: 'italic', color: isMine ? 'rgba(255,255,255,0.75)' : T.ink4 }}>edited</Text>
                    )}
                    <Text style={{ fontSize: 10.5, color: isMine ? 'rgba(255,255,255,0.8)' : T.ink4 }}>
                      {formatTime(msg.created_at)}
                    </Text>
                    {isMine && <Ticks msg={msg} onBubble />}
                  </View>
                </View>
              )}
            </Pressable>

            {msg.failed && (
              <TouchableOpacity onPress={() => onPress(msg)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 3 }}>
                <Ionicons name="refresh" size={12} color={T.danger} />
                <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.dangerInk }}>Not sent · Tap to retry</Text>
              </TouchableOpacity>
            )}

            {msg.reactions?.length > 0 && (
              <View style={{ alignItems: align, marginTop: 2 }}>
                <ReactionRow reactions={msg.reactions} myId={myId} onPress={(emoji) => onReactionPress(msg.id, emoji)} />
              </View>
            )}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

// ── Payment Request Bubble ─────────────────────────────────────────────────
const PaymentRequestBubble = memo(function PaymentRequestBubble({
  msg, isMine, onPay, onCancel, paying, animate,
}: {
  msg: Message; isMine: boolean;
  onPay: (pr: PaymentRequest) => void;
  onCancel: (pr: PaymentRequest) => void;
  paying: string | null; animate: boolean;
}) {
  useTheme();
  const pr = msg.payment_request;
  if (!pr) {
    return (
      <View style={{ alignItems: isMine ? 'flex-end' : 'flex-start', paddingHorizontal: 12, marginBottom: 8 }}>
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: T.line, padding: 12, backgroundColor: T.surface }}>
          <Text style={{ fontSize: 13, color: T.ink3 }}>Payment request unavailable</Text>
        </View>
      </View>
    );
  }
  const isPaid = pr.status === 'paid';
  const isPending = pr.status === 'pending';
  const statusColor = isPaid ? T.successInk : isPending ? T.goldInk : T.ink4;
  const statusBg = isPaid ? T.successSoft : isPending ? T.goldSoft : T.surface2;
  const statusLabel = isPaid ? 'Paid' : isPending ? 'Awaiting payment' : pr.status === 'cancelled' ? 'Cancelled' : 'Expired';
  const fee = pr.is_delivery ? pr.delivery_fee ?? 0 : 0;
  const total = pr.amount + fee;

  return (
    <Animated.View
      entering={animate ? FadeInDown.duration(200) : undefined}
      style={{ paddingHorizontal: 12, marginBottom: 10, alignItems: isMine ? 'flex-end' : 'flex-start' }}
    >
      <View style={{
        width: Math.min(290, SCREEN_WIDTH * 0.8),
        backgroundColor: T.surface, borderRadius: 20,
        borderWidth: 1, borderColor: isPaid ? T.success : isPending ? T.primaryBorder : T.line,
        overflow: 'hidden',
      }}>
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="receipt-outline" size={16} color={T.primary} />
              </View>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: T.ink }}>Payment request</Text>
            </View>
            <View style={{ backgroundColor: statusBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10.5, color: statusColor }}>{statusLabel}</Text>
            </View>
          </View>

          <View>
            <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 28, color: isPending || isPaid ? T.ink : T.ink4, letterSpacing: -0.5, textDecorationLine: isPending || isPaid ? 'none' : 'line-through' }}>
              {formatAmount(total)}
            </Text>
            {!!pr.description && (
              <Text style={{ fontSize: 13.5, color: T.ink2, marginTop: 4, lineHeight: 19 }}>{pr.description}</Text>
            )}
          </View>

          {fee > 0 && (
            <View style={{ backgroundColor: T.surface2, borderRadius: 12, padding: 10, gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12.5, color: T.ink3 }}>Items</Text>
                <Text style={{ fontSize: 12.5, color: T.ink2, fontFamily: 'PlusJakartaSans_600SemiBold' }}>{formatAmount(pr.amount)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12.5, color: T.ink3 }}>Delivery</Text>
                <Text style={{ fontSize: 12.5, color: T.ink2, fontFamily: 'PlusJakartaSans_600SemiBold' }}>{formatAmount(fee)}</Text>
              </View>
            </View>
          )}

          {isPending && !isMine && (
            <TouchableOpacity
              onPress={() => onPay(pr)}
              disabled={paying === pr.id}
              activeOpacity={0.85}
              style={{ backgroundColor: T.primary, borderRadius: 14, height: 46, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
            >
              {paying === pr.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                <>
                  <Ionicons name="lock-closed" size={15} color="#FFFFFF" />
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14.5, color: '#FFFFFF' }}>Pay securely</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {isPending && isMine && (
            <TouchableOpacity
              onPress={() => onCancel(pr)}
              style={{ borderRadius: 14, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.line }}
            >
              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: T.ink3 }}>Cancel request</Text>
            </TouchableOpacity>
          )}
          {isPaid && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="shield-checkmark" size={14} color={T.successInk} />
              <Text style={{ fontSize: 12.5, color: T.successInk, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                Paid{pr.paid_at ? ` · ${formatTime(pr.paid_at)}` : ''} · held in escrow
              </Text>
            </View>
          )}
        </View>
      </View>
      <Text style={{ fontSize: 10.5, color: T.ink4, marginTop: 3, paddingHorizontal: 4 }}>{formatTime(msg.created_at)}</Text>
    </Animated.View>
  );
});

// ── Floating Context Menu ──────────────────────────────────────────────────
function FloatingContextMenu({
  visible, pageY, msg, isMine, myReaction,
  onReply, onReact, onEdit, onDelete, onSelect, onDismiss,
}: {
  visible: boolean; pageY: number; msg: Message | null; isMine: boolean; myReaction?: string;
  onReply: () => void; onReact: (emoji: string) => void;
  onEdit: () => void; onDelete: () => void; onSelect: () => void;
  onDismiss: () => void;
}) {
  useTheme();
  const insets = useSafeAreaInsets();
  if (!visible || !msg) return null;

  const actions = [
    { icon: 'arrow-undo-outline', label: 'Reply', onPress: onReply, color: T.ink },
    ...(isMine && msg.type === 'text' ? [{ icon: 'create-outline', label: 'Edit', onPress: onEdit, color: T.ink }] : []),
    ...(isMine ? [{ icon: 'checkmark-circle-outline', label: 'Select', onPress: onSelect, color: T.ink }] : []),
    ...(isMine ? [{ icon: 'trash-outline', label: 'Delete', onPress: onDelete, color: T.dangerInk }] : []),
  ] as Array<{ icon: string; label: string; onPress: () => void; color: string }>;

  const reactionBarH = 58;
  const menuH = actions.length * 48;
  const blockH = reactionBarH + 8 + menuH;
  const minTop = insets.top + 12;
  const maxTop = SCREEN_HEIGHT - insets.bottom - blockH - 12;
  const top = Math.max(minTop, Math.min(maxTop, pageY - reactionBarH - 8));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: T.overlay }} onPress={onDismiss}>
        <View style={{ position: 'absolute', top, [isMine ? 'right' : 'left']: 14, alignItems: isMine ? 'flex-end' : 'flex-start', gap: 8 }}>
          <Animated.View
            entering={ZoomIn.duration(160)}
            style={{
              flexDirection: 'row', gap: 2, padding: 6, borderRadius: 30,
              backgroundColor: T.surface, borderWidth: 1, borderColor: T.line,
              shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 12,
            }}
          >
            {REACTION_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                onPress={() => { onDismiss(); onReact(emoji); }}
                style={{
                  width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: myReaction === emoji ? T.primarySoft : 'transparent',
                }}
              >
                <Text style={{ fontSize: 24 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>

          <Animated.View
            entering={FadeIn.duration(160)}
            style={{
              minWidth: 190, borderRadius: 16, overflow: 'hidden',
              backgroundColor: T.surface, borderWidth: 1, borderColor: T.line,
              shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 12,
            }}
          >
            {actions.map((action, i) => (
              <TouchableOpacity
                key={action.label}
                onPress={() => { onDismiss(); action.onPress(); }}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingHorizontal: 16, height: 48,
                  borderBottomWidth: i < actions.length - 1 ? 1 : 0, borderBottomColor: T.line,
                }}
              >
                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14.5, color: action.color }}>{action.label}</Text>
                <Ionicons name={action.icon as any} size={18} color={action.color} />
              </TouchableOpacity>
            ))}
          </Animated.View>
        </View>
      </Pressable>
    </Modal>
  );
}

// ── Reply / Edit strip above the input ─────────────────────────────────────
const ComposerContext = memo(function ComposerContext({ mode, msg, label, onCancel }: {
  mode: 'reply' | 'edit'; msg: Message; label: string; onCancel: () => void;
}) {
  useTheme();
  const preview = msg.type === 'image' ? 'Photo' : msg.type === 'payment_request' ? 'Payment request' : msg.content;
  return (
    <Animated.View
      entering={FadeInDown.duration(160)}
      exiting={FadeOutDown.duration(120)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        marginHorizontal: 10, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 8,
        backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.line,
      }}
    >
      <View style={{ width: 3, alignSelf: 'stretch', backgroundColor: T.primary, borderRadius: 2 }} />
      <Ionicons name={mode === 'edit' ? 'create-outline' : 'arrow-undo-outline'} size={16} color={T.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: T.primaryInk }}>{label}</Text>
        <Text numberOfLines={1} style={{ fontSize: 12.5, color: T.ink3 }}>{preview}</Text>
      </View>
      <TouchableOpacity onPress={onCancel} hitSlop={12}>
        <Ionicons name="close-circle" size={20} color={T.ink4} />
      </TouchableOpacity>
    </Animated.View>
  );
});

// ── Bottom sheet shell ─────────────────────────────────────────────────────
function Sheet({ visible, onClose, children, avoidKeyboard }: {
  visible: boolean; onClose: () => void; children: React.ReactNode; avoidKeyboard?: boolean;
}) {
  useTheme();
  const insets = useSafeAreaInsets();
  const body = (
    <View style={{
      backgroundColor: T.canvas, borderTopLeftRadius: 26, borderTopRightRadius: 26,
      paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16) + 12,
    }}>
      <View style={{ width: 38, height: 4, backgroundColor: T.lineStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 18 }} />
      {children}
    </View>
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: T.overlay }} onPress={onClose} />
      {avoidKeyboard ? <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{body}</KeyboardAvoidingView> : body}
    </Modal>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────
export default function ChatScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const myId = user?.id ?? '';
  const queryClient = useQueryClient();
  const { showAlert: vendrAlert, alertElement } = useVendrAlert();
  const params = useLocalSearchParams<{
    conversationId?: string; vendorId?: string; productName?: string; productPrice?: string;
    // header info passed from the chat list so the screen opens fully drawn
    name?: string; avatar?: string; uid?: string; asVendor?: string; verified?: string; vid?: string;
  }>();
  const { conversationId, vendorId, productName, productPrice } = params;
  const routeCid = looksLikeConversationId(conversationId) ? conversationId! : null;

  const listRef = useRef<FlatList<Message>>(null);
  const inputRef = useRef<TextInput>(null);
  const openedAt = useRef(new Date().toISOString());

  // Header info, available on the very first frame: route params → chat list cache → device cache
  const [seed] = useState<ChatMeta | null>(() => {
    if (params.name) {
      return {
        otherUserId: params.uid || null,
        otherName: params.name,
        otherAvatar: params.avatar || null,
        isVerified: params.verified === '1',
        actingAsVendor: params.asVendor === '1',
        vendorProfileId: params.vid || '',
      };
    }
    if (!routeCid) return null;
    const c = queryClient.getQueryData<ConversationItem[]>(conversationsKey(myId))?.find((x) => x.id === routeCid);
    if (c) {
      return {
        otherUserId: getOtherUserId(c),
        otherName: getOtherName(c),
        otherAvatar: getOtherAvatar(c),
        isVerified: !c.iAmVendor && !!c.vendor?.is_verified,
        actingAsVendor: c.iAmVendor,
        vendorProfileId: c.vendor?.id ?? '',
      };
    }
    return peekChat(routeCid)?.meta ?? null;
  });

  // Conversation meta
  const [convId, setConvId] = useState<string | null>(routeCid);
  const [actingAsVendor, setActingAsVendor] = useState(seed?.actingAsVendor ?? false);
  const [otherUserId, setOtherUserId] = useState<string | null>(seed?.otherUserId ?? null);
  const [otherName, setOtherName] = useState(seed?.otherName ?? '');
  const [otherAvatar, setOtherAvatar] = useState<string | null>(seed?.otherAvatar ?? null);
  const [isVerified, setIsVerified] = useState(seed?.isVerified ?? false);
  const [vendorProfileId, setVendorProfileId] = useState(seed?.vendorProfileId ?? '');

  // Messages (whatever this session already holds in memory shows instantly)
  const [messages, setMessages] = useState<Message[]>(() => (routeCid ? (peekChat(routeCid)?.messages as Message[]) ?? [] : []));
  const [initialLoading, setInitialLoading] = useState(() => !(routeCid && peekChat(routeCid)?.messages?.length));
  const [networkIssue, setNetworkIssue] = useState(false);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('connected');
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);

  // Composer
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // UI
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [showAttachSheet, setShowAttachSheet] = useState(false);
  const [showProductEnquiry, setShowProductEnquiry] = useState(false);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [newBelow, setNewBelow] = useState(0);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; msg: Message | null; pageY: number }>({ visible: false, msg: null, pageY: 0 });

  // Payments
  const [paying, setPaying] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDescription, setPayDescription] = useState('');
  const [sendingPaymentRequest, setSendingPaymentRequest] = useState(false);
  const [pendingPayPr, setPendingPayPr] = useState<PaymentRequest | null>(null);
  const [payOrderType, setPayOrderType] = useState<'pickup' | 'delivery'>('pickup');
  const [payDeliveryAddress, setPayDeliveryAddress] = useState('');

  const presence = usePresence(otherUserId);
  const otherTyping = useIsTyping(convId);
  useNow(30_000); // keeps "last seen …" current while the chat is open

  // Refs mirrored for socket handlers / timers
  const convIdRef = useRef<string | null>(routeCid);
  const focusedRef = useRef(false);
  const scrolledUpRef = useRef(false);
  const markReadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingRef = useRef<{ active: boolean; lastEmit: number; timer: ReturnType<typeof setTimeout> | null }>({ active: false, lastEmit: 0, timer: null });
  useEffect(() => { convIdRef.current = convId; }, [convId]);

  // Image viewer zoom
  const scale = useSharedValue(1);
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => { scale.value = Math.max(1, Math.min(4, e.scale)); })
    .onEnd(() => { scale.value = withSpring(1); });
  const animatedImageStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ─── Read receipts ──────────────────────────────────────────────────────
  const scheduleMarkRead = useStableCallback(() => {
    const cid = convIdRef.current;
    if (!cid || !focusedRef.current || AppState.currentState !== 'active') return;
    if (markReadTimer.current) clearTimeout(markReadTimer.current);
    markReadTimer.current = setTimeout(() => {
      markConversationReadLocally(queryClient, myId, cid);
      chatApi.markAsRead(cid).catch(() => {});
    }, 250);
  });

  // ─── Loading ────────────────────────────────────────────────────────────
  const fetchLatest = useStableCallback(async (cid: string, isInitial = false) => {
    const { data } = await chatApi.getMessages(cid, { limit: PAGE_SIZE });
    const fresh: Message[] = data ?? [];
    if (isInitial) {
      const firstUnread = fresh.find((m) => m.sender_id !== myId && !m.is_read && !m.deleted);
      setFirstUnreadId(firstUnread?.id ?? null);
      setHasMore(fresh.length === PAGE_SIZE);
    }
    setMessages((prev) => mergeLatest(prev, fresh));
  });

  const refreshPresence = useStableCallback(async (uid: string | null) => {
    if (!uid) return;
    try {
      const { data } = await chatApi.getPresence([uid]);
      const p = data?.[uid];
      usePresenceStore.getState().seedPresence([{ userId: uid, isOnline: !!p?.is_online, lastSeen: p?.last_seen ?? null }]);
    } catch { /* non-critical */ }
  });

  const applyMeta = (meta: ChatMeta, cid: string | null, persist: boolean) => {
    setActingAsVendor(meta.actingAsVendor);
    setOtherUserId(meta.otherUserId);
    setOtherName(meta.otherName);
    setOtherAvatar(meta.otherAvatar);
    setIsVerified(meta.isVerified);
    setVendorProfileId(meta.vendorProfileId);
    if (persist && cid) saveChatMeta(cid, meta);
  };

  /** Refresh from the server. Never wipes what's on screen if the network is bad. */
  const syncFromServer = useStableCallback(async (cid: string, isInitial: boolean) => {
    const [convRes, msgRes] = await Promise.allSettled([chatApi.getConversation(cid), fetchLatest(cid, isInitial)]);

    if (convRes.status === 'fulfilled') {
      const { conversation, vendor, buyer, actingAsVendor: asVendor } = convRes.value.data;
      if (!asVendor && vendor?.user_id === myId) {
        setError('You cannot chat with your own store.');
        return;
      }
      applyMeta(asVendor ? {
        actingAsVendor: true,
        otherUserId: conversation.buyer_id,
        otherName: buyer?.name || 'Customer',
        otherAvatar: buyer?.avatar_url ?? null,
        isVerified: false,
        vendorProfileId: '',
      } : {
        actingAsVendor: false,
        otherUserId: vendor?.user_id ?? null,
        otherName: vendor?.business_name || 'Vendor',
        otherAvatar: vendor?.logo_url || vendor?.avatar_url || vendor?.owner_avatar || null,
        isVerified: !!vendor?.is_verified,
        vendorProfileId: vendor?.id ?? '',
      }, cid, true);
      refreshPresence(asVendor ? conversation.buyer_id : vendor?.user_id ?? null);
    }

    const failure = convRes.status === 'rejected' ? convRes.reason : msgRes.status === 'rejected' ? msgRes.reason : null;
    if (failure && !isTransientError(failure)) {
      // 403/404 etc. — this chat genuinely can't be opened
      setError(failure?.message || 'This conversation could not be opened.');
      return;
    }
    setNetworkIssue(!!failure);
    if (!failure) scheduleMarkRead();
  });

  const initChat = useStableCallback(async () => {
    if (!myId) return;
    setError(null);

    let cid = routeCid;
    if (!cid && vendorId) {
      try {
        const { data } = await chatApi.createConversation(vendorId);
        cid = data?.id ?? null;
      } catch (e: any) {
        setError(isTransientError(e)
          ? "You're offline. Connect to the internet to start this chat."
          : e?.message || 'Could not start this chat.');
        setInitialLoading(false);
        return;
      }
    }
    if (!cid) {
      setError('This conversation could not be found.');
      setInitialLoading(false);
      return;
    }
    setConvId(cid);
    convIdRef.current = cid;

    // 1) Instant: what's saved on this device + anything still waiting to send
    const [cached, pending] = await Promise.all([loadChat(cid), pendingForConversation(cid)]);
    if (cached.meta && !seed) applyMeta(cached.meta, cid, false);
    const local = [...((cached.messages as Message[]) ?? []), ...(pending as Message[])];
    if (local.length) {
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        return normalize([...prev, ...local.filter((m) => !ids.has(m.id))]);
      });
      const firstUnread = (cached.messages as Message[] | undefined)?.find((m) => m.sender_id !== myId && !m.is_read && !m.deleted);
      setFirstUnreadId(firstUnread?.id ?? null);
      setHasMore(true);
      setInitialLoading(false);
    }

    // 2) Fresh data from the server (non-fatal when offline)
    await syncFromServer(cid, true);
    setInitialLoading(false);

    if (productName) setTimeout(() => setShowProductEnquiry(true), 350);
  });

  useEffect(() => {
    if (myId) initChat();
  }, [myId, conversationId, vendorId]);

  useEffect(() => onSocketStatus(setSocketStatus), []);

  // Save the conversation to the device so it opens instantly / offline next time
  useEffect(() => {
    if (!convId || initialLoading) return;
    saveChatMessages(convId, messages.filter((m) => !isPending(m)));
  }, [messages, convId, initialLoading]);

  const loadOlderMessages = useStableCallback(async () => {
    const cid = convIdRef.current;
    const oldest = messages.find((m) => !isPending(m));
    if (!cid || loadingMore || !hasMore || !oldest) return;
    setLoadingMore(true);
    try {
      const { data } = await chatApi.getMessages(cid, { limit: PAGE_SIZE, before: oldest.created_at });
      const older: Message[] = data ?? [];
      setHasMore(older.length === PAGE_SIZE);
      if (older.length) {
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          return [...older.filter((m) => !ids.has(m.id)).map((m) => ({ ...m, reactions: m.reactions ?? [] })), ...prev];
        });
      }
    } catch (err) {
      console.error('[Chat] load older failed', err);
    } finally {
      setLoadingMore(false);
    }
  });

  // ─── Focus / app state ──────────────────────────────────────────────────
  const stopTyping = useStableCallback(() => {
    const t = typingRef.current;
    if (t.timer) clearTimeout(t.timer);
    t.timer = null;
    if (t.active && convIdRef.current) emitTyping(convIdRef.current, false);
    t.active = false;
  });

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    if (convId) {
      usePresenceStore.getState().setActiveConversationId(convId);
      scheduleMarkRead();
    }
    return () => {
      focusedRef.current = false;
      stopTyping();
      if (usePresenceStore.getState().activeConversationId === convId) {
        usePresenceStore.getState().setActiveConversationId(null);
      }
    };
  }, [convId]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') scheduleMarkRead();
      else stopTyping();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => () => {
    if (markReadTimer.current) clearTimeout(markReadTimer.current);
    // Leaving the screen by any route must never leave this chat flagged as "open"
    const store = usePresenceStore.getState();
    if (convIdRef.current && store.activeConversationId === convIdRef.current) {
      store.setActiveConversationId(null);
    }
  }, []);

  // ─── Realtime ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!convId || !myId) return;
    joinConversation(convId);
    const mine = (m: Message) => m.sender_id === myId;

    const offs = [
      onSocketEvent('new_message', (m: Message) => {
        if (m.conversation_id !== convId) return;
        setMessages((prev) => upsertMessage(prev, m));
        if (!mine(m)) {
          scheduleMarkRead();
          if (scrolledUpRef.current) setNewBelow((n) => n + 1);
        }
      }),
      onSocketEvent('message_updated', (m: Message) => {
        if (m.conversation_id !== convId) return;
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, content: m.content, edited: true } : x)));
      }),
      onSocketEvent('message_deleted', (d: { conversationId?: string; messageId: string }) => {
        if (d.conversationId && d.conversationId !== convId) return;
        setMessages((prev) => prev.map((x) => (x.id === d.messageId ? { ...x, deleted: true, content: null, image_url: null, reactions: [] } : x)));
      }),
      onSocketEvent('messages_read', (d: { conversationId: string; messageIds: string[]; readBy: string }) => {
        if (d.conversationId !== convId || d.readBy === myId || !d.messageIds?.length) return;
        const ids = new Set(d.messageIds);
        setMessages((prev) => prev.map((x) => (ids.has(x.id) ? { ...x, is_read: true, delivered: true } : x)));
      }),
      onSocketEvent('message_delivered', (d: { conversationId: string; userId: string; messageIds?: string[] }) => {
        if (d.conversationId !== convId || d.userId === myId) return;
        const ids = d.messageIds ? new Set(d.messageIds) : null;
        setMessages((prev) => prev.map((x) => (mine(x) && !x.delivered && !isPending(x) && (!ids || ids.has(x.id)) ? { ...x, delivered: true } : x)));
      }),
      onSocketEvent('reaction_added', (d: { conversationId?: string; messageId: string; reaction: Reaction }) => {
        if (d.conversationId && d.conversationId !== convId) return;
        setMessages((prev) => prev.map((x) => {
          if (x.id !== d.messageId) return x;
          const others = x.reactions.filter((r) => r.user_id !== d.reaction.user_id);
          return { ...x, reactions: [...others, d.reaction] };
        }));
      }),
      onSocketEvent('reaction_removed', (d: { conversationId?: string; messageId: string; userId: string }) => {
        if (d.conversationId && d.conversationId !== convId) return;
        setMessages((prev) => prev.map((x) => (x.id === d.messageId ? { ...x, reactions: x.reactions.filter((r) => r.user_id !== d.userId) } : x)));
      }),
      onSocketEvent('payment_request_updated', (d: { conversationId: string; paymentRequest: PaymentRequest }) => {
        if (d.conversationId !== convId) return;
        setMessages((prev) => prev.map((x) => (x.type === 'payment_request' && x.content === d.paymentRequest.id ? { ...x, payment_request: d.paymentRequest } : x)));
      }),
      // Back online: catch up on anything we missed
      onSocketEvent('connect', () => {
        syncFromServer(convId, false).catch(() => {});
      }),
    ];

    return () => {
      offs.forEach((off) => off());
      leaveConversation(convId);
    };
  }, [convId, myId, otherUserId]);

  // ─── Sending (via the persistent outbox: works offline, retries on reconnect) ───
  const scrollToBottom = (animated = true) => {
    listRef.current?.scrollToOffset({ offset: 0, animated });
    setNewBelow(0);
  };

  const replyPreviewOf = (m: Message | null): ReplyPreview | null => m ? {
    id: m.id, sender_id: m.sender_id,
    sender_name: m.sender_id === myId ? user?.full_name ?? null : otherName,
    content: m.content, image_url: m.image_url, type: m.type,
  } : null;

  // Results from the outbox (it keeps sending even if this screen was closed meanwhile)
  useEffect(() => {
    if (!convId) return;
    return subscribeOutbox((e) => {
      if (e.type === 'changed' || e.item.conversationId !== convId) return;
      if (e.type === 'sent') {
        setMessages((prev) => upsertMessage(prev, { ...e.message, client_id: e.item.clientId }));
      } else {
        setMessages((prev) => prev.map((m) => (m.id === e.item.clientId ? { ...m, failed: true } : m)));
      }
    });
  }, [convId]);

  const queueMessage = (temp: Message) => {
    enqueueOutbox({
      clientId: temp.id,
      conversationId: temp.conversation_id,
      kind: temp.type === 'image' ? 'image' : 'text',
      content: temp.content,
      localUri: temp.local_uri,
      replyToId: temp.reply_to_id,
      message: { ...temp, failed: false },
    });
  };

  const addOptimistic = (temp: Message) => {
    setMessages((prev) => [...prev, temp]);
    setFirstUnreadId(null);
    requestAnimationFrame(() => scrollToBottom());
    queueMessage(temp);
  };

  const sendText = (content: string, replyTo: Message | null = null) => {
    const cid = convIdRef.current;
    if (!cid || !myId || !content.trim()) return;
    const tempId = newClientId();
    addOptimistic({
      id: tempId, client_id: tempId, conversation_id: cid, sender_id: myId,
      content: content.trim(), image_url: null, type: 'text',
      is_read: false, delivered: false, edited: false, deleted: false,
      reply_to_id: replyTo?.id ?? null, reply_to: replyPreviewOf(replyTo),
      reactions: [], created_at: new Date().toISOString(),
    });
  };

  const sendImage = (uri: string) => {
    const cid = convIdRef.current;
    if (!cid || !myId) return;
    const tempId = newClientId();
    const replyTo = replyingTo;
    setReplyingTo(null);
    addOptimistic({
      id: tempId, client_id: tempId, conversation_id: cid, sender_id: myId,
      content: null, image_url: null, local_uri: uri, type: 'image',
      is_read: false, delivered: false, edited: false, deleted: false,
      reply_to_id: replyTo?.id ?? null, reply_to: replyPreviewOf(replyTo),
      reactions: [], created_at: new Date().toISOString(),
    });
  };

  const retryMessage = (m: Message) => {
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, failed: false } : x)));
    queueMessage(m);
  };

  const onSubmit = async () => {
    const content = text.trim();
    if (!content) return;
    stopTyping();

    if (editingMsg) {
      const original = editingMsg;
      setEditingMsg(null);
      setText('');
      if (content === original.content) return;
      setMessages((ms) => ms.map((m) => (m.id === original.id ? { ...m, content, edited: true } : m)));
      try {
        await chatApi.updateMessage(original.id, content);
      } catch (err: any) {
        setMessages((ms) => ms.map((m) => (m.id === original.id ? original : m)));
        vendrAlert({ title: "Couldn't edit message", message: err?.message ?? 'Please try again.', type: 'danger' });
      }
      return;
    }

    const replyTo = replyingTo;
    setText('');
    setReplyingTo(null);
    sendText(content, replyTo);
  };

  const onChangeText = (value: string) => {
    setText(value);
    const cid = convIdRef.current;
    if (!cid || editingMsg) return;
    const t = typingRef.current;
    if (!value.trim()) { stopTyping(); return; }
    const now = Date.now();
    if (!t.active || now - t.lastEmit > 2500) {
      emitTyping(cid, true);
      t.active = true;
      t.lastEmit = now;
    }
    if (t.timer) clearTimeout(t.timer);
    t.timer = setTimeout(stopTyping, 3000);
  };

  // ─── Images ─────────────────────────────────────────────────────────────
  const pickFromGallery = async () => {
    setShowAttachSheet(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { vendrAlert({ title: 'Permission needed', message: 'Allow photo access to send pictures.', type: 'warning' }); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    sendImage(result.assets[0].uri);
  };

  const takePhoto = async () => {
    setShowAttachSheet(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { vendrAlert({ title: 'Permission needed', message: 'Allow camera access to take photos.', type: 'warning' }); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    sendImage(result.assets[0].uri);
  };

  // ─── Reactions ──────────────────────────────────────────────────────────
  const toggleReaction = useStableCallback(async (messageId: string, emoji: string) => {
    if (!myId) return;
    const msg = messages.find((m) => m.id === messageId);
    if (!msg || isPending(msg) || msg.deleted) return;
    const mineR = msg.reactions.find((r) => r.user_id === myId);
    const before = msg.reactions;
    Haptics.selectionAsync().catch(() => {});

    if (mineR?.emoji === emoji) {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: m.reactions.filter((r) => r.user_id !== myId) } : m)));
      try { await chatApi.removeReaction(messageId); }
      catch { setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: before } : m))); }
    } else {
      const optimistic: Reaction = { id: `tmp-${Date.now()}`, message_id: messageId, user_id: myId, emoji, created_at: new Date().toISOString() };
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: [...m.reactions.filter((r) => r.user_id !== myId), optimistic] } : m)));
      try { await chatApi.addReaction(messageId, emoji); }
      catch { setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: before } : m))); }
    }
  });

  // ─── Bubble interactions ────────────────────────────────────────────────
  const handleLongPress = useStableCallback((msg: Message, pageY: number) => {
    if (msg.deleted) return;
    if (selectionMode) { toggleSelect(msg); return; }
    if (isPending(msg)) { if (msg.failed) handleBubblePress(msg); return; }
    Keyboard.dismiss();
    setContextMenu({ visible: true, msg, pageY });
  });

  const toggleSelect = (msg: Message) => {
    if (msg.sender_id !== myId || msg.deleted || isPending(msg) || msg.type === 'payment_request') return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(msg.id) ? next.delete(msg.id) : next.add(msg.id);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  };

  const handleBubblePress = useStableCallback((msg: Message) => {
    if (selectionMode) { toggleSelect(msg); return; }
    if (msg.failed) {
      vendrAlert({
        title: 'Message not sent',
        message: 'The message was rejected. You can try again or delete it.',
        type: 'warning',
        buttons: [
          { text: 'Delete', style: 'destructive', onPress: () => {
            removeFromOutbox(msg.id);
            setMessages((prev) => prev.filter((m) => m.id !== msg.id));
          } },
          { text: 'Retry', onPress: () => retryMessage(msg) },
        ],
      });
    }
  });

  const handleSwipeReply = useStableCallback((msg: Message) => {
    setEditingMsg(null);
    setReplyingTo(msg);
    setTimeout(() => inputRef.current?.focus(), 80);
  });

  const handleImagePress = useStableCallback((url: string) => {
    scale.value = 1;
    setViewingImage(url);
  });

  const dismissContextMenu = () => setContextMenu((prev) => ({ ...prev, visible: false }));

  const startEdit = () => {
    const msg = contextMenu.msg;
    if (!msg) return;
    setReplyingTo(null);
    setEditingMsg(msg);
    setText(msg.content ?? '');
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const startReply = () => {
    if (contextMenu.msg) handleSwipeReply(contextMenu.msg);
  };

  const startSelect = () => {
    const msg = contextMenu.msg;
    if (!msg) return;
    setSelectionMode(true);
    setSelectedIds(new Set([msg.id]));
  };

  const softDeleteLocal = (ids: string[]) =>
    setMessages((prev) => prev.map((m) => (ids.includes(m.id) ? { ...m, deleted: true, content: null, image_url: null, reactions: [] } : m)));

  const deleteMessage = () => {
    const msg = contextMenu.msg;
    if (!msg) return;
    vendrAlert({
      title: 'Delete message?',
      message: 'It will be removed for everyone in this chat.',
      type: 'danger',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            softDeleteLocal([msg.id]);
            try { await chatApi.deleteMessage(msg.id); }
            catch { setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m))); }
          },
        },
      ],
    });
  };

  const exitSelectionMode = () => { setSelectionMode(false); setSelectedIds(new Set()); };

  const deleteSelectedMessages = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    vendrAlert({
      title: `Delete ${ids.length} message${ids.length > 1 ? 's' : ''}?`,
      message: 'They will be removed for everyone in this chat.',
      type: 'danger',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            softDeleteLocal(ids);
            exitSelectionMode();
            await Promise.all(ids.map((id) => chatApi.deleteMessage(id).catch(() => {})));
          },
        },
      ],
    });
  };

  // ─── Payments ───────────────────────────────────────────────────────────
  const sendPaymentRequest = async () => {
    const amount = parseFloat(payAmount.replace(/[^0-9.]/g, ''));
    if (!amount || amount <= 0) { vendrAlert({ title: 'Invalid amount', message: 'Enter an amount greater than zero.', type: 'warning' }); return; }
    const cid = convIdRef.current;
    if (!cid) return;
    setSendingPaymentRequest(true);
    try {
      const { data: msg } = await chatApi.createPaymentRequest(cid, amount, payDescription.trim() || undefined);
      setMessages((prev) => upsertMessage(prev, msg));
      setShowPaymentSheet(false);
      setPayAmount('');
      setPayDescription('');
      requestAnimationFrame(() => scrollToBottom());
    } catch (e: any) {
      vendrAlert({ title: "Couldn't send request", message: e?.message ?? 'Please try again.', type: 'danger' });
    } finally {
      setSendingPaymentRequest(false);
    }
  };

  const handlePayNow = useStableCallback((pr: PaymentRequest) => {
    setPendingPayPr(pr);
    setPayOrderType(pr.is_delivery ? 'delivery' : 'pickup');
    setPayDeliveryAddress(pr.delivery_address ?? '');
  });

  const handleCancelRequest = useStableCallback((pr: PaymentRequest) => {
    vendrAlert({
      title: 'Cancel this request?', message: 'The buyer will no longer be able to pay it.', type: 'question',
      buttons: [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel request', style: 'destructive', onPress: async () => {
            try {
              await chatApi.cancelPaymentRequest(pr.id);
              setMessages((prev) => prev.map((m) => (m.type === 'payment_request' && m.content === pr.id
                ? { ...m, payment_request: { ...(m.payment_request ?? pr), status: 'cancelled' } } : m)));
            } catch (e: any) {
              vendrAlert({ title: 'Error', message: e?.message ?? 'Please try again.', type: 'danger' });
            }
          },
        },
      ],
    });
  });

  const confirmPayNow = async () => {
    const pr = pendingPayPr;
    if (!pr || !convIdRef.current) return;
    if (payOrderType === 'delivery' && !payDeliveryAddress.trim()) {
      vendrAlert({ title: 'Address required', message: 'Enter where the order should be delivered.', type: 'warning' });
      return;
    }
    setPendingPayPr(null);
    setPaying(pr.id);
    try {
      const { data: payResult } = await chatApi.payPaymentRequest(pr.id, {
        order_type: payOrderType,
        delivery_address: payOrderType === 'delivery' ? payDeliveryAddress.trim() : undefined,
      });
      if (!payResult?.success) throw new Error('Payment failed');
      analyticsApi.recordOrder({ vendorId: pr.vendor_id, productId: '', amount: pr.amount }).catch(() => {});
      setMessages((prev) => prev.map((m) => (m.type === 'payment_request' && m.content === pr.id
        ? { ...m, payment_request: { ...(m.payment_request ?? pr), status: 'paid', paid_at: new Date().toISOString() } } : m)));
      sendText(`✅ Payment of ${formatAmount(pr.amount + (pr.is_delivery ? pr.delivery_fee ?? 0 : 0))} sent.`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      vendrAlert({ title: 'Payment successful', message: 'Your money is held safely in escrow until you confirm the order.', type: 'success' });
    } catch (e: any) {
      vendrAlert({ title: 'Payment failed', message: e?.message ?? 'Please try again.', type: 'danger' });
    } finally {
      setPaying(null);
    }
  };

  const sendEnquiry = () => {
    setShowProductEnquiry(false);
    if (!productName) return;
    sendText(`Hi! I'm interested in "${productName}"${productPrice ? ` (${productPrice})` : ''}. Is it still available?`);
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/chat');
  };

  // ─── List rendering ─────────────────────────────────────────────────────
  // Inverted list: newest first. Grouping math uses chronological neighbours.
  const listData = useMemo(() => [...messages].reverse(), [messages]);
  const myReactionInMenu = contextMenu.msg?.reactions?.find((r) => r.user_id === myId)?.emoji;

  const renderItem = useCallback(({ item, index }: { item: Message; index: number }) => {
    const ci = messages.length - 1 - index;
    const prevItem = messages[ci - 1];
    const nextItem = messages[ci + 1];
    const label = getDateLabel(item.created_at);
    const showDate = !prevItem || getDateLabel(prevItem.created_at) !== label;
    const isFirstInGroup = showDate || !prevItem || prevItem.sender_id !== item.sender_id || prevItem.type === 'payment_request';
    const isLastInGroup = !nextItem || nextItem.sender_id !== item.sender_id || getDateLabel(nextItem.created_at) !== label || nextItem.type === 'payment_request';
    const isMine = item.sender_id === myId;
    const animate = isPending(item) || item.created_at > openedAt.current;

    return (
      <View>
        {showDate && <DateSeparator label={label} />}
        {item.id === firstUnreadId && <UnreadSeparator />}
        {isFirstInGroup && !showDate && ci > 0 && <View style={{ height: 4 }} />}
        {item.type === 'payment_request' ? (
          <PaymentRequestBubble
            msg={item} isMine={isMine} animate={animate}
            onPay={handlePayNow} onCancel={handleCancelRequest} paying={paying}
          />
        ) : (
          <MessageBubble
            msg={item}
            isMine={isMine}
            isFirstInGroup={isFirstInGroup}
            isLastInGroup={isLastInGroup}
            myId={myId}
            otherName={otherName}
            animate={animate}
            onLongPress={handleLongPress}
            onPress={handleBubblePress}
            onImagePress={handleImagePress}
            onSwipeReply={handleSwipeReply}
            onReactionPress={toggleReaction}
            isSelected={selectedIds.has(item.id)}
            selectionMode={selectionMode}
          />
        )}
      </View>
    );
  }, [messages, myId, otherName, firstUnreadId, paying, selectedIds, selectionMode]);

  // ─── Render ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: T.canvas, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 }}>
        <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: T.dangerSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chatbubble-ellipses-outline" size={32} color={T.danger} />
        </View>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: T.ink, textAlign: 'center' }}>Couldn't open this chat</Text>
        <Text style={{ fontSize: 14, color: T.ink3, textAlign: 'center' }}>{error}</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <TouchableOpacity onPress={goBack} style={{ borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, borderWidth: 1, borderColor: T.line }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: T.ink2 }}>Go back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => initChat()} style={{ backgroundColor: T.primary, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: T.onPrimary }}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Like WhatsApp: connection state wins over presence (which may be stale while offline)
  const offline = socketStatus !== 'connected' && socketStatus !== 'idle';
  const subtitle = offline
    ? { text: networkIssue ? 'waiting for network…' : 'connecting…', color: T.ink3 }
    : otherTyping
    ? { text: 'typing…', color: T.primaryInk }
    : presence?.isOnline
      ? { text: 'online', color: T.successInk }
      : presence
        ? { text: formatLastSeen(presence.lastSeen), color: T.ink3 }
        : { text: actingAsVendor ? 'Customer' : isVerified ? 'Verified vendor' : 'Vendor', color: T.ink3 };

  const canSend = !!text.trim();
  const showEmpty = !initialLoading && messages.length === 0 && !networkIssue;
  const waitingForFirstLoad = messages.length === 0 && (initialLoading || networkIssue);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: T.canvas }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar barStyle={T.barStyle} />

        {/* ── Header ── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          paddingHorizontal: 8, paddingTop: insets.top + 6, paddingBottom: 10,
          backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.line,
        }}>
          {selectionMode ? (
            <>
              <TouchableOpacity onPress={exitSelectionMode} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={24} color={T.ink} />
              </TouchableOpacity>
              <Text style={{ flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: T.ink }}>
                {selectedIds.size} selected
              </Text>
              <TouchableOpacity
                onPress={deleteSelectedMessages}
                disabled={selectedIds.size === 0}
                style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', opacity: selectedIds.size ? 1 : 0.4 }}
              >
                <Ionicons name="trash-outline" size={22} color={T.dangerInk} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={goBack} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={26} color={T.ink} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => !actingAsVendor && vendorProfileId && router.push({ pathname: '/vendor/[id]', params: { id: vendorProfileId } })}
                activeOpacity={actingAsVendor ? 1 : 0.7}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}
              >
                <ChatAvatar uri={otherAvatar} name={otherName || '…'} userId={otherUserId} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: T.ink }}>
                      {otherName || ' '}
                    </Text>
                    {!actingAsVendor && isVerified && <Ionicons name="shield-checkmark" size={14} color={T.successInk} />}
                  </View>
                  <Text numberOfLines={1} style={{ fontSize: 12.5, color: subtitle.color, fontFamily: 'PlusJakartaSans_500Medium' }}>
                    {subtitle.text}
                  </Text>
                </View>
              </TouchableOpacity>

              {actingAsVendor && (
                <TouchableOpacity
                  onPress={() => setShowPaymentSheet(true)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 4,
                    backgroundColor: T.primarySoft, borderWidth: 1, borderColor: T.primaryBorder,
                    borderRadius: 12, paddingHorizontal: 12, height: 36,
                  }}
                >
                  <Ionicons name="receipt-outline" size={15} color={T.primary} />
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: T.primaryInk }}>Request</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* ── Messages ── */}
        <View style={{ flex: 1 }}>
          {waitingForFirstLoad ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 }}>
              <ActivityIndicator color={T.primary} />
              {networkIssue && (
                <Text style={{ fontSize: 13.5, color: T.ink3, textAlign: 'center', lineHeight: 19 }}>
                  Waiting for network… Messages will appear as soon as you're back online. You can still type — they'll send automatically.
                </Text>
              )}
            </View>
          ) : showEmpty ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 10 }}>
              <ChatAvatar uri={otherAvatar} name={otherName || '?'} userId={otherUserId} size={72} />
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: T.ink, textAlign: 'center', marginTop: 6 }}>
                {actingAsVendor ? `${otherName} reached out` : `Start chatting with ${otherName}`}
              </Text>
              <Text style={{ fontSize: 13.5, color: T.ink3, textAlign: 'center', lineHeight: 19 }}>
                {actingAsVendor
                  ? 'Reply to answer their questions, then send a payment request when you agree on a price.'
                  : 'Ask about products, prices or delivery. Payments made in chat are protected by escrow.'}
              </Text>
              {!actingAsVendor && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 }}>
                  {BUYER_QUICK_REPLIES.map((q) => (
                    <TouchableOpacity
                      key={q}
                      onPress={() => sendText(q)}
                      style={{ borderRadius: 16, borderWidth: 1, borderColor: T.primaryBorder, backgroundColor: T.primarySoft, paddingHorizontal: 12, paddingVertical: 8 }}
                    >
                      <Text style={{ fontSize: 13, color: T.primaryInk, fontFamily: 'PlusJakartaSans_600SemiBold' }}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <FlatList
              ref={listRef}
              inverted
              data={listData}
              keyExtractor={(m) => m.id}
              renderItem={renderItem}
              extraData={[selectedIds, selectionMode, paying, firstUnreadId]}
              contentContainerStyle={{ paddingTop: 6, paddingBottom: 10 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              onScroll={(e) => {
                const up = e.nativeEvent.contentOffset.y > 280;
                scrolledUpRef.current = up;
                if (up !== showScrollButton) setShowScrollButton(up);
                if (!up && newBelow) setNewBelow(0);
              }}
              scrollEventThrottle={64}
              onEndReached={loadOlderMessages}
              onEndReachedThreshold={0.3}
              initialNumToRender={20}
              maxToRenderPerBatch={20}
              windowSize={15}
              ListHeaderComponent={otherTyping ? <TypingBubble /> : null}
              ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={T.primary} style={{ marginVertical: 12 }} /> : null}
            />
          )}

          {showScrollButton && (
            <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={{ position: 'absolute', right: 14, bottom: 12 }}>
              <TouchableOpacity
                onPress={() => scrollToBottom()}
                activeOpacity={0.85}
                style={{
                  width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: T.surface, borderWidth: 1, borderColor: T.line,
                  shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 5,
                }}
              >
                <Ionicons name="chevron-down" size={20} color={T.ink} />
                {newBelow > 0 && (
                  <View style={{ position: 'absolute', top: -6, right: -4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                    <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_700Bold', color: T.onPrimary }}>{newBelow > 99 ? '99+' : newBelow}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

        {/* ── Composer ── */}
        <View style={{
          paddingTop: 8,
          paddingBottom: (keyboardOpen ? 0 : insets.bottom) + 8,
          backgroundColor: T.canvas, borderTopWidth: 1, borderTopColor: T.line,
        }}>
          {editingMsg ? (
            <ComposerContext mode="edit" msg={editingMsg} label="Editing message" onCancel={() => { setEditingMsg(null); setText(''); }} />
          ) : replyingTo ? (
            <ComposerContext
              mode="reply" msg={replyingTo}
              label={replyingTo.sender_id === myId ? 'Replying to yourself' : `Replying to ${otherName}`}
              onCancel={() => setReplyingTo(null)}
            />
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10 }}>
            {!editingMsg && (
              <TouchableOpacity
                onPress={() => { Keyboard.dismiss(); setShowAttachSheet(true); }}
                accessibilityLabel="Attach"
                style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: T.surface, borderWidth: 1, borderColor: T.line }}
              >
                <Ionicons name="add" size={24} color={T.ink2} />
              </TouchableOpacity>
            )}

            <View style={{
              flex: 1, minHeight: 44, justifyContent: 'center',
              backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 22,
              paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 11 : 4,
            }}>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={onChangeText}
                onBlur={stopTyping}
                placeholder={editingMsg ? 'Edit message' : 'Message'}
                placeholderTextColor={T.ink4}
                multiline
                maxLength={2000}
                style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15.5, color: T.ink, maxHeight: 120, lineHeight: 21, paddingVertical: 0 }}
              />
            </View>

            <TouchableOpacity
              onPress={onSubmit}
              disabled={!canSend}
              accessibilityLabel={editingMsg ? 'Save edit' : 'Send'}
              style={{
                width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
                backgroundColor: canSend ? T.primary : T.surface2,
              }}
            >
              <Ionicons name={editingMsg ? 'checkmark' : 'send'} size={editingMsg ? 22 : 18} color={canSend ? T.onPrimary : T.ink4} style={editingMsg ? undefined : { marginLeft: 2 }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Context menu ── */}
        <FloatingContextMenu
          visible={contextMenu.visible}
          pageY={contextMenu.pageY}
          msg={contextMenu.msg}
          isMine={contextMenu.msg?.sender_id === myId}
          myReaction={myReactionInMenu}
          onReply={startReply}
          onReact={(emoji) => contextMenu.msg && toggleReaction(contextMenu.msg.id, emoji)}
          onEdit={startEdit}
          onDelete={deleteMessage}
          onSelect={startSelect}
          onDismiss={dismissContextMenu}
        />

        {/* ── Fullscreen image viewer ── */}
        <Modal visible={!!viewingImage} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewingImage(null)}>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
            <TouchableOpacity
              onPress={() => setViewingImage(null)}
              style={{ position: 'absolute', top: insets.top + 10, right: 16, zIndex: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <GestureDetector gesture={pinchGesture}>
              <Animated.View style={[{ flex: 1, justifyContent: 'center', alignItems: 'center' }, animatedImageStyle]}>
                {viewingImage && (
                  <Image source={{ uri: viewingImage }} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 }} resizeMode="contain" />
                )}
              </Animated.View>
            </GestureDetector>
          </GestureHandlerRootView>
        </Modal>

        {/* ── Attach sheet ── */}
        <Sheet visible={showAttachSheet} onClose={() => setShowAttachSheet(false)}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[
              { icon: 'camera', label: 'Camera', action: takePhoto },
              { icon: 'images', label: 'Gallery', action: pickFromGallery },
              ...(actingAsVendor ? [{ icon: 'receipt', label: 'Request pay', action: () => { setShowAttachSheet(false); setTimeout(() => setShowPaymentSheet(true), 250); } }] : []),
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                onPress={item.action}
                activeOpacity={0.8}
                style={{ flex: 1, alignItems: 'center', gap: 8, paddingVertical: 18, borderRadius: 18, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line }}
              >
                <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={item.icon as any} size={24} color={T.primary} />
                </View>
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13.5, color: T.ink }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Sheet>

        {/* ── Product enquiry ── */}
        <Sheet visible={showProductEnquiry} onClose={() => setShowProductEnquiry(false)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, marginBottom: 18 }}>
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="cube-outline" size={22} color={T.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: T.ink }}>{productName}</Text>
              {!!productPrice && <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: T.primaryInk, marginTop: 2 }}>{productPrice}</Text>}
            </View>
          </View>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: T.ink, marginBottom: 4 }}>Ask about this product?</Text>
          <Text style={{ fontSize: 13.5, color: T.ink3, lineHeight: 19, marginBottom: 18 }}>
            We'll send {otherName || 'the vendor'} a quick message about it.
          </Text>
          <TouchableOpacity onPress={sendEnquiry} style={{ backgroundColor: T.primary, borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <Ionicons name="send" size={16} color={T.onPrimary} />
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: T.onPrimary }}>Send enquiry</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowProductEnquiry(false)} style={{ height: 46, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: T.ink3 }}>Not now</Text>
          </TouchableOpacity>
        </Sheet>

        {/* ── Pay: choose pickup / delivery ── */}
        <Sheet visible={!!pendingPayPr} onClose={() => setPendingPayPr(null)} avoidKeyboard>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: T.ink, marginBottom: 4 }}>How do you want to receive it?</Text>
          <Text style={{ fontSize: 13, color: T.ink3, marginBottom: 18, lineHeight: 18 }}>
            Your payment is held in escrow and only released to the vendor after you confirm the order.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            {(['pickup', 'delivery'] as const).map((t) => {
              const active = payOrderType === t;
              const locked = !!pendingPayPr?.is_delivery && t === 'pickup';
              return (
                <TouchableOpacity
                  key={t}
                  disabled={locked}
                  onPress={() => setPayOrderType(t)}
                  style={{
                    flex: 1, padding: 14, borderRadius: 16, borderWidth: 1.5, opacity: locked ? 0.4 : 1,
                    borderColor: active ? T.primary : T.line, backgroundColor: active ? T.primarySoft : T.surface,
                  }}
                >
                  <Ionicons name={t === 'pickup' ? 'storefront-outline' : 'bicycle-outline'} size={22} color={active ? T.primary : T.ink3} />
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: active ? T.primaryInk : T.ink, marginTop: 8 }}>
                    {t === 'pickup' ? 'Pickup' : 'Delivery'}
                  </Text>
                  <Text style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>
                    {t === 'pickup' ? 'Collect from vendor' : 'A runner brings it'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {payOrderType === 'delivery' && (
            <Animated.View entering={FadeInDown.duration(160)}>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: T.ink3, marginBottom: 8, letterSpacing: 0.5 }}>DELIVERY ADDRESS</Text>
              <TextInput
                value={payDeliveryAddress}
                onChangeText={setPayDeliveryAddress}
                editable={!pendingPayPr?.delivery_address}
                placeholder="Street, area, city"
                placeholderTextColor={T.ink4}
                multiline
                style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14.5, color: T.ink, minHeight: 56, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16, textAlignVertical: 'top' }}
              />
            </Animated.View>
          )}
          <TouchableOpacity
            onPress={confirmPayNow}
            style={{ backgroundColor: T.primary, borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
          >
            <Ionicons name="lock-closed" size={16} color={T.onPrimary} />
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15.5, color: T.onPrimary }}>
              Pay {pendingPayPr ? formatAmount(pendingPayPr.amount + (pendingPayPr.is_delivery ? pendingPayPr.delivery_fee ?? 0 : 0)) : ''}
            </Text>
          </TouchableOpacity>
        </Sheet>

        {/* ── Vendor: create payment request ── */}
        <Sheet visible={showPaymentSheet} onClose={() => setShowPaymentSheet(false)} avoidKeyboard>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="receipt-outline" size={21} color={T.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: T.ink }}>Request payment</Text>
              <Text style={{ fontSize: 12.5, color: T.ink3 }}>{otherName || 'The buyer'} pays securely into escrow</Text>
            </View>
          </View>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: T.ink3, marginBottom: 8, letterSpacing: 0.5 }}>AMOUNT</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 62, paddingHorizontal: 16, marginBottom: 14, borderRadius: 16, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 24, color: T.ink3 }}>₦</Text>
            <TextInput
              value={payAmount}
              onChangeText={(v) => setPayAmount(v.replace(/[^0-9.]/g, ''))}
              placeholder="0"
              placeholderTextColor={T.ink4}
              keyboardType="decimal-pad"
              autoFocus
              style={{ flex: 1, fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 28, color: T.ink, paddingVertical: 0 }}
            />
          </View>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: T.ink3, marginBottom: 8, letterSpacing: 0.5 }}>WHAT'S IT FOR? (OPTIONAL)</Text>
          <TextInput
            value={payDescription}
            onChangeText={setPayDescription}
            placeholder="e.g. 2 pairs of red sneakers, size 42"
            placeholderTextColor={T.ink4}
            multiline
            maxLength={200}
            style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14.5, color: T.ink, maxHeight: 90, minHeight: 48, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20, textAlignVertical: 'top' }}
          />
          <TouchableOpacity
            onPress={sendPaymentRequest}
            disabled={sendingPaymentRequest || !parseFloat(payAmount)}
            style={{
              height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
              backgroundColor: parseFloat(payAmount) ? T.primary : T.surface2,
            }}
          >
            {sendingPaymentRequest ? <ActivityIndicator color={T.onPrimary} /> : (
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15.5, color: parseFloat(payAmount) ? T.onPrimary : T.ink4 }}>
                Send request{parseFloat(payAmount) ? ` · ${formatAmount(parseFloat(payAmount))}` : ''}
              </Text>
            )}
          </TouchableOpacity>
        </Sheet>

        {alertElement}
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}
