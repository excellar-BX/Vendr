import { useState, useEffect, useRef } from 'react';
import {
  View, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator,
  Modal, Dimensions, TextInput as RNTextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/ui/StyledText';
import * as ImagePicker from 'expo-image-picker';
import { chatApi, searchApi, storageApi } from '../../lib/api';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuthStore } from '../../stores/authStore';
import { useVendrAlert } from '../../components/ui/VendrAlert';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { connectSocket, disconnectSocket, joinConversation, leaveConversation } from '../../lib/socket';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

// ── Payment Request Bubble ─────────────────────────────────────────────────
function PaymentRequestBubble({
  msg, isMine, paymentRequest, onPay, onCancel, paying,
}: {
  msg: Message;
  isMine: boolean;
  paymentRequest: PaymentRequest | null;
  onPay: (pr: PaymentRequest) => void;
  onCancel: (pr: PaymentRequest) => void;
  paying: string | null;
}) {
  if (!paymentRequest) return null;

  const isPaid = paymentRequest.status === 'paid';
  const isCancelled = paymentRequest.status === 'cancelled';
  const isPending = paymentRequest.status === 'pending';

  const statusColor = isPaid ? '#2D8653' : isCancelled ? '#6B5E50' : '#F5A623';
  const statusLabel = isPaid ? 'Paid' : isCancelled ? 'Cancelled' : 'Pending';
  const statusIcon = isPaid ? 'checkmark-circle' : isCancelled ? 'close-circle' : 'time-outline';

  return (
    <View style={{ marginBottom: 8, alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: SCREEN_WIDTH * 0.82 }}>
      <View style={{
        backgroundColor: '#1A1208',
        borderWidth: 1,
        borderColor: isPaid ? 'rgba(45,134,83,0.4)' : isCancelled ? '#2A1F14' : 'rgba(245,166,35,0.35)',
        borderRadius: 20,
        borderTopRightRadius: isMine ? 4 : 20,
        borderTopLeftRadius: isMine ? 20 : 4,
        overflow: 'hidden',
        minWidth: 240,
      }}>
        {/* Top stripe */}
        <View style={{ height: 3, backgroundColor: isPaid ? '#2D8653' : isCancelled ? '#3D3026' : '#F5A623' }} />

        <View style={{ padding: 16 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isPaid ? 'rgba(45,134,83,0.15)' : isCancelled ? 'rgba(60,48,36,0.5)' : 'rgba(245,166,35,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="cash-outline" size={16} color={statusColor} />
              </View>
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: '#FDF6EC' }}>
                Payment Request
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${statusColor}18`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
              <Ionicons name={statusIcon as any} size={11} color={statusColor} />
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 10, color: statusColor, textTransform: 'uppercase' }}>
                {statusLabel}
              </Text>
            </View>
          </View>

          {/* Amount */}
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 26, color: '#FDF6EC', marginBottom: 4 }}>
            {formatAmount(paymentRequest.amount)}
          </Text>

          {/* Description */}
          {paymentRequest.description ? (
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570', marginBottom: 14, lineHeight: 18 }}>
              {paymentRequest.description}
            </Text>
          ) : <View style={{ marginBottom: 14 }} />}

          {/* Action buttons */}
          {isPending && !isMine && (
            // Buyer sees Pay Now
            <TouchableOpacity
              onPress={() => onPay(paymentRequest)}
              disabled={paying === paymentRequest.id}
              style={{
                backgroundColor: '#E8521A', borderRadius: 12, height: 44,
                alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
              }}
            >
              {paying === paymentRequest.id
                ? <ActivityIndicator size="small" color="white" />
                : <>
                    <Ionicons name="wallet-outline" size={16} color="white" />
                    <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: 'white' }}>Pay Now</Text>
                  </>
              }
            </TouchableOpacity>
          )}

          {isPending && isMine && (
            // Vendor sees Cancel
            <TouchableOpacity
              onPress={() => onCancel(paymentRequest)}
              style={{
                backgroundColor: '#2A1F14', borderRadius: 12, height: 40,
                alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3D3026',
              }}
            >
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#9A8570' }}>Cancel Request</Text>
            </TouchableOpacity>
          )}

          {isPaid && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="checkmark-circle" size={14} color="#2D8653" />
              <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12, color: '#2D8653' }}>
                Paid {paymentRequest.paid_at ? formatTime(paymentRequest.paid_at) : ''}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Timestamp */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingHorizontal: 4, alignSelf: isMine ? 'flex-end' : 'flex-start' }}>
        <Text style={{ fontSize: 10, fontFamily: 'SpaceGrotesk_400Regular', color: '#6B5E50' }}>
          {formatTime(msg.created_at)}
        </Text>
      </View>
    </View>
  );
}

// ── Text/Image Message Bubble ──────────────────────────────────────────────
function MessageBubble({
  msg, isMine, onLongPress, onImagePress,
}: {
  msg: Message;
  isMine: boolean;
  onLongPress: (msg: Message) => void;
  onImagePress: (url: string) => void;
}) {
  return (
    <TouchableOpacity
      onLongPress={() => isMine && onLongPress(msg)}
      activeOpacity={0.85}
      delayLongPress={350}
    >
      <View className={`mb-2 max-w-xs ${isMine ? 'self-end items-end' : 'self-start items-start'}`}>
        {msg.type === 'image' && msg.image_url ? (
          <TouchableOpacity
            onPress={() => onImagePress(msg.image_url!)}
            onLongPress={() => isMine && onLongPress(msg)}
            activeOpacity={0.9}
            delayLongPress={350}
          >
            <Image
              source={{ uri: msg.image_url }}
              style={{ width: 220, height: 220, borderRadius: 16 }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ) : (
          <View className={`px-4 py-3 rounded-2xl ${isMine ? 'bg-orange rounded-tr-sm' : 'bg-dark-2 border border-faint rounded-tl-sm'}`}>
            <Text
              className={isMine ? 'text-white text-sm' : 'text-cream text-sm'}
              style={{ fontFamily: 'SpaceGrotesk_400Regular' }}
            >
              {msg.content}
            </Text>
            {!msg.id.startsWith('temp-') && (msg as any).edited && (
              <Text style={{ fontSize: 9, fontFamily: 'SpaceGrotesk_400Regular', color: isMine ? 'rgba(255,255,255,0.6)' : '#6B5E50', marginTop: 2 }}>
                edited
              </Text>
            )}
          </View>
        )}
        <View className="flex-row items-center gap-1 mt-1 px-1">
          <Text className="text-muted" style={{ fontSize: 10, fontFamily: 'SpaceGrotesk_400Regular' }}>
            {formatTime(msg.created_at)}
          </Text>
          {isMine && msg.id.startsWith('temp-') && (
            <Ionicons name="time-outline" size={11} color="#6B5E50" />
          )}
          {isMine && !msg.id.startsWith('temp-') && (
            <Ionicons
              name={msg.is_read ? 'checkmark-done' : msg.delivered ? 'checkmark-done' : 'checkmark'}
              size={12}
              color={msg.is_read ? '#E8521A' : msg.delivered ? '#9A8570' : '#6B5E50'}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { vendorId, conversationId, productId, productName, productPrice } = useLocalSearchParams<{
    vendorId?: string;
    conversationId?: string;
    productId?: string;
    productName?: string;
    productPrice?: string;
  }>();

  const { user } = useAuthStore();
  const { showAlert: vendrAlert, alertElement } = useVendrAlert();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<Record<string, PaymentRequest>>({});
  const [convId, setConvId] = useState<string | null>(null);
  const [buyerId, setBuyerId] = useState<string>('');
  const [vendorDbId, setVendorDbId] = useState<string>('');
  const [vendorUserId, setVendorUserId] = useState<string>(''); // vendors.user_id for wallet ops
  const [vendorName, setVendorName] = useState('');
  const [vendorActualId, setVendorActualId] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [actingAsVendor, setActingAsVendor] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null); // payment_request id being paid

  // Modals
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [showAttachSheet, setShowAttachSheet] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [showProductEnquiry, setShowProductEnquiry] = useState(false);
  // Payment request sheet
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDescription, setPayDescription] = useState('');
  const [sendingPaymentRequest, setSendingPaymentRequest] = useState(false);

  // Pinch-to-zoom state for image viewer
  const scale = useSharedValue(1);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = event.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
      }
    });

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Reset scale when image viewer opens/closes
  useEffect(() => {
    if (viewingImage) {
      scale.value = 1;
    }
  }, [viewingImage]);

  useEffect(() => {
    if (!user?.id) return;
    initChat();
  }, []);

  const initChat = async () => {
    const userId = user!.id;
    setError(null);

    try {
      // Determine conversation ID
      let cid: string | null = null;
      const isValidUUID = (s?: string) => !!s && s !== '[conversationId]' && s.includes('-');
      if (isValidUUID(conversationId)) {
        cid = conversationId!;
      } else if (vendorId) {
        // Create or get conversation via API
        const { data, error } = await chatApi.createConversation(vendorId);
        if (error) throw new Error('Could not start conversation: ' + (error as any).message);
        cid = data.id;
      }

      if (!cid) throw new Error('No conversation ID');
      setConvId(cid);

      // Get conversation details
      const { data: convData } = await chatApi.getConversation(cid);
      const { conversation, vendor, buyer, actingAsVendor } = convData;

      setBuyerId(conversation.buyer_id);
      setActingAsVendor(actingAsVendor);
      setVendorDbId(conversation.vendor_id);
      setVendorUserId(vendor?.user_id ?? '');

      if (!actingAsVendor && vendor?.user_id === userId) {
        throw new Error('You cannot chat with your own store.');
      }

      if (actingAsVendor) {
        setVendorName(buyer?.name ?? 'Unknown Buyer');
      } else {
        setVendorName(vendor?.business_name ?? 'Vendor');
        setVendorActualId(vendor?.id ?? '');
        setIsVerified(vendor?.is_verified ?? false);
      }

      // Load messages
      const { data: msgs } = await chatApi.getMessages(cid, { limit: 100 });
      setMessages(msgs ?? []);

      // Mark messages as delivered and reset unread count
      await chatApi.markDelivered(cid);
      const unreadField = actingAsVendor ? 'vendor_unread' : 'buyer_unread';
      await chatApi.resetUnread(cid, unreadField);

      // Mark messages as read (this will emit Socket.io event to sender)
      await chatApi.markAsRead(cid);

      // Set presence
      await chatApi.setPresence(true);

      // Connect to Socket.io and join conversation room
      const socket = await connectSocket();
      if (socket && cid) {
        joinConversation(cid);

        // Listen for messages_read event (when other party reads our messages)
        socket.on('messages_read', (data: { conversationId: string; messageIds: string[]; readBy: string }) => {
          if (data.conversationId === cid) {
            setMessages(prev => prev.map(msg =>
              data.messageIds.includes(msg.id) ? { ...msg, is_read: true } : msg
            ));
          }
        });

        // Listen for user_presence event (real-time online status)
        socket.on('user_presence', (data: { userId: string; isOnline: boolean }) => {
          const otherUserId = actingAsVendor ? conversation.buyer_id : vendor?.user_id;
          if (data.userId === otherUserId) {
            setOtherOnline(data.isOnline);
          }
        });

        // Listen for new_message event (real-time message delivery)
        socket.on('new_message', (newMsg: Message) => {
          if (newMsg.conversation_id === cid) {
            setMessages(prev => {
              // Check if message already exists (avoid duplicates)
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
          }
        });
      }

      // Get other user's presence (initial fetch)
      const otherUserId = actingAsVendor ? conversation.buyer_id : vendor?.user_id;
      if (otherUserId) {
        try {
          const { data: presenceData } = await chatApi.getPresence([otherUserId]);
          setOtherOnline(presenceData[otherUserId] ?? false);
        } catch (e) {
          setOtherOnline(false);
        }
      }

      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 150);

      setLoading(false);

      if (productName) {
        setTimeout(() => setShowProductEnquiry(true), 400);
      }

    } catch (e: any) {
      console.error('Chat init error:', e);
      setError(e.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      // Leave conversation room and disconnect socket
      if (convId) {
        leaveConversation(convId);
      }
      disconnectSocket();

      // Set user as offline when leaving chat
      if (user?.id) {
        chatApi.setPresence(false).catch(console.error);
      }
    };
  }, [convId]);

  // ─── Image Upload ──────────────────────────────────────────────────────────
  const pickFromGallery = async () => {
    setShowAttachSheet(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { vendrAlert({ title: 'Permission Needed', message: 'Allow photo access to share images.', type: 'warning' }); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    await uploadAndSendImage(result.assets[0].uri);
  };

  const takePhoto = async () => {
    setShowAttachSheet(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { vendrAlert({ title: 'Permission Needed', message: 'Allow camera access to take photos.', type: 'warning' }); return; }
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
        content: 'Sending image...', image_url: null, type: 'text',
        is_read: false, delivered: false, edited: false, created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, tempMsg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

      // Generate a unique filename
      const fileName = `chat/${convId}/${Date.now()}.jpg`;

      // Get signed upload URL from backend
      const { data: signData } = await storageApi.signUpload(fileName, 'image/jpeg');
      const { uploadUrl, publicUrl } = signData;

      // Upload the image to R2 using the signed URL
      // Read file as base64 (same pattern as reel-upload)
      console.log('[Chat] Reading file as base64...');
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64' as any,
      });
      console.log('[Chat] File read, base64 length:', base64.length);

      // Convert base64 → Uint8Array
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      console.log('[Chat] Converted to Uint8Array, bytes:', bytes.length);

      console.log('[Chat] Uploading to R2:', uploadUrl.substring(0, 100) + '...');
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: bytes,
        headers: {
          'Content-Type': 'image/jpeg',
        },
      });

      console.log('[Chat] Upload response status:', uploadResponse.status);
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('[Chat] Upload failed response:', errorText);
        throw new Error(`Upload failed (${uploadResponse.status}): ${errorText}`);
      }

      // Send image message via API
      const { data: inserted } = await chatApi.sendMessage({
        conversation_id: convId,
        content: ' ',
        type: 'image',
        image_url: publicUrl,
      });

      // Replace temp message with real one
      setMessages(prev => prev.map(m => m.id === tempId ? { ...inserted, delivered: false, is_read: false } : m));

    } catch (e: any) {
      console.error('Upload error:', e);
      console.error('Error details:', {
        message: e.message,
        name: e.name,
        stack: e.stack,
        response: e.response
      });
      vendrAlert({
        title: 'Upload Failed',
        message: e.message || e.toString() || 'Something went wrong',
        type: 'danger'
      });
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setUploadingImage(false);
    }
  };

  // ─── Message Actions ───────────────────────────────────────────────────────
  const handleLongPress = (msg: Message) => { setSelectedMsg(msg); setShowActions(true); };
  const cancelEdit = () => { setEditingMsg(null); setText(''); };

  const startEdit = () => {
    if (!selectedMsg) return;
    setEditingMsg(selectedMsg);
    setText(selectedMsg.content ?? '');
    setShowActions(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const editMessage = async () => {
    const newContent = text.trim();
    if (!newContent || !editingMsg || !convId) return;
    setSending(true);
    setText('');
    // Optimistic update
    setMessages(prev => prev.map(m => m.id === editingMsg.id ? { ...m, content: newContent, edited: true } : m));
    setEditingMsg(null);

    try {
      const { data: updated } = await chatApi.updateMessage(editingMsg.id, newContent);

      // If edited message is the last message, update conversation (API already does that)
      setMessages(prev => prev.map(m => m.id === editingMsg.id ? updated : m));
    } catch (error: any) {
      vendrAlert({ title: 'Error', message: 'Could not edit message: ' + (error.message || 'Unknown error'), type: 'danger' });
      // Revert optimistic update
      setMessages(prev => prev.map(m => m.id === editingMsg.id ? editingMsg : m));
      setSending(false);
      return;
    }

    setSending(false);
  };

  const deleteMessage = async () => {
    if (!selectedMsg || !convId) return;
    setShowActions(false);
    vendrAlert({
      title: 'Delete Message?',
      message: 'This cannot be undone.',
      type: 'danger',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          // Optimistic delete
          const deletedMsg = selectedMsg;
          setMessages(prev => prev.filter(m => m.id !== deletedMsg.id));

          try {
            await chatApi.deleteMessage(deletedMsg.id);

            // The backend will update conversation last_message automatically
          } catch (error: any) {
            vendrAlert({ title: 'Error', message: 'Could not delete message: ' + (error.message || 'Unknown error'), type: 'danger' });
            // Restore the message on error
            setMessages(prev => [...prev, deletedMsg].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            ));
          }
        }},
      ],
    });
  };

  const sendEnquiry = async () => {
    if (!convId || !user?.id || !productName) return;
    setShowProductEnquiry(false);
    const msg = `Hi! I'm interested in your product: *${productName}*${productPrice ? ` (${productPrice})` : ''}. Is it still available?`;
    setText(msg);
    setSending(true);

    try {
      const { data: inserted } = await chatApi.sendMessage({
        conversation_id: convId,
        content: msg,
        type: 'text',
      });

      setMessages(prev => [...prev, { ...inserted, delivered: false, is_read: false }]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error: any) {
      vendrAlert({ title: 'Error', message: 'Could not send message: ' + error.message, type: 'danger' });
      setText(msg); // restore message on error
      setSending(false);
      return;
    }

    setText('');
    setSending(false);
  };

  // ─── Payment Request ───────────────────────────────────────────────────────
  const sendPaymentRequest = async () => {
    if (!convId || !user?.id) return;
    const amount = parseFloat(payAmount.replace(/[^0-9.]/g, ''));
    if (!amount || amount <= 0) {
      vendrAlert({ title: 'Invalid Amount', message: 'Please enter a valid amount to request.', type: 'warning' });
      return;
    }

    setSendingPaymentRequest(true);
    try {
      // Create payment request via chat API
      // This creates both the payment_request record and the message
      const { data: msg } = await chatApi.createPaymentRequest(convId, amount, payDescription.trim());

      // Add message to list
      setMessages(prev => [...prev, msg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

      // Clear form
      setShowPaymentSheet(false);
      setPayAmount('');
      setPayDescription('');
    } catch (e: any) {
      vendrAlert({ title: 'Error', message: e.message || 'Failed to send payment request', type: 'danger' });
    } finally {
      setSendingPaymentRequest(false);
    }
  };

  const handlePayNow = async (pr: PaymentRequest) => {
    if (!user?.id || !convId) return;
    setPaying(pr.id);
    try {
      // Process payment via chat API (this updates payment_request status to paid)
      const { data: payResult } = await chatApi.payPaymentRequest(pr.id);
      if (!payResult?.success) {
        throw new Error('Payment failed');
      }

      // Update the payment request in both state stores optimistically
      const updatedPr = { ...pr, status: 'paid' as const, paid_at: new Date().toISOString() };
      setPaymentRequests(prev => ({
        ...prev,
        [pr.id]: updatedPr
      }));
      // Also update the corresponding message in the messages array
      setMessages(prev => prev.map(msg =>
        msg.type === 'payment_request' && msg.content === pr.id
          ? { ...msg, payment_request: updatedPr }
          : msg
      ));

      // Send confirmation message
      await chatApi.sendMessage({
        conversation_id: convId,
        content: `Payment of ${formatAmount(pr.amount)} sent successfully.`,
        type: 'text',
      });

      vendrAlert({
        title: 'Payment Successful',
        message: `You paid ${formatAmount(pr.amount)}`,
        type: 'success',
      });

    } catch (e: any) {
      vendrAlert({ title: 'Payment Failed', message: e.message || 'Payment processing failed', type: 'danger' });
    } finally {
      setPaying(null);
    }
  };

  const handleCancelRequest = (pr: PaymentRequest) => {
    vendrAlert({
      title: 'Cancel Request?',
      message: 'The buyer will no longer be able to pay this request.',
      type: 'question',
      buttons: [
        { text: 'Keep', style: 'cancel' },
        { text: 'Cancel Request', style: 'destructive', onPress: async () => {
          try {
            await chatApi.cancelPaymentRequest(pr.id);
            // Update the payment request in both state stores optimistically
            setPaymentRequests(prev => ({ ...prev, [pr.id]: { ...pr, status: 'cancelled' as const } }));
            // Also update the corresponding message in the messages array
            setMessages(prev => prev.map(msg =>
              msg.type === 'payment_request' && msg.content === pr.id
                ? { ...msg, payment_request: { ...msg.payment_request!, status: 'cancelled' as const } }
                : msg
            ));
          } catch (error: any) {
            vendrAlert({
              title: 'Error',
              message: 'Could not cancel payment request: ' + (error.message || 'Unknown error'),
              type: 'danger'
            });
          }
        }},
      ],
    });
  };

  const sendMessage = async () => {
    if (editingMsg) { editMessage(); return; }
    const content = text.trim();
    if (!content || !convId || !user?.id || sending) return;
    setText('');
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const tempMsg: Message = {
      id: tempId, conversation_id: convId, sender_id: user!.id,
      content, image_url: null, type: 'text',
      is_read: false, delivered: false, edited: false, created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const { data: inserted } = await chatApi.sendMessage({
        conversation_id: convId,
        content,
        type: 'text',
      });

      // Replace temp message with real one
      setMessages(prev => prev.map(m => m.id === tempId ? { ...inserted, delivered: false, is_read: false } : m));
    } catch (error: any) {
      vendrAlert({ title: 'Send Failed', message: error.message || 'Could not send message', type: 'danger' });
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setText(content);
      setSending(false);
      return;
    }

    setSending(false);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View className="flex-1 bg-dark items-center justify-center gap-3">
        <ActivityIndicator size="large" color="#E8521A" />
        <Text className="text-muted text-sm">Opening chat...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-dark items-center justify-center gap-4 px-8">
        <Ionicons name="warning-outline" size={40} color="#E85555" />
        <Text className="text-cream text-base text-center" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Something went wrong</Text>
        <Text className="text-muted text-sm text-center">{error}</Text>
        <TouchableOpacity onPress={() => { setLoading(true); setError(null); initChat(); }} className="bg-orange rounded-2xl px-6 py-3">
          <Text className="text-white text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-muted text-sm">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView className="flex-1 bg-dark" behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <StatusBar style="light" />

      {/* Header */}
      <View className="flex-row items-center px-4 pt-14 pb-3 border-b border-faint bg-dark gap-3">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => !actingAsVendor && vendorActualId && router.push({ pathname: '/vendor/[id]', params: { id: vendorActualId } })}
          activeOpacity={actingAsVendor ? 1 : 0.7}
          className="flex-row items-center gap-3 flex-1"
        >
          <View className="relative">
            <View className="w-10 h-10 rounded-full bg-dark-2 border border-faint items-center justify-center">
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: '#E8521A' }}>
                {vendorName.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-dark ${otherOnline ? 'bg-green-500' : 'bg-dark-3'}`} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>{vendorName}</Text>
              {!actingAsVendor && isVerified && <Ionicons name="shield-checkmark" size={13} color="#2D8653" />}
              {!actingAsVendor && vendorActualId && <Ionicons name="chevron-forward" size={12} color="#6B5E50" />}
            </View>
            <Text style={{ fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: otherOnline ? '#4CAF50' : '#6B5E50' }}>
              {otherOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Vendor-only: request payment button in header */}
        {actingAsVendor && (
          <TouchableOpacity
            onPress={() => setShowPaymentSheet(true)}
            style={{ backgroundColor: 'rgba(232,82,26,0.12)', borderWidth: 1, borderColor: 'rgba(232,82,26,0.25)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 5 }}
          >
            <Ionicons name="cash-outline" size={15} color="#E8521A" />
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 12, color: '#E8521A' }}>Request</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      {messages.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <View className="w-16 h-16 rounded-2xl bg-dark-2 border border-faint items-center justify-center">
            <Ionicons name="chatbubbles-outline" size={28} color="#3D3026" />
          </View>
          <Text className="text-cream text-base text-center" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Start the conversation</Text>
          <Text className="text-muted text-sm text-center">
            {actingAsVendor ? 'A buyer wants to chat with you' : `Say hi to ${vendorName}`}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            if (item.type === 'payment_request') {
              return (
                <PaymentRequestBubble
                  msg={item}
                  isMine={item.sender_id === user?.id}
                  paymentRequest={item.payment_request ?? null}
                  onPay={handlePayNow}
                  onCancel={handleCancelRequest}
                  paying={paying}
                />
              );
            }
            return (
              <MessageBubble
                msg={item}
                isMine={item.sender_id === user?.id}
                onLongPress={handleLongPress}
                onImagePress={setViewingImage}
              />
            );
          }}
        />
      )}

      {/* Edit banner */}
      {editingMsg && (
        <View className="flex-row items-center px-4 py-2 bg-dark-2 border-t border-faint gap-3">
          <Ionicons name="create-outline" size={16} color="#E8521A" />
          <Text className="flex-1 text-orange text-xs" style={{ fontFamily: 'SpaceGrotesk_500Medium' }} numberOfLines={1}>
            Editing: {editingMsg.content}
          </Text>
          <TouchableOpacity onPress={cancelEdit}>
            <Ionicons name="close-circle" size={18} color="#6B5E50" />
          </TouchableOpacity>
        </View>
      )}

      {/* Input bar */}
      <View className="flex-row items-end px-4 py-3 border-t border-faint bg-dark gap-2">
        <TouchableOpacity
          onPress={() => setShowAttachSheet(true)}
          className="w-10 h-10 rounded-xl bg-dark-2 border border-faint items-center justify-center mb-0.5"
        >
          {uploadingImage
            ? <ActivityIndicator size="small" color="#E8521A" />
            : <Ionicons name="attach" size={20} color="#9A8570" />
          }
        </TouchableOpacity>

        <View className="flex-1 bg-dark-2 border border-faint rounded-2xl px-4 py-2.5 min-h-10 justify-center">
          <TextInput
            ref={inputRef}
            className="text-cream text-sm"
            style={{ fontFamily: 'SpaceGrotesk_400Regular', maxHeight: 100 }}
            placeholder={editingMsg ? 'Edit message...' : 'Type a message...'}
            placeholderTextColor="#6B5E50"
            value={text}
            onChangeText={setText}
            multiline
          />
        </View>

        <TouchableOpacity
          onPress={sendMessage}
          disabled={!text.trim() || sending}
          className={`w-10 h-10 rounded-xl items-center justify-center mb-0.5 ${text.trim() ? 'bg-orange' : 'bg-dark-2 border border-faint'}`}
          style={text.trim() ? { shadowColor: '#E8521A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 } : {}}
        >
          {sending
            ? <ActivityIndicator size="small" color="white" />
            : <Ionicons name={editingMsg ? 'checkmark' : 'send'} size={16} color={text.trim() ? 'white' : '#6B5E50'} />
          }
        </TouchableOpacity>
      </View>

      {/* ── Fullscreen Image Viewer ── */}
      <Modal visible={!!viewingImage} transparent animationType="fade" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <TouchableOpacity
            onPress={() => setViewingImage(null)}
            style={{ position: 'absolute', top: 52, right: 20, zIndex: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 8 }}
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
            activeOpacity={1}
            onPress={() => setViewingImage(null)}
          >
            {viewingImage && (
              <GestureDetector gesture={pinchGesture}>
                <Animated.Image
                  source={{ uri: viewingImage }}
                  style={[
                    { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.85 },
                    animatedImageStyle
                  ]}
                  resizeMode="contain"
                />
              </GestureDetector>
            )}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Message Actions Sheet ── */}
      <Modal visible={showActions} transparent animationType="slide">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
          activeOpacity={1}
          onPress={() => setShowActions(false)}
        />
        <View className="bg-dark-2 border-t border-faint rounded-t-3xl px-5 pt-4 pb-10">
          <View className="w-10 h-1 bg-faint rounded-full self-center mb-5" />
          <View className="bg-dark-3 rounded-2xl px-4 py-3 mb-5">
            <Text className="text-muted text-xs mb-1" style={{ fontFamily: 'SpaceGrotesk_500Medium' }}>MESSAGE</Text>
            <Text className="text-cream text-sm" numberOfLines={3} style={{ fontFamily: 'SpaceGrotesk_400Regular' }}>
              {selectedMsg?.type === 'image' ? 'Image' : selectedMsg?.content}
            </Text>
          </View>
          {selectedMsg?.type !== 'image' && (
            <TouchableOpacity onPress={startEdit} activeOpacity={0.8} className="flex-row items-center gap-4 px-2 py-4 border-b border-faint">
              <View className="w-10 h-10 rounded-xl bg-dark-3 items-center justify-center">
                <Ionicons name="create-outline" size={18} color="#E8521A" />
              </View>
              <View>
                <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Edit Message</Text>
                <Text className="text-muted text-xs">Change what you said</Text>
              </View>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={deleteMessage} activeOpacity={0.8} className="flex-row items-center gap-4 px-2 py-4">
            <View className="w-10 h-10 rounded-xl bg-dark-3 items-center justify-center">
              <Ionicons name="trash-outline" size={18} color="#E85555" />
            </View>
            <View>
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', color: '#E85555', fontSize: 14 }}>Delete Message</Text>
              <Text className="text-muted text-xs">Remove for everyone</Text>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Attachment Sheet ── */}
      <Modal visible={showAttachSheet} transparent animationType="slide">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} activeOpacity={1} onPress={() => setShowAttachSheet(false)} />
        <View className="bg-dark-2 border-t border-faint rounded-t-3xl px-5 pt-4 pb-10">
          <View className="w-10 h-1 bg-faint rounded-full self-center mb-5" />
          <Text className="text-cream text-base mb-5 text-center" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
            {actingAsVendor ? 'Share with Buyer' : 'Share with Vendor'}
          </Text>
          <View className="flex-row gap-4 justify-center mb-4">
            <TouchableOpacity onPress={takePhoto} activeOpacity={0.8} className="flex-1 items-center bg-dark-3 border border-faint rounded-2xl py-5 gap-2">
              <View className="w-12 h-12 rounded-xl bg-orange/20 items-center justify-center">
                <Ionicons name="camera" size={24} color="#E8521A" />
              </View>
              <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Camera</Text>
              <Text className="text-muted text-xs text-center px-2">Take a photo now</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={pickFromGallery} activeOpacity={0.8} className="flex-1 items-center bg-dark-3 border border-faint rounded-2xl py-5 gap-2">
              <View className="w-12 h-12 rounded-xl bg-orange/20 items-center justify-center">
                <Ionicons name="images" size={24} color="#E8521A" />
              </View>
              <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Gallery</Text>
              <Text className="text-muted text-xs text-center px-2">Pick from your photos</Text>
            </TouchableOpacity>
          </View>
          <View className="bg-dark-3 border border-faint rounded-2xl px-4 py-3 flex-row items-center gap-3">
            <Ionicons name="information-circle-outline" size={18} color="#F5A623" />
            <Text className="text-muted text-xs flex-1" style={{ fontFamily: 'SpaceGrotesk_400Regular' }}>
              Share photos to show exactly what you want — avoid the "what I ordered vs what I got" situation.
            </Text>
          </View>
        </View>
      </Modal>

      {/* ── Product Enquiry Modal ── */}
      <Modal visible={showProductEnquiry} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#1A1208', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: '#2A1F14', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36 }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#3D3026', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <View style={{ backgroundColor: '#0F0A06', borderRadius: 18, borderWidth: 1, borderColor: '#2A1F14', padding: 16, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(232,82,26,0.12)', borderWidth: 1, borderColor: 'rgba(232,82,26,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="cube-outline" size={24} color="#E8521A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: '#FDF6EC' }} numberOfLines={1}>{productName}</Text>
                {productPrice && <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#E8521A', marginTop: 2 }}>{productPrice}</Text>}
              </View>
            </View>
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 17, color: '#FDF6EC', marginBottom: 8 }}>Send product enquiry?</Text>
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570', lineHeight: 20, marginBottom: 20 }}>This message will be sent to the vendor:</Text>
            <View style={{ backgroundColor: '#0F0A06', borderRadius: 16, borderWidth: 1, borderColor: '#2A1F14', padding: 14, marginBottom: 24 }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#FDF6EC', lineHeight: 22 }}>
                {`Hi! I'm interested in your product: `}
                <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', color: '#E8521A' }}>{productName}</Text>
                {productPrice ? ` (${productPrice})` : ''}{`. Is it still available?`}
              </Text>
            </View>
            <View style={{ gap: 10 }}>
              <TouchableOpacity onPress={sendEnquiry} activeOpacity={0.85} style={{ backgroundColor: '#E8521A', borderRadius: 16, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                <Ionicons name="send" size={16} color="white" />
                <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: 'white' }}>Send Enquiry</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowProductEnquiry(false)} activeOpacity={0.75} style={{ backgroundColor: '#2A1F14', borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#3D3026' }}>
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, color: '#9A8570' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Payment Request Sheet (vendor only) ── */}
      <Modal visible={showPaymentSheet} transparent animationType="slide">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} activeOpacity={1} onPress={() => setShowPaymentSheet(false)} />
        <View style={{ backgroundColor: '#1A1208', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: '#2A1F14', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 44 }}>
          <View style={{ width: 40, height: 4, backgroundColor: '#3D3026', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(232,82,26,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="cash-outline" size={22} color="#E8521A" />
            </View>
            <View>
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC' }}>Request Payment</Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570' }}>from {vendorName}</Text>
            </View>
          </View>

          {/* Amount */}
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12, color: '#6B5E50', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Amount</Text>
          <View style={{ backgroundColor: '#0F0A06', borderWidth: 1, borderColor: '#3D3026', borderRadius: 16, paddingHorizontal: 16, height: 60, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#6B5E50' }}>₦</Text>
            <RNTextInput
              value={payAmount}
              onChangeText={setPayAmount}
              placeholder="0.00"
              placeholderTextColor="#3D3026"
              keyboardType="numeric"
              style={{ flex: 1, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: '#FDF6EC', backgroundColor: 'transparent' }}
            />
          </View>

          {/* Description */}
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12, color: '#6B5E50', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description (optional)</Text>
          <View style={{ backgroundColor: '#0F0A06', borderWidth: 1, borderColor: '#3D3026', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 24 }}>
            <RNTextInput
              value={payDescription}
              onChangeText={setPayDescription}
              placeholder="e.g. 2 units of Red Sneakers"
              placeholderTextColor="#6B5E50"
              multiline
              style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#FDF6EC', backgroundColor: 'transparent', maxHeight: 80 }}
            />
          </View>

          <TouchableOpacity
            onPress={sendPaymentRequest}
            disabled={sendingPaymentRequest || !payAmount}
            style={{
              backgroundColor: payAmount ? '#E8521A' : '#2A1F14', borderRadius: 16, height: 56,
              alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
            }}
          >
            {sendingPaymentRequest
              ? <ActivityIndicator size="small" color="white" />
              : <>
                  <Ionicons name="send-outline" size={18} color={payAmount ? 'white' : '#6B5E50'} />
                  <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: payAmount ? 'white' : '#6B5E50' }}>
                    Send Request{payAmount ? ` · ₦${parseFloat(payAmount || '0').toLocaleString()}` : ''}
                  </Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </Modal>

      {alertElement}
    </KeyboardAvoidingView>
  </GestureHandlerRootView>
);
}