import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator,
  Modal, Dimensions, TextInput as RNTextInput, Pressable,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/ui/StyledText';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { chatApi, storageApi, analyticsApi } from '../../lib/api';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuthStore } from '../../stores/authStore';
import { useVendrAlert } from '../../components/ui/VendrAlert';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  FadeIn,
  FadeOut,
  FadeInDown,
  FadeOutDown,
  SlideInRight,
  SlideInLeft,
  ZoomIn,
  ZoomOut,
  Layout,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import {
  connectSocket,
  disconnectSocket,
  joinConversation,
  leaveConversation,
} from '../../lib/socket';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const REACTION_EMOJIS = ['❤️', '😂', '👍', '🔥', '😮', '😢'];

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
  content: string | null;
  image_url: string | null;
  type: string;
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
}

interface PaymentRequest {
  id: string;
  vendor_id: string;
  buyer_id: string;
  conversation_id: string | null;
  amount: number;
  description: string | null;
  status: 'pending' | 'paid' | 'cancelled';
  paid_at?: string;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatAmount(n: number) {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2 });
}

function getDateLabel(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

// ── Typing Indicator ───────────────────────────────────────────────────────
function TypingDot({ delay }: { delay: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(-4, { duration: 300 }),
        withTiming(0, { duration: 300 })
      ), -1, false
    ));
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={[{
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: '#6B5E50', marginHorizontal: 2,
    }, style]} />
  );
}

function TypingBubble() {
  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOut.duration(150)}
      style={{
        flexDirection: 'row', alignItems: 'flex-end',
        paddingHorizontal: 16, paddingBottom: 4,
      }}
    >
      <View style={{
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: '#2A1F14', alignItems: 'center',
        justifyContent: 'center', marginRight: 6,
      }}>
        <Ionicons name="person" size={14} color="#6B5E50" />
      </View>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#1E1610',
        borderRadius: 20, borderBottomLeftRadius: 4,
        paddingHorizontal: 16, paddingVertical: 14,
        borderWidth: 1, borderColor: '#2A1F14',
      }}>
        <TypingDot delay={0} />
        <TypingDot delay={150} />
        <TypingDot delay={300} />
      </View>
    </Animated.View>
  );
}

// ── Date Separator ─────────────────────────────────────────────────────────
function DateSeparator({ label }: { label: string }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      marginVertical: 16, paddingHorizontal: 16,
    }}>
      <View style={{ flex: 1, height: 1, backgroundColor: '#1E1610' }} />
      <View style={{
        backgroundColor: '#1E1610',
        paddingHorizontal: 12, paddingVertical: 4,
        borderRadius: 20, marginHorizontal: 8,
        borderWidth: 1, borderColor: '#2A1F14',
      }}>
        <Text style={{
          fontSize: 11, fontFamily: 'SpaceGrotesk_500Medium',
          color: '#6B5E50', letterSpacing: 0.3,
        }}>{label}</Text>
      </View>
      <View style={{ flex: 1, height: 1, backgroundColor: '#1E1610' }} />
    </View>
  );
}

// ── Reply Quote inside bubble ──────────────────────────────────────────────
function ReplyQuote({ replyTo, isMine, myId }: {
  replyTo: ReplyPreview; isMine: boolean; myId: string;
}) {
  const isOwn = replyTo.sender_id === myId;
  return (
    <View style={{
      backgroundColor: isMine ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.06)',
      borderLeftWidth: 3, borderLeftColor: '#E8521A',
      borderRadius: 8, borderBottomLeftRadius: 0,
      padding: 8, marginBottom: 6,
    }}>
      <Text style={{
        fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11,
        color: '#E8521A', marginBottom: 2,
      }}>
        {isOwn ? 'You' : 'Them'}
      </Text>
      {replyTo.type === 'image' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="image-outline" size={11} color="#9A8570" />
          <Text style={{ fontSize: 12, color: '#9A8570', fontFamily: 'SpaceGrotesk_400Regular' }}>Photo</Text>
        </View>
      ) : (
        <Text style={{
          fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12,
          color: isMine ? 'rgba(255,255,255,0.65)' : '#9A8570',
        }} numberOfLines={2}>
          {replyTo.content ?? 'Message deleted'}
        </Text>
      )}
    </View>
  );
}

// ── Reaction Pill Row ──────────────────────────────────────────────────────
function ReactionRow({ reactions, myId, onPress }: {
  reactions: Reaction[]; myId: string;
  onPress: (emoji: string) => void;
}) {
  if (!reactions?.length) return null;
  const grouped: Record<string, { count: number; mine: boolean }> = {};
  reactions.forEach(r => {
    if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, mine: false };
    grouped[r.emoji].count++;
    if (r.user_id === myId) grouped[r.emoji].mine = true;
  });
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
      {Object.entries(grouped).map(([emoji, { count, mine }]) => (
        <TouchableOpacity
          key={emoji}
          onPress={() => onPress(emoji)}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: mine ? 'rgba(232,82,26,0.15)' : '#1A1208',
            borderWidth: 1,
            borderColor: mine ? 'rgba(232,82,26,0.4)' : '#2A1F14',
            borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3, gap: 3,
          }}
        >
          <Text style={{ fontSize: 13 }}>{emoji}</Text>
          {count > 1 && (
            <Text style={{
              fontSize: 11, fontFamily: 'SpaceGrotesk_600SemiBold',
              color: mine ? '#E8521A' : '#6B5E50',
            }}>{count}</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Swipe Reply Indicator ──────────────────────────────────────────────────
function SwipeReplyIcon({ translateX, isMine }: {
  translateX: Animated.SharedValue<number>; isMine: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const progress = isMine
      ? Math.min(1, Math.abs(translateX.value) / 55)
      : Math.min(1, translateX.value / 55);
    return {
      opacity: progress,
      transform: [{ scale: 0.6 + progress * 0.4 }],
    };
  });
  return (
    <Animated.View style={[{
      position: 'absolute',
      [isMine ? 'right' : 'left']: -36,
      top: '50%', marginTop: -14,
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: '#2A1F14',
      alignItems: 'center', justifyContent: 'center',
    }, style]}>
      <Ionicons name="return-down-forward-outline" size={14} color="#E8521A" />
    </Animated.View>
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────────
function MessageBubble({
  msg, isMine, isFirstInGroup, isLastInGroup, myId,
  onLongPress, onImagePress, onSwipeReply, onReactionPress,
  isSelected, selectionMode, onSelect,
}: {
  msg: Message; isMine: boolean;
  isFirstInGroup: boolean; isLastInGroup: boolean;
  myId: string;
  onLongPress: (msg: Message, pageY: number) => void;
  onImagePress: (url: string) => void;
  onSwipeReply: (msg: Message) => void;
  onReactionPress: (messageId: string, emoji: string) => void;
  isSelected: boolean; selectionMode: boolean;
  onSelect: (msg: Message) => void;
}) {
  const translateX = useSharedValue(0);
  const hasTriggered = useSharedValue(false);

  const swipeGesture = Gesture.Pan()
    .activeOffsetX(isMine ? [-20, 999] : [-999, 20])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      if (isMine) {
        translateX.value = Math.max(-60, Math.min(0, e.translationX));
      } else {
        translateX.value = Math.max(0, Math.min(60, e.translationX));
      }
      const threshold = 50;
      const triggered = isMine
        ? translateX.value <= -threshold
        : translateX.value >= threshold;
      if (triggered && !hasTriggered.value) {
        hasTriggered.value = true;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      }
      if (!triggered) hasTriggered.value = false;
    })
    .onEnd(() => {
      const threshold = 50;
      const shouldReply = isMine
        ? translateX.value <= -threshold
        : translateX.value >= threshold;
      if (shouldReply) runOnJS(onSwipeReply)(msg);
      translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const bubbleRef = useRef<View>(null);

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (selectionMode) { onSelect(msg); return; }
    bubbleRef.current?.measure((x, y, w, h, px, py) => {
      onLongPress(msg, py);
    });
  };

  if (msg.deleted) {
    return (
      <View style={{
        alignSelf: isMine ? 'flex-end' : 'flex-start',
        marginBottom: isLastInGroup ? 8 : 2,
        marginHorizontal: 16,
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: '#141009',
        borderWidth: 1, borderColor: '#1E1610', borderStyle: 'dashed',
        borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7,
      }}>
        <Ionicons name="ban-outline" size={12} color="#3D3026" />
        <Text style={{
          fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12,
          color: '#3D3026', fontStyle: 'italic',
        }}>Message deleted</Text>
      </View>
    );
  }

  const isTemp = msg.id.startsWith('temp-');
  // Margin between messages: tight within group, more between groups
  const marginBottom = isLastInGroup ? 6 : 2;
  // Top corner radius logic
  const br = {
    borderTopRightRadius: isMine ? (isFirstInGroup ? 4 : 18) : 18,
    borderBottomRightRadius: isMine ? (isLastInGroup ? 18 : 6) : 18,
    borderTopLeftRadius: isMine ? 18 : (isFirstInGroup ? 4 : 18),
    borderBottomLeftRadius: isMine ? 18 : (isLastInGroup ? 18 : 6),
  };

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View
        entering={isMine ? SlideInRight.duration(200).springify() : SlideInLeft.duration(200).springify()}
        style={[
          {
            marginBottom,
            paddingHorizontal: 10,
            flexDirection: 'row',
            justifyContent: isMine ? 'flex-end' : 'flex-start',
            alignItems: 'flex-end',
          },
          animStyle,
        ]}
      >
        {/* Avatar for other user (only on last in group) */}
        {!isMine && (
          <View style={{ width: 28, marginRight: 6, marginBottom: 2, alignSelf: 'flex-end' }}>
            {isLastInGroup ? (
              <View style={{
                width: 28, height: 28, borderRadius: 14,
                backgroundColor: '#2A1F14',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="person" size={14} color="#6B5E50" />
              </View>
            ) : null}
          </View>
        )}

        <View style={{ maxWidth: SCREEN_WIDTH * 0.75, position: 'relative' }}>
          {/* Swipe reply icon */}
          <SwipeReplyIcon translateX={translateX} isMine={isMine} />

          {/* Selection check */}
          {selectionMode && (
            <View style={{
              position: 'absolute',
              [isMine ? 'right' : 'left']: -30,
              top: 0, bottom: 0,
              justifyContent: 'center', zIndex: 10,
            }}>
              <View style={{
                width: 20, height: 20, borderRadius: 10,
                borderWidth: 2,
                borderColor: isSelected ? '#E8521A' : '#3D3026',
                backgroundColor: isSelected ? '#E8521A' : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {isSelected && <Ionicons name="checkmark" size={12} color="white" />}
              </View>
            </View>
          )}

          <Pressable
            ref={bubbleRef as any}
            onPress={() => selectionMode && onSelect(msg)}
            onLongPress={handleLongPress}
            delayLongPress={300}
          >
            {/* Reply quote */}
            {msg.reply_to && (
              <View style={{ marginBottom: 0 }}>
                <ReplyQuote replyTo={msg.reply_to} isMine={isMine} myId={myId} />
              </View>
            )}

            {/* Image bubble */}
            {msg.type === 'image' && msg.image_url ? (
              <TouchableOpacity
                onPress={() => onImagePress(msg.image_url!)}
                onLongPress={handleLongPress}
                delayLongPress={300}
                activeOpacity={0.95}
              >
                <Image
                  source={{ uri: msg.image_url }}
                  style={{
                    width: 230, height: 230,
                    borderRadius: 18, ...br,
                    opacity: isTemp ? 0.65 : 1,
                  }}
                  resizeMode="cover"
                />
                {isTemp && (
                  <View style={{
                    position: 'absolute', bottom: 8, right: 8,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    borderRadius: 10, padding: 4,
                  }}>
                    <ActivityIndicator size="small" color="white" />
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              /* Text bubble */
              <View style={{
                backgroundColor: isMine ? '#E8521A' : '#1E1610',
                ...br,
                borderWidth: isMine ? 0 : 1,
                borderColor: '#2A1F14',
                paddingHorizontal: 13,
                paddingTop: 9,
                paddingBottom: 7,
                ...(isSelected ? {
                  backgroundColor: isMine ? '#c94316' : '#261A0F',
                } : {}),
              }}>
                <Text style={{
                  fontFamily: 'SpaceGrotesk_400Regular',
                  fontSize: 15, lineHeight: 21,
                  color: isMine ? '#FFFFFF' : '#EDE3D5',
                }}>
                  {msg.content}
                </Text>

                {/* Time + status row inside bubble */}
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  justifyContent: 'flex-end', gap: 3,
                  marginTop: 3,
                }}>
                  {msg.edited && (
                    <Text style={{
                      fontSize: 10, fontFamily: 'SpaceGrotesk_400Regular',
                      color: isMine ? 'rgba(255,255,255,0.45)' : '#4A3D30',
                    }}>edited</Text>
                  )}
                  <Text style={{
                    fontSize: 10, fontFamily: 'SpaceGrotesk_400Regular',
                    color: isMine ? 'rgba(255,255,255,0.5)' : '#4A3D30',
                  }}>
                    {formatTime(msg.created_at)}
                  </Text>
                  {isMine && (
                    isTemp ? (
                      <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.4)" />
                    ) : (
                      <Ionicons
                        name={msg.is_read ? 'checkmark-done' : msg.delivered ? 'checkmark-done' : 'checkmark'}
                        size={13}
                        color={msg.is_read ? '#67D8FF' : 'rgba(255,255,255,0.5)'}
                      />
                    )
                  )}
                </View>
              </View>
            )}

            {/* Time for image (outside bubble) */}
            {msg.type === 'image' && (
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                justifyContent: isMine ? 'flex-end' : 'flex-start',
                gap: 3, marginTop: 3, paddingHorizontal: 2,
              }}>
                <Text style={{
                  fontSize: 10, fontFamily: 'SpaceGrotesk_400Regular', color: '#4A3D30',
                }}>{formatTime(msg.created_at)}</Text>
                {isMine && !isTemp && (
                  <Ionicons
                    name={msg.is_read ? 'checkmark-done' : 'checkmark'}
                    size={12} color={msg.is_read ? '#67D8FF' : '#4A3D30'}
                  />
                )}
              </View>
            )}
          </Pressable>

          {/* Reactions */}
          {msg.reactions?.length > 0 && (
            <View style={{ alignSelf: isMine ? 'flex-end' : 'flex-start' }}>
              <ReactionRow
                reactions={msg.reactions}
                myId={myId}
                onPress={(emoji) => onReactionPress(msg.id, emoji)}
              />
            </View>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// ── Payment Request Bubble ─────────────────────────────────────────────────
function PaymentRequestBubble({ msg, isMine, paymentRequest, onPay, onCancel, paying }: {
  msg: Message; isMine: boolean; paymentRequest: PaymentRequest | null;
  onPay: (pr: PaymentRequest) => void;
  onCancel: (pr: PaymentRequest) => void;
  paying: string | null;
}) {
  if (!paymentRequest) return null;
  const isPaid = paymentRequest.status === 'paid';
  const isCancelled = paymentRequest.status === 'cancelled';
  const statusColor = isPaid ? '#2D8653' : isCancelled ? '#4A3D30' : '#F5A623';

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify()}
      style={{
        marginBottom: 10, marginHorizontal: 10,
        alignSelf: isMine ? 'flex-end' : 'flex-start',
        maxWidth: SCREEN_WIDTH * 0.82,
      }}
    >
      <View style={{
        backgroundColor: '#1A1208',
        borderWidth: 1,
        borderColor: isPaid ? 'rgba(45,134,83,0.35)' : isCancelled ? '#1E1610' : 'rgba(245,166,35,0.3)',
        borderRadius: 20,
        borderTopRightRadius: isMine ? 4 : 20,
        borderTopLeftRadius: isMine ? 20 : 4,
        overflow: 'hidden', minWidth: 240,
      }}>
        <View style={{ height: 3, backgroundColor: statusColor }} />
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{
                width: 30, height: 30, borderRadius: 10,
                backgroundColor: `${statusColor}18`,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="cash-outline" size={15} color={statusColor} />
              </View>
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 12, color: '#FDF6EC', letterSpacing: 0.3 }}>
                PAYMENT REQUEST
              </Text>
            </View>
            <View style={{
              backgroundColor: `${statusColor}15`,
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
            }}>
              <Text style={{
                fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 10,
                color: statusColor, textTransform: 'uppercase', letterSpacing: 0.5,
              }}>
                {isPaid ? 'Paid' : isCancelled ? 'Cancelled' : 'Pending'}
              </Text>
            </View>
          </View>
          <Text style={{
            fontFamily: 'SpaceGrotesk_700Bold', fontSize: 28,
            color: '#FDF6EC', marginBottom: paymentRequest.description ? 6 : 14,
          }}>
            {formatAmount(paymentRequest.amount)}
          </Text>
          {paymentRequest.description && (
            <Text style={{
              fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13,
              color: '#6B5E50', marginBottom: 14, lineHeight: 18,
            }}>
              {paymentRequest.description}
            </Text>
          )}
          {!isPaid && !isCancelled && !isMine && (
            <TouchableOpacity
              onPress={() => onPay(paymentRequest)}
              disabled={paying === paymentRequest.id}
              style={{
                backgroundColor: '#E8521A', borderRadius: 12, height: 46,
                alignItems: 'center', justifyContent: 'center',
                flexDirection: 'row', gap: 8,
              }}
            >
              {paying === paymentRequest.id
                ? <ActivityIndicator size="small" color="white" />
                : <>
                    <Ionicons name="wallet-outline" size={16} color="white" />
                    <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: 'white' }}>Pay Now</Text>
                  </>}
            </TouchableOpacity>
          )}
          {!isPaid && !isCancelled && isMine && (
            <TouchableOpacity
              onPress={() => onCancel(paymentRequest)}
              style={{
                backgroundColor: 'transparent', borderRadius: 12, height: 38,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: '#2A1F14',
              }}
            >
              <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, color: '#4A3D30' }}>Cancel Request</Text>
            </TouchableOpacity>
          )}
          {isPaid && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="checkmark-circle" size={13} color="#2D8653" />
              <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12, color: '#2D8653' }}>
                Paid {paymentRequest.paid_at ? formatTime(paymentRequest.paid_at) : ''}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        justifyContent: isMine ? 'flex-end' : 'flex-start',
        marginTop: 3, paddingHorizontal: 4,
      }}>
        <Text style={{ fontSize: 10, fontFamily: 'SpaceGrotesk_400Regular', color: '#4A3D30' }}>
          {formatTime(msg.created_at)}
        </Text>
      </View>
    </Animated.View>
  );
}

// ── Floating Context Menu ──────────────────────────────────────────────────
// Replaces the old bottom sheet actions with a WhatsApp-style floating menu
function FloatingContextMenu({
  visible, pageY, msg, isMine, myId,
  onReply, onReact, onEdit, onDelete, onSelect, onCopy, onDismiss,
}: {
  visible: boolean; pageY: number; msg: Message | null; isMine: boolean; myId: string;
  onReply: () => void; onReact: () => void;
  onEdit: () => void; onDelete: () => void;
  onSelect: () => void; onCopy: () => void;
  onDismiss: () => void;
}) {
  if (!visible || !msg) return null;

  // Determine if menu should appear above or below the message
  const showAbove = pageY > SCREEN_HEIGHT * 0.55;
  const menuTop = showAbove ? pageY - 220 : pageY + 10;

  const actions = [
    { icon: 'return-down-forward-outline', label: 'Reply', onPress: onReply, color: '#FDF6EC' },
    ...(msg.type !== 'image' ? [{ icon: 'copy-outline', label: 'Copy', onPress: onCopy, color: '#FDF6EC' }] : []),
    ...(isMine && msg.type !== 'image' && !msg.deleted
      ? [{ icon: 'create-outline', label: 'Edit', onPress: onEdit, color: '#FDF6EC' }]
      : []),
    { icon: 'checkmark-circle-outline', label: 'Select', onPress: onSelect, color: '#FDF6EC' },
    ...(isMine && !msg.deleted
      ? [{ icon: 'trash-outline', label: 'Delete', onPress: onDelete, color: '#FF6B6B' }]
      : []),
  ] as Array<{ icon: string; label: string; onPress: () => void; color: string }>;

  return (
    <Modal visible={visible} transparent animationType="none">
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        onPress={onDismiss}
      >
        {/* Reaction bar */}
        <Animated.View
          entering={ZoomIn.duration(180).springify()}
          style={{
            position: 'absolute',
            top: Math.max(60, menuTop - 60),
            [isMine ? 'right' : 'left']: 16,
            backgroundColor: '#1E1610',
            borderRadius: 28, padding: 6,
            flexDirection: 'row', gap: 2,
            borderWidth: 1, borderColor: '#2A1F14',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.5, shadowRadius: 16,
            elevation: 12,
          }}
        >
          {REACTION_EMOJIS.map((emoji, i) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => { onDismiss(); onReact(); }}
              style={{
                width: 42, height: 42, borderRadius: 21,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 24 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Action menu */}
        <Animated.View
          entering={ZoomIn.duration(180).springify()}
          style={{
            position: 'absolute',
            top: Math.max(120, menuTop),
            [isMine ? 'right' : 'left']: 16,
            backgroundColor: '#1E1610',
            borderRadius: 16, overflow: 'hidden',
            borderWidth: 1, borderColor: '#2A1F14',
            minWidth: 180,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.5, shadowRadius: 16,
            elevation: 12,
          }}
        >
          {actions.map((action, i) => (
            <TouchableOpacity
              key={action.label}
              onPress={() => { onDismiss(); action.onPress(); }}
              style={{
                flexDirection: 'row', alignItems: 'center',
                gap: 12, paddingHorizontal: 16, paddingVertical: 13,
                borderBottomWidth: i < actions.length - 1 ? 1 : 0,
                borderBottomColor: '#2A1F14',
              }}
            >
              <Ionicons name={action.icon as any} size={17} color={action.color} />
              <Text style={{
                fontFamily: 'SpaceGrotesk_500Medium', fontSize: 14,
                color: action.color,
              }}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ── Floating Reaction Picker ───────────────────────────────────────────────
function FloatingReactionPicker({
  visible, onSelect, onDismiss,
}: {
  visible: boolean;
  onSelect: (emoji: string) => void;
  onDismiss: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="none">
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' }}
        onPress={onDismiss}
      >
        <Animated.View
          entering={ZoomIn.duration(200).springify()}
          exiting={ZoomOut.duration(150)}
          style={{
            backgroundColor: '#1E1610',
            borderRadius: 32, padding: 10,
            flexDirection: 'row', gap: 4,
            borderWidth: 1, borderColor: '#2A1F14',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.6, shadowRadius: 24,
            elevation: 14,
          }}
        >
          {REACTION_EMOJIS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => onSelect(emoji)}
              style={{
                width: 52, height: 52, borderRadius: 26,
                backgroundColor: '#2A1F14',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 28 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ── Reply Strip ────────────────────────────────────────────────────────────
function ReplyStrip({ replyTo, myId, onCancel }: {
  replyTo: Message; myId: string; onCancel: () => void;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(140)}
      style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#141009',
        borderTopWidth: 1, borderColor: '#1E1610',
        paddingHorizontal: 16, paddingVertical: 10, gap: 10,
      }}
    >
      <View style={{ width: 3, alignSelf: 'stretch', backgroundColor: '#E8521A', borderRadius: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={{
          fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12,
          color: '#E8521A', marginBottom: 2,
        }}>
          {replyTo.sender_id === myId ? 'Replying to yourself' : 'Replying'}
        </Text>
        {replyTo.type === 'image' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="image-outline" size={12} color="#6B5E50" />
            <Text style={{ fontSize: 12, color: '#6B5E50', fontFamily: 'SpaceGrotesk_400Regular' }}>Photo</Text>
          </View>
        ) : (
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50' }} numberOfLines={1}>
            {replyTo.content}
          </Text>
        )}
      </View>
      <TouchableOpacity onPress={onCancel} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Ionicons name="close" size={18} color="#4A3D30" />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { vendorId, conversationId, productId, productName, productPrice } = useLocalSearchParams<{
    vendorId?: string; conversationId?: string;
    productId?: string; productName?: string; productPrice?: string;
  }>();

  const { user } = useAuthStore();
  const { showAlert: vendrAlert, alertElement } = useVendrAlert();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [convId, setConvId] = useState<string | null>(null);
  const [buyerId, setBuyerId] = useState('');
  const [vendorDbId, setVendorDbId] = useState('');
  const [vendorUserId, setVendorUserId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorActualId, setVendorActualId] = useState('');
  const [vendorLogoUrl, setVendorLogoUrl] = useState<string | null>(null);
  const [vendorAvatarUrl, setVendorAvatarUrl] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [actingAsVendor, setActingAsVendor] = useState(false);
  const [buyerAvatar, setBuyerAvatar] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);

  // UI State
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [showAttachSheet, setShowAttachSheet] = useState(false);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [showProductEnquiry, setShowProductEnquiry] = useState(false);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Context menu (replaces showActions sheet)
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean; msg: Message | null; pageY: number; isMine: boolean;
  }>({ visible: false, msg: null, pageY: 0, isMine: false });

  // Reaction picker
  const [reactionPicker, setReactionPicker] = useState<{
    visible: boolean; messageId: string | null;
  }>({ visible: false, messageId: null });

  // Payment
  const [payAmount, setPayAmount] = useState('');
  const [payDescription, setPayDescription] = useState('');
  const [sendingPaymentRequest, setSendingPaymentRequest] = useState(false);
  const [showPayOrderSheet, setShowPayOrderSheet] = useState(false);
  const [pendingPayPr, setPendingPayPr] = useState<PaymentRequest | null>(null);
  const [payOrderType, setPayOrderType] = useState<'pickup' | 'delivery'>('pickup');
  const [payDeliveryAddress, setPayDeliveryAddress] = useState('');

  // Image viewer zoom
  const scale = useSharedValue(1);
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => { scale.value = Math.max(1, e.scale); })
    .onEnd(() => { scale.value = withSpring(1); });
  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  useEffect(() => { if (viewingImage) scale.value = 1; }, [viewingImage]);

  useEffect(() => { if (!user?.id) return; initChat(); }, []);

  const initChat = async () => {
    const userId = user!.id;
    setError(null);
    try {
      let cid: string | null = null;
      const isValidUUID = (s?: string) => !!s && s !== '[conversationId]' && s.includes('-');
      if (isValidUUID(conversationId)) {
        cid = conversationId!;
      } else if (vendorId) {
        const { data, error } = await chatApi.createConversation(vendorId);
        if (error) throw new Error('Could not start conversation: ' + (error as any).message);
        cid = data.id;
      }
      if (!cid) throw new Error('No conversation ID');
      setConvId(cid);

      const { data: convData } = await chatApi.getConversation(cid);
      const { conversation, vendor, buyer, actingAsVendor } = convData;
      setBuyerId(conversation.buyer_id);
      setActingAsVendor(actingAsVendor);
      setVendorDbId(conversation.vendor_id);
      setVendorUserId(vendor?.user_id ?? '');
      if (!actingAsVendor && vendor?.user_id === userId) throw new Error('You cannot chat with your own store.');

      if (actingAsVendor) {
        setVendorName(buyer?.name ?? 'Unknown Buyer');
        setBuyerAvatar(buyer?.avatar_url ?? null);
      } else {
        setVendorName(vendor?.business_name ?? 'Vendor');
        setVendorActualId(vendor?.id ?? '');
        setVendorLogoUrl(vendor?.logo_url ?? null);
        setVendorAvatarUrl(vendor?.avatar_url ?? null);
        setIsVerified(vendor?.is_verified ?? false);
      }

      const { data: msgs } = await chatApi.getMessages(cid, { limit: 30 });
      setMessages(msgs ?? []);
      if (!msgs || msgs.length < 30) setHasMore(false);

      await chatApi.markDelivered(cid);
      await chatApi.resetUnread(cid, actingAsVendor ? 'vendor_unread' : 'buyer_unread');
      await chatApi.markAsRead(cid);
      await chatApi.setPresence(true);

      const socket = await connectSocket();
      if (socket && cid) {
        joinConversation(cid);
        socket.on('messages_read', (data: { conversationId: string; messageIds: string[]; readBy: string }) => {
          if (data.conversationId === cid)
            setMessages(prev => prev.map(m => data.messageIds.includes(m.id) ? { ...m, is_read: true } : m));
        });
        socket.on('user_presence', (data: { userId: string; isOnline: boolean; lastSeen?: string }) => {
          const otherUserId = actingAsVendor ? conversation.buyer_id : vendor?.user_id;
          if (data.userId === otherUserId) { setOtherOnline(data.isOnline); setLastSeen(data.lastSeen ?? null); }
        });
        socket.on('reaction_added', (data: { messageId: string; reaction: Reaction }) => {
          setMessages(prev => prev.map(m => {
            if (m.id !== data.messageId) return m;
            const reactions = [...m.reactions];
            const idx = reactions.findIndex(r => r.user_id === data.reaction.user_id);
            if (idx >= 0) reactions[idx] = data.reaction; else reactions.push(data.reaction);
            return { ...m, reactions };
          }));
        });
        socket.on('reaction_removed', (data: { messageId: string; userId: string }) => {
          setMessages(prev => prev.map(m => m.id !== data.messageId ? m : { ...m, reactions: m.reactions.filter(r => r.user_id !== data.userId) }));
        });
        socket.on('message_deleted', (data: { messageId: string }) => {
          setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, deleted: true, content: null, image_url: null } : m));
        });
        socket.on('new_message', (newMsg: Message) => {
          if (newMsg.conversation_id === cid) {
            setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
          }
        });
        socket.on('user_typing', (data: { conversationId: string }) => {
          if (data.conversationId === cid) {
            setOtherUserTyping(true);
            setTimeout(() => setOtherUserTyping(false), 3000);
          }
        });
      }

      const otherUserId = actingAsVendor ? conversation.buyer_id : vendor?.user_id;
      if (otherUserId) {
        try {
          const { data: presenceData } = await chatApi.getPresence([otherUserId]);
          const presence = (presenceData as any)[otherUserId] || presenceData;
          setOtherOnline(presence?.is_online ?? false);
          setLastSeen(presence?.last_seen ?? null);
        } catch { setOtherOnline(false); }
      }

      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 150);
      setLoading(false);
      if (productName) setTimeout(() => setShowProductEnquiry(true), 400);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (convId) leaveConversation(convId);
      disconnectSocket();
      if (user?.id) chatApi.setPresence(false).catch(console.error);
    };
  }, [convId, user]);

  const loadOlderMessages = async () => {
    if (!convId || loadingMore || !hasMore || !messages.length) return;
    setLoadingMore(true);
    try {
      const { data } = await chatApi.getMessages(convId, { limit: 30, before: messages[0].created_at });
      if (!data?.length) { setHasMore(false); return; }
      setMessages(prev => [...data, ...prev]);
    } catch (err) { console.error(err); }
    finally { setLoadingMore(false); }
  };

  // ─── Reactions ─────────────────────────────────────────────────────────
  const handleReactionSelect = async (emoji: string) => {
    const messageId = reactionPicker.messageId;
    if (!messageId || !user?.id) return;
    setReactionPicker({ visible: false, messageId: null });
    // Optimistic
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const reactions = [...m.reactions];
      const idx = reactions.findIndex(r => r.user_id === user.id);
      const newR: Reaction = { id: `tmp-${Date.now()}`, message_id: messageId, user_id: user.id, emoji, created_at: new Date().toISOString() };
      if (idx >= 0) reactions[idx] = newR; else reactions.push(newR);
      return { ...m, reactions };
    }));
    try { await chatApi.addReaction(messageId, emoji); } catch (e) { console.error(e); }
  };

  const handleReactionPress = async (messageId: string, emoji: string) => {
    if (!user?.id) return;
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    const myReaction = msg.reactions.find(r => r.user_id === user.id);
    if (myReaction?.emoji === emoji) {
      setMessages(prev => prev.map(m => m.id === messageId
        ? { ...m, reactions: m.reactions.filter(r => r.user_id !== user.id) } : m));
      try { await chatApi.removeReaction(messageId); } catch (e) { console.error(e); }
    } else {
      setReactionPicker({ visible: true, messageId });
    }
  };

  // ─── Context Menu ───────────────────────────────────────────────────────
  const handleLongPress = useCallback((msg: Message, pageY: number) => {
    if (msg.deleted) return;
    setContextMenu({ visible: true, msg, pageY, isMine: msg.sender_id === user?.id });
  }, [user?.id]);

  const dismissContextMenu = () => setContextMenu(prev => ({ ...prev, visible: false }));

  const handleCopy = () => {
    const msg = contextMenu.msg;
    if (msg?.content) {
      // Clipboard.setStringAsync(msg.content);
      // vendrAlert({ title: 'Copied', message: '', type: 'success' });
    }
  };

  const startEdit = () => {
    const msg = contextMenu.msg;
    if (!msg) return;
    setEditingMsg(msg);
    setText(msg.content ?? '');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const startReply = () => {
    const msg = contextMenu.msg;
    if (!msg) return;
    setReplyingTo(msg);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const startSelect = () => {
    const msg = contextMenu.msg;
    if (!msg) return;
    setSelectionMode(true);
    setSelectedIds(new Set([msg.id]));
  };

  const openReactionFromMenu = () => {
    const msg = contextMenu.msg;
    if (!msg) return;
    setReactionPicker({ visible: true, messageId: msg.id });
  };

  const deleteMessage = async () => {
    const msg = contextMenu.msg;
    if (!msg || !convId) return;
    vendrAlert({
      title: 'Delete Message?', message: 'This cannot be undone.',
      type: 'danger',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            setMessages(prev => prev.map(m => m.id === msg.id
              ? { ...m, deleted: true, content: null, image_url: null } : m));
            try { await chatApi.deleteMessage(msg.id); }
            catch { setMessages(prev => prev.map(m => m.id === msg.id ? msg : m)); }
          }
        },
      ],
    });
  };

  // ─── Selection ──────────────────────────────────────────────────────────
  const handleSelect = (msg: Message) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(msg.id) ? next.delete(msg.id) : next.add(msg.id);
      return next;
    });
  };

  const exitSelectionMode = () => { setSelectionMode(false); setSelectedIds(new Set()); };

  const deleteSelectedMessages = () => {
    vendrAlert({
      title: `Delete ${selectedIds.size} message${selectedIds.size > 1 ? 's' : ''}?`,
      message: 'This cannot be undone.', type: 'danger',
      buttons: [
        { text: 'Cancel', style: 'cancel', onPress: exitSelectionMode },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            const ids = Array.from(selectedIds);
            setMessages(prev => prev.map(m => ids.includes(m.id) && m.sender_id === user?.id
              ? { ...m, deleted: true, content: null, image_url: null } : m));
            exitSelectionMode();
            await Promise.all(ids.map(id => chatApi.deleteMessage(id).catch(console.error)));
          }
        },
      ],
    });
  };

  // ─── Image ──────────────────────────────────────────────────────────────
  const pickFromGallery = async () => {
    setShowAttachSheet(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { vendrAlert({ title: 'Permission Needed', message: 'Allow photo access.', type: 'warning' }); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    await uploadAndSendImage(result.assets[0].uri);
  };

  const takePhoto = async () => {
    setShowAttachSheet(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { vendrAlert({ title: 'Permission Needed', message: 'Allow camera access.', type: 'warning' }); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
    if (result.canceled || !result.assets[0]) return;
    await uploadAndSendImage(result.assets[0].uri);
  };

  const uploadAndSendImage = async (uri: string) => {
    if (!convId || !user?.id) return;
    setUploadingImage(true);
    const tempId = `temp-img-${Date.now()}`;
    try {
      const tempMsg: Message = {
        id: tempId, conversation_id: convId, sender_id: user!.id,
        content: null, image_url: uri, type: 'image',
        is_read: false, delivered: false, edited: false, deleted: false,
        reply_to_id: replyingTo?.id ?? null,
        reply_to: replyingTo ? { id: replyingTo.id, sender_id: replyingTo.sender_id, content: replyingTo.content, image_url: replyingTo.image_url, type: replyingTo.type } : null,
        reactions: [], created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, tempMsg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

      const fileName = `chat/${convId}/${Date.now()}.jpg`;
      const { data: signData } = await storageApi.signUpload(fileName, 'image/jpeg');
      const { uploadUrl, publicUrl } = signData;

      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

      const uploadResponse = await fetch(uploadUrl, { method: 'PUT', body: bytes, headers: { 'Content-Type': 'image/jpeg' } });
      if (!uploadResponse.ok) throw new Error(`Upload failed (${uploadResponse.status})`);

      const { data: inserted } = await chatApi.sendMessage({
        conversation_id: convId, content: null, type: 'image',
        image_url: publicUrl, reply_to_id: replyingTo?.id ?? null,
      });

      setMessages(prev => prev.map(m => m.id === tempId ? { ...inserted, reactions: [] } : m));
      setReplyingTo(null);
    } catch (e: any) {
      vendrAlert({ title: 'Upload Failed', message: e.message || 'Something went wrong', type: 'danger' });
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally { setUploadingImage(false); }
  };

  // ─── Send / Edit ────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (editingMsg) {
      const newContent = text.trim();
      if (!newContent || !convId) return;
      setSending(true);
      const prev = editingMsg;
      setMessages(ms => ms.map(m => m.id === prev.id ? { ...m, content: newContent, edited: true } : m));
      setEditingMsg(null); setText('');
      try {
        const { data: updated } = await chatApi.updateMessage(prev.id, newContent);
        setMessages(ms => ms.map(m => m.id === prev.id ? updated : m));
      } catch (err: any) {
        vendrAlert({ title: 'Error', message: err.message, type: 'danger' });
        setMessages(ms => ms.map(m => m.id === prev.id ? prev : m));
      } finally { setSending(false); }
      return;
    }

    const content = text.trim();
    if (!content || !convId || !user?.id || sending) return;
    setText('');
    setSending(true);
    const tempId = `temp-${Date.now()}`;
    const replySnapshot = replyingTo;

    setMessages(prev => [...prev, {
      id: tempId, conversation_id: convId, sender_id: user!.id,
      content, image_url: null, type: 'text',
      is_read: false, delivered: false, edited: false, deleted: false,
      reply_to_id: replySnapshot?.id ?? null,
      reply_to: replySnapshot ? { id: replySnapshot.id, sender_id: replySnapshot.sender_id, content: replySnapshot.content, image_url: replySnapshot.image_url, type: replySnapshot.type } : null,
      reactions: [], created_at: new Date().toISOString(),
    }]);
    setReplyingTo(null);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const { data: inserted } = await chatApi.sendMessage({
        conversation_id: convId, content, type: 'text',
        reply_to_id: replySnapshot?.id ?? null,
      });
      setMessages(prev => prev.map(m => m.id === tempId ? { ...inserted, reactions: inserted.reactions ?? [] } : m));
    } catch (err: any) {
      vendrAlert({ title: 'Send Failed', message: err.message, type: 'danger' });
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setText(content); setReplyingTo(replySnapshot);
    } finally { setSending(false); }
  };

  // ─── Payment ─────────────────────────────────────────────────────────────
  const sendPaymentRequest = async () => {
    const amount = parseFloat(payAmount.replace(/[^0-9.]/g, ''));
    if (!amount || amount <= 0) { vendrAlert({ title: 'Invalid Amount', message: 'Enter a valid amount.', type: 'warning' }); return; }
    if (!convId || !user?.id) return;
    setSendingPaymentRequest(true);
    try {
      const { data: msg } = await chatApi.createPaymentRequest(convId, amount, payDescription.trim());
      setMessages(prev => [...prev, msg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      setShowPaymentSheet(false); setPayAmount(''); setPayDescription('');
    } catch (e: any) { vendrAlert({ title: 'Error', message: e.message, type: 'danger' }); }
    finally { setSendingPaymentRequest(false); }
  };

  const handlePayNow = (pr: PaymentRequest) => {
    setPendingPayPr(pr); setPayOrderType('pickup'); setPayDeliveryAddress(''); setShowPayOrderSheet(true);
  };

  const confirmPayNow = async () => {
    const pr = pendingPayPr;
    if (!user?.id || !convId || !pr) return;
    if (payOrderType === 'delivery' && !payDeliveryAddress.trim()) {
      vendrAlert({ title: 'Address required', message: 'Enter a delivery address.', type: 'warning' }); return;
    }
    setShowPayOrderSheet(false);
    setPaying(pr.id);
    try {
      const { data: payResult } = await chatApi.payPaymentRequest(pr.id, { order_type: payOrderType, delivery_address: payOrderType === 'delivery' ? payDeliveryAddress.trim() : undefined });
      if (!payResult?.success) throw new Error('Payment failed');
      analyticsApi.recordOrder({ vendorId: pr.vendor_id, productId: '', amount: pr.amount }).catch(console.error);
      const updatedPr = { ...pr, status: 'paid' as const, paid_at: new Date().toISOString() };
      setMessages(prev => prev.map(msg => msg.type === 'payment_request' && msg.content === pr.id ? { ...msg, payment_request: updatedPr } : msg));
      await chatApi.sendMessage({ conversation_id: convId, content: `Payment of ${formatAmount(pr.amount)} sent successfully.`, type: 'text' });
      vendrAlert({ title: 'Payment Successful', message: `You paid ${formatAmount(pr.amount)}.`, type: 'success' });
      setPendingPayPr(null);
    } catch (e: any) { vendrAlert({ title: 'Payment Failed', message: e.message, type: 'danger' }); }
    finally { setPaying(null); }
  };

  const handleCancelRequest = (pr: PaymentRequest) => {
    vendrAlert({
      title: 'Cancel Request?', message: 'The buyer will no longer be able to pay.', type: 'question',
      buttons: [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Request', style: 'destructive', onPress: async () => {
            try {
              await chatApi.cancelPaymentRequest(pr.id);
              setMessages(prev => prev.map(msg => msg.type === 'payment_request' && msg.content === pr.id
                ? { ...msg, payment_request: { ...msg.payment_request!, status: 'cancelled' } } : msg));
            } catch (e: any) { vendrAlert({ title: 'Error', message: e.message, type: 'danger' }); }
          }
        },
      ],
    });
  };

  const sendEnquiry = async () => {
    if (!convId || !user?.id || !productName) return;
    setShowProductEnquiry(false);
    const msg = `Hi! I'm interested in your product: *${productName}*${productPrice ? ` (${productPrice})` : ''}. Is it still available?`;
    setSending(true);
    try {
      const { data: inserted } = await chatApi.sendMessage({ conversation_id: convId, content: msg, type: 'text' });
      setMessages(prev => [...prev, { ...inserted, delivered: false, is_read: false }]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) { vendrAlert({ title: 'Error', message: e.message, type: 'danger' }); }
    finally { setSending(false); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0A06', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <ActivityIndicator size="large" color="#E8521A" />
        <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#4A3D30' }}>Opening chat...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0A06', alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 }}>
        <Ionicons name="warning-outline" size={40} color="#E85555" />
        <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 16, color: '#FDF6EC', textAlign: 'center' }}>Something went wrong</Text>
        <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#4A3D30', textAlign: 'center' }}>{error}</Text>
        <TouchableOpacity onPress={() => { setLoading(true); setError(null); initChat(); }}
          style={{ backgroundColor: '#E8521A', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: 'white' }}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#4A3D30' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#0F0A06' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <StatusBar style="light" />

        {/* ── Header ── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 12, paddingTop: 52, paddingBottom: 10,
          backgroundColor: '#0F0A06',
          borderBottomWidth: 1, borderBottomColor: '#1A1208',
          gap: 8,
        }}>
          {selectionMode ? (
            <>
              <TouchableOpacity onPress={exitSelectionMode}
                style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={22} color="#FDF6EC" />
              </TouchableOpacity>
              <Text style={{ flex: 1, fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 16, color: '#FDF6EC' }}>
                {selectedIds.size} selected
              </Text>
              {selectedIds.size > 0 && (
                <TouchableOpacity onPress={deleteSelectedMessages}
                  style={{ backgroundColor: 'rgba(232,85,85,0.12)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 }}>
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#E85555' }}>Delete</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <TouchableOpacity onPress={() => router.back()}
                style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => !actingAsVendor && vendorActualId && router.push({ pathname: '/vendor/[id]', params: { id: vendorActualId } })}
                activeOpacity={actingAsVendor ? 1 : 0.75}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                {/* Avatar */}
                <View style={{ position: 'relative' }}>
                  {(!actingAsVendor && (vendorLogoUrl || vendorAvatarUrl)) ? (
                    <Image
                      source={{ uri: vendorLogoUrl ?? vendorAvatarUrl! }}
                      style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#1A1208' }}
                    />
                  ) : (actingAsVendor && buyerAvatar) ? (
                    <Image source={{ uri: buyerAvatar }} style={{ width: 42, height: 42, borderRadius: 21 }} />
                  ) : (
                    <View style={{
                      width: 42, height: 42, borderRadius: 21,
                      backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: '#E8521A' }}>
                        {vendorName.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {/* Online dot */}
                  <View style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 12, height: 12, borderRadius: 6,
                    backgroundColor: otherOnline ? '#4CAF50' : '#2A1F14',
                    borderWidth: 2, borderColor: '#0F0A06',
                  }} />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, color: '#FDF6EC' }} numberOfLines={1}>
                      {vendorName}
                    </Text>
                    {!actingAsVendor && isVerified && (
                      <Ionicons name="shield-checkmark" size={13} color="#2D8653" />
                    )}
                  </View>
                  <Text style={{
                    fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular',
                    color: otherOnline ? '#4CAF50' : '#4A3D30',
                  }}>
                    {otherOnline ? 'Online' : lastSeen ? `Last seen ${formatTime(lastSeen)}` : 'Offline'}
                  </Text>
                </View>
              </TouchableOpacity>

              {actingAsVendor && (
                <TouchableOpacity
                  onPress={() => setShowPaymentSheet(true)}
                  style={{
                    backgroundColor: 'rgba(232,82,26,0.1)',
                    borderWidth: 1, borderColor: 'rgba(232,82,26,0.2)',
                    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                  }}
                >
                  <Ionicons name="cash-outline" size={15} color="#E8521A" />
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#E8521A' }}>Request</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* ── Messages ── */}
        {messages.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 20,
              backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="chatbubble-ellipses-outline" size={28} color="#2A1F14" />
            </View>
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 16, color: '#FDF6EC', textAlign: 'center' }}>
              Start the conversation
            </Text>
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#4A3D30', textAlign: 'center' }}>
              {actingAsVendor ? 'A buyer reached out to you' : `Say hi to ${vendorName}`}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={m => m.id}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 4 }}
            // Not inverted — normal top-to-bottom order
            onScroll={(e) => {
              const maxOffset = e.nativeEvent.contentSize.height - e.nativeEvent.layoutMeasurement.height;
              setShowScrollButton(maxOffset - e.nativeEvent.contentOffset.y > 200);
            }}
            scrollEventThrottle={100}
            onEndReached={loadOlderMessages}
            onEndReachedThreshold={0.1}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            ListHeaderComponent={loadingMore ? (
              <ActivityIndicator size="small" color="#E8521A" style={{ marginVertical: 8 }} />
            ) : null}
            renderItem={({ item, index }) => {
              const prevItem = messages[index - 1];
              const nextItem = messages[index + 1];
              const showDate = !prevItem || getDateLabel(item.created_at) !== getDateLabel(prevItem.created_at);
              const isFirstInGroup = !prevItem || prevItem.sender_id !== item.sender_id || showDate;
              const isLastInGroup = !nextItem || nextItem.sender_id !== item.sender_id ||
                getDateLabel(item.created_at) !== getDateLabel(nextItem.created_at);
              const isMine = item.sender_id === user?.id;

              return (
                <View>
                  {showDate && <DateSeparator label={getDateLabel(item.created_at)} />}
                  {/* Extra space between groups */}
                  {isFirstInGroup && !showDate && index > 0 && (
                    <View style={{ height: 6 }} />
                  )}
                  {item.type === 'payment_request' ? (
                    <PaymentRequestBubble
                      msg={item} isMine={isMine}
                      paymentRequest={item.payment_request ?? null}
                      onPay={handlePayNow}
                      onCancel={handleCancelRequest}
                      paying={paying}
                    />
                  ) : (
                    <MessageBubble
                      msg={item}
                      isMine={isMine}
                      isFirstInGroup={isFirstInGroup}
                      isLastInGroup={isLastInGroup}
                      myId={user?.id ?? ''}
                      onLongPress={handleLongPress}
                      onImagePress={setViewingImage}
                      onSwipeReply={(m) => { setReplyingTo(m); setTimeout(() => inputRef.current?.focus(), 100); }}
                      onReactionPress={handleReactionPress}
                      isSelected={selectedIds.has(item.id)}
                      selectionMode={selectionMode}
                      onSelect={handleSelect}
                    />
                  )}
                </View>
              );
            }}
          />
        )}

        {/* Typing indicator */}
        {otherUserTyping && <TypingBubble />}

        {/* Scroll to bottom */}
        {showScrollButton && (
          <TouchableOpacity
            onPress={() => flatListRef.current?.scrollToEnd({ animated: true })}
            style={{
              position: 'absolute', bottom: 90, right: 16,
              backgroundColor: '#1E1610', width: 38, height: 38,
              borderRadius: 19, alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: '#2A1F14',
              shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
            }}
          >
            <Ionicons name="chevron-down" size={18} color="#FDF6EC" />
          </TouchableOpacity>
        )}

        {/* ── Edit banner ── */}
        {editingMsg && (
          <Animated.View
            entering={FadeInDown.duration(180)}
            style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 16, paddingVertical: 8,
              backgroundColor: '#141009',
              borderTopWidth: 1, borderColor: '#1E1610', gap: 10,
            }}
          >
            <Ionicons name="create-outline" size={15} color="#E8521A" />
            <Text style={{ flex: 1, fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#6B5E50' }} numberOfLines={1}>
              Editing: {editingMsg.content}
            </Text>
            <TouchableOpacity onPress={() => { setEditingMsg(null); setText(''); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={18} color="#4A3D30" />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Reply Strip ── */}
        {replyingTo && !editingMsg && (
          <ReplyStrip
            replyTo={replyingTo}
            myId={user?.id ?? ''}
            onCancel={() => setReplyingTo(null)}
          />
        )}

        {/* ── Input Bar ── */}
        <View style={{
          flexDirection: 'row', alignItems: 'flex-end',
          paddingHorizontal: 10, paddingVertical: 10,
          paddingBottom: Platform.OS === 'ios' ? 10 : 10,
          backgroundColor: '#0F0A06',
          borderTopWidth: 1, borderTopColor: '#1A1208',
          gap: 8,
        }}>
          <TouchableOpacity
            onPress={() => setShowAttachSheet(true)}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
              alignItems: 'center', justifyContent: 'center', marginBottom: 1,
            }}
          >
            {uploadingImage
              ? <ActivityIndicator size="small" color="#E8521A" />
              : <Ionicons name="add" size={22} color="#6B5E50" />
            }
          </TouchableOpacity>

          <View style={{
            flex: 1, backgroundColor: '#1A1208',
            borderWidth: 1, borderColor: '#2A1F14',
            borderRadius: 22, paddingHorizontal: 14,
            paddingTop: 10, paddingBottom: 10, minHeight: 40,
            justifyContent: 'center',
          }}>
            <TextInput
              ref={inputRef}
              style={{
                fontFamily: 'SpaceGrotesk_400Regular', fontSize: 15,
                color: '#EDE3D5', maxHeight: 120, lineHeight: 20,
              }}
              placeholder={editingMsg ? 'Edit message...' : 'Message...'}
              placeholderTextColor="#3D3026"
              value={text}
              onChangeText={setText}
              multiline
            />
          </View>

          <TouchableOpacity
            onPress={sendMessage}
            disabled={!text.trim() || sending}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: text.trim() ? '#E8521A' : '#1A1208',
              borderWidth: text.trim() ? 0 : 1, borderColor: '#2A1F14',
              alignItems: 'center', justifyContent: 'center', marginBottom: 1,
            }}
          >
            {sending
              ? <ActivityIndicator size="small" color="white" />
              : <Ionicons
                  name={editingMsg ? 'checkmark' : 'send'}
                  size={17}
                  color={text.trim() ? 'white' : '#3D3026'}
                />
            }
          </TouchableOpacity>
        </View>

        {/* ── Floating Context Menu ── */}
        <FloatingContextMenu
          visible={contextMenu.visible}
          pageY={contextMenu.pageY}
          msg={contextMenu.msg}
          isMine={contextMenu.isMine}
          myId={user?.id ?? ''}
          onReply={() => { startReply(); }}
          onReact={openReactionFromMenu}
          onEdit={startEdit}
          onDelete={deleteMessage}
          onSelect={startSelect}
          onCopy={handleCopy}
          onDismiss={dismissContextMenu}
        />

        {/* ── Reaction Picker ── */}
        <FloatingReactionPicker
          visible={reactionPicker.visible}
          onSelect={handleReactionSelect}
          onDismiss={() => setReactionPicker({ visible: false, messageId: null })}
        />

        {/* ── Fullscreen Image Viewer ── */}
        <Modal visible={!!viewingImage} transparent animationType="fade" statusBarTranslucent>
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            <TouchableOpacity
              onPress={() => setViewingImage(null)}
              style={{
                position: 'absolute', top: 52, right: 16, zIndex: 20,
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: 'rgba(255,255,255,0.12)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={20} color="white" />
            </TouchableOpacity>
            <GestureDetector gesture={pinchGesture}>
              <Animated.View
                style={[{ flex: 1, justifyContent: 'center', alignItems: 'center' }, animatedImageStyle]}
              >
                {viewingImage && (
                  <Image
                    source={{ uri: viewingImage }}
                    style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 }}
                    resizeMode="contain"
                  />
                )}
              </Animated.View>
            </GestureDetector>
          </View>
        </Modal>

        {/* ── Attach Sheet ── */}
        <Modal visible={showAttachSheet} transparent animationType="slide">
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} activeOpacity={1} onPress={() => setShowAttachSheet(false)} />
          <View style={{
            backgroundColor: '#141009',
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            borderTopWidth: 1, borderColor: '#1E1610',
            paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40,
          }}>
            <View style={{ width: 36, height: 4, backgroundColor: '#2A1F14', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {[
                { icon: 'camera', label: 'Camera', sub: 'Take a photo', action: takePhoto },
                { icon: 'images', label: 'Gallery', sub: 'Pick from photos', action: pickFromGallery },
              ].map(item => (
                <TouchableOpacity
                  key={item.label} onPress={item.action} activeOpacity={0.8}
                  style={{
                    flex: 1, alignItems: 'center',
                    backgroundColor: '#1A1208',
                    borderWidth: 1, borderColor: '#2A1F14',
                    borderRadius: 18, paddingVertical: 20, gap: 8,
                  }}
                >
                  <View style={{
                    width: 50, height: 50, borderRadius: 14,
                    backgroundColor: 'rgba(232,82,26,0.1)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name={item.icon as any} size={24} color="#E8521A" />
                  </View>
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }}>{item.label}</Text>
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#4A3D30' }}>{item.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* ── Product Enquiry ── */}
        <Modal visible={showProductEnquiry} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
            <Animated.View
              entering={FadeInDown.duration(280).springify()}
              style={{
                backgroundColor: '#141009',
                borderTopLeftRadius: 26, borderTopRightRadius: 26,
                borderTopWidth: 1, borderColor: '#1E1610',
                paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40,
              }}
            >
              <View style={{ width: 36, height: 4, backgroundColor: '#2A1F14', borderRadius: 2, alignSelf: 'center', marginBottom: 24 }} />
              <View style={{
                backgroundColor: '#0F0A06', borderRadius: 16,
                borderWidth: 1, borderColor: '#1E1610',
                padding: 14, marginBottom: 20,
                flexDirection: 'row', alignItems: 'center', gap: 12,
              }}>
                <View style={{
                  width: 48, height: 48, borderRadius: 12,
                  backgroundColor: 'rgba(232,82,26,0.1)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="cube-outline" size={22} color="#E8521A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: '#FDF6EC' }} numberOfLines={1}>{productName}</Text>
                  {productPrice && <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#E8521A', marginTop: 2 }}>{productPrice}</Text>}
                </View>
              </View>
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC', marginBottom: 6 }}>
                Send enquiry?
              </Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#4A3D30', lineHeight: 20, marginBottom: 16 }}>
                This message will be sent to the vendor
              </Text>
              <View style={{ backgroundColor: '#0F0A06', borderRadius: 14, borderWidth: 1, borderColor: '#1E1610', padding: 14, marginBottom: 20 }}>
                <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#EDE3D5', lineHeight: 22 }}>
                  Hi! I'm interested in <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', color: '#E8521A' }}>{productName}</Text>
                  {productPrice ? ` (${productPrice})` : ''}. Is it still available?
                </Text>
              </View>
              <TouchableOpacity onPress={sendEnquiry} style={{
                backgroundColor: '#E8521A', borderRadius: 14, height: 52,
                alignItems: 'center', justifyContent: 'center',
                flexDirection: 'row', gap: 8, marginBottom: 10,
              }}>
                <Ionicons name="send" size={16} color="white" />
                <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: 'white' }}>Send Enquiry</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowProductEnquiry(false)} style={{
                backgroundColor: '#1A1208', borderRadius: 14, height: 48,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: '#2A1F14',
              }}>
                <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 14, color: '#4A3D30' }}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>

        {/* ── Pay Order Type ── */}
        <Modal visible={showPayOrderSheet} transparent animationType="slide">
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} activeOpacity={1} onPress={() => setShowPayOrderSheet(false)} />
          <View style={{
            backgroundColor: '#141009',
            borderTopLeftRadius: 26, borderTopRightRadius: 26,
            borderTopWidth: 1, borderColor: '#1E1610',
            paddingHorizontal: 20, paddingTop: 14, paddingBottom: 44,
          }}>
            <View style={{ width: 36, height: 4, backgroundColor: '#2A1F14', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC', marginBottom: 4 }}>How will you receive this?</Text>
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#4A3D30', marginBottom: 20 }}>
              Payment stays in escrow until delivery is confirmed.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              {(['pickup', 'delivery'] as const).map((t) => (
                <TouchableOpacity
                  key={t} onPress={() => setPayOrderType(t)}
                  style={{
                    flex: 1, padding: 14, borderRadius: 14, borderWidth: 1,
                    borderColor: payOrderType === t ? '#E8521A' : '#2A1F14',
                    backgroundColor: payOrderType === t ? 'rgba(232,82,26,0.1)' : '#0F0A06',
                  }}
                >
                  <Ionicons name={t === 'pickup' ? 'storefront-outline' : 'bicycle-outline'} size={20} color={payOrderType === t ? '#E8521A' : '#4A3D30'} />
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: payOrderType === t ? '#E8521A' : '#FDF6EC', marginTop: 6 }}>
                    {t === 'pickup' ? 'Pickup' : 'Delivery'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {payOrderType === 'delivery' && (
              <Animated.View entering={FadeInDown.duration(180)}>
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: '#4A3D30', marginBottom: 8, letterSpacing: 0.5 }}>DELIVERY ADDRESS</Text>
                <View style={{ backgroundColor: '#0F0A06', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 }}>
                  <RNTextInput
                    value={payDeliveryAddress} onChangeText={setPayDeliveryAddress}
                    placeholder="Street, area, city..."
                    placeholderTextColor="#3D3026" multiline
                    style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#FDF6EC', minHeight: 56 }}
                  />
                </View>
              </Animated.View>
            )}
            <TouchableOpacity
              onPress={confirmPayNow}
              disabled={paying === pendingPayPr?.id}
              style={{
                backgroundColor: '#E8521A', borderRadius: 14, height: 54,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {paying === pendingPayPr?.id
                ? <ActivityIndicator color="white" />
                : <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: 'white' }}>
                    Pay {pendingPayPr ? formatAmount(pendingPayPr.amount) : ''}
                  </Text>}
            </TouchableOpacity>
          </View>
        </Modal>

        {/* ── Payment Request Sheet ── */}
        <Modal visible={showPaymentSheet} transparent animationType="slide">
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} activeOpacity={1} onPress={() => setShowPaymentSheet(false)} />
          <View style={{
            backgroundColor: '#141009',
            borderTopLeftRadius: 26, borderTopRightRadius: 26,
            borderTopWidth: 1, borderColor: '#1E1610',
            paddingHorizontal: 20, paddingTop: 14, paddingBottom: 44,
          }}>
            <View style={{ width: 36, height: 4, backgroundColor: '#2A1F14', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(232,82,26,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="cash-outline" size={20} color="#E8521A" />
              </View>
              <View>
                <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 17, color: '#FDF6EC' }}>Request Payment</Text>
                <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#4A3D30' }}>Send a request to the buyer</Text>
              </View>
            </View>
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: '#4A3D30', marginBottom: 8, letterSpacing: 0.5 }}>AMOUNT</Text>
            <View style={{
              backgroundColor: '#0F0A06', borderWidth: 1, borderColor: '#2A1F14',
              borderRadius: 14, paddingHorizontal: 16, height: 60,
              flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14,
            }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: '#4A3D30' }}>₦</Text>
              <RNTextInput
                value={payAmount} onChangeText={setPayAmount}
                placeholder="0.00" placeholderTextColor="#2A1F14"
                keyboardType="numeric"
                style={{ flex: 1, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 26, color: '#FDF6EC' }}
              />
            </View>
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: '#4A3D30', marginBottom: 8, letterSpacing: 0.5 }}>DESCRIPTION (OPTIONAL)</Text>
            <View style={{ backgroundColor: '#0F0A06', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 24 }}>
              <RNTextInput
                value={payDescription} onChangeText={setPayDescription}
                placeholder="e.g. 2 units of Red Sneakers"
                placeholderTextColor="#3D3026" multiline
                style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#FDF6EC', maxHeight: 80 }}
              />
            </View>
            <TouchableOpacity
              onPress={sendPaymentRequest}
              disabled={sendingPaymentRequest || !payAmount}
              style={{
                backgroundColor: payAmount ? '#E8521A' : '#1A1208',
                borderWidth: payAmount ? 0 : 1, borderColor: '#2A1F14',
                borderRadius: 14, height: 54,
                alignItems: 'center', justifyContent: 'center',
                flexDirection: 'row', gap: 8,
              }}
            >
              {sendingPaymentRequest
                ? <ActivityIndicator size="small" color="white" />
                : <>
                    <Ionicons name="send-outline" size={16} color={payAmount ? 'white' : '#3D3026'} />
                    <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: payAmount ? 'white' : '#3D3026' }}>
                      Send Request{payAmount ? ` · ₦${parseFloat(payAmount || '0').toLocaleString()}` : ''}
                    </Text>
                  </>}
            </TouchableOpacity>
          </View>
        </Modal>

        {alertElement}
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}