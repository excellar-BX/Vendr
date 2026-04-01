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
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useVendrAlert } from '../../components/ui/VendrAlert';

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
  created_at: string;
}

interface PaymentRequest {
  id: string;
  vendor_id: string;
  buyer_id: string;
  conversation_id: string;
  amount: number;
  description: string;
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

  const { session } = useAuthStore();
  const { showAlert: vendrAlert, alertElement } = useVendrAlert();
  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
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

  useEffect(() => {
    if (!session?.user?.id) return;
    initChat();
  }, []);

  const initChat = async () => {
    const userId = session!.user.id;
    setError(null);

    try {
      const isValidUUID = (s?: string) => !!s && s !== '[conversationId]' && s.includes('-');
      let cid = isValidUUID(conversationId) ? conversationId! : null;

      if (!cid && vendorId) {
        const { data: existing } = await supabase
          .from('conversations')
          .select('id')
          .eq('buyer_id', userId)
          .eq('vendor_id', vendorId)
          .maybeSingle();

        if (existing?.id) {
          cid = existing.id;
        } else {
          const { data: created, error: createErr } = await supabase
            .from('conversations')
            .insert({ buyer_id: userId, vendor_id: vendorId })
            .select('id')
            .maybeSingle();
          if (createErr) throw new Error('Could not start conversation: ' + createErr.message);
          if (!created?.id) throw new Error('Could not create conversation');
          cid = created.id;
        }
      }

      if (!cid) throw new Error('No conversation ID');
      setConvId(cid);

      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .select('id, buyer_id, vendor_id')
        .eq('id', cid)
        .single();
      if (convErr) throw new Error('Could not load conversation: ' + convErr.message);

      setBuyerId(conv.buyer_id);

      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id, business_name, is_verified, user_id')
        .eq('id', conv.vendor_id)
        .single();

      const actingAsVendor = vendorData?.user_id === userId;
      setActingAsVendor(actingAsVendor);
      setVendorDbId(conv.vendor_id);
      setVendorUserId(vendorData?.user_id ?? '');

      if (!actingAsVendor && vendorData?.user_id === userId) {
        throw new Error('You cannot chat with your own store.');
      }

      if (actingAsVendor) {
        const { data: buyerData } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('id', conv.buyer_id)
          .single();
        setVendorName(buyerData?.name ?? 'Unknown Buyer');
      } else {
        setVendorName(vendorData?.business_name ?? 'Vendor');
        setVendorActualId(vendorData?.id ?? '');
        setIsVerified(vendorData?.is_verified ?? false);
      }

      const { data: msgs, error: msgsErr } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', cid)
        .order('created_at', { ascending: true });
      if (msgsErr) throw new Error('Could not load messages: ' + msgsErr.message);

      setMessages(msgs ?? []);

      // Load payment requests for this conversation
      const prMsgIds = (msgs ?? [])
        .filter(m => m.type === 'payment_request' && m.content)
        .map(m => m.content);

      if (prMsgIds.length > 0) {
        const { data: prs } = await supabase
          .from('payment_requests')
          .select('*')
          .in('id', prMsgIds);
        if (prs) {
          const map: Record<string, PaymentRequest> = {};
          prs.forEach(pr => { map[pr.id] = pr; });
          setPaymentRequests(map);
        }
      }

      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 150);

      // Realtime — messages
      const channel = supabase
        .channel(`chat-${cid}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.conversation_id !== cid) return;
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // If it's a payment request, load the PR data
          if (newMsg.type === 'payment_request' && newMsg.content) {
            supabase.from('payment_requests').select('*').eq('id', newMsg.content).maybeSingle()
              .then(({ data }) => {
                if (data) setPaymentRequests(prev => ({ ...prev, [data.id]: data }));
              });
          }
          if (newMsg.sender_id !== session?.user?.id) {
            supabase.from('messages').update({ delivered: true, is_read: true }).eq('id', newMsg.id);
          }
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
          if ((payload.new as any).conversation_id !== cid) return;
          setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        })
        // Realtime on payment_requests table
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payment_requests' }, (payload) => {
          const updated = payload.new as PaymentRequest;
          setPaymentRequests(prev => ({ ...prev, [updated.id]: updated }));
        })
        .subscribe();

      channelRef.current = channel;

      await supabase.from('messages').update({ delivered: true, is_read: true })
        .eq('conversation_id', cid).neq('sender_id', userId);
      await supabase.from('messages').update({ delivered: true })
        .eq('conversation_id', cid).eq('sender_id', userId);

      const unreadField = actingAsVendor ? 'vendor_unread' : 'buyer_unread';
      await supabase.from('conversations').update({ [unreadField]: 0 }).eq('id', cid);

      await supabase.from('user_presence').upsert({
        user_id: userId, is_online: true, last_seen: new Date().toISOString(),
      });

      const otherUserId = actingAsVendor ? conv.buyer_id : vendorData?.user_id;
      if (otherUserId) {
        const { data: presence } = await supabase
          .from('user_presence').select('is_online').eq('user_id', otherUserId).maybeSingle();
        setOtherOnline(presence?.is_online ?? false);
      }

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
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (session?.user?.id) {
        supabase.from('user_presence').upsert({
          user_id: session.user.id, is_online: false, last_seen: new Date().toISOString(),
        });
      }
    };
  }, []);

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
    if (!convId || !session?.user?.id) return;
    setUploadingImage(true);
    const tempId = `temp-img-${Date.now()}`;

    try {
      const tempMsg: Message = {
        id: tempId, conversation_id: convId, sender_id: session.user.id,
        content: 'Sending image...', image_url: null, type: 'text',
        is_read: false, delivered: false, created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, tempMsg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

      const fileName = `${convId}/${Date.now()}.jpg`;
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) throw new Error('Not authenticated');

      const publicUrl = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://mbdojwirmtknzpwccthb.supabase.co/storage/v1/object/chat-images/${fileName}`);
        xhr.setRequestHeader('Authorization', `Bearer ${currentSession.access_token}`);
        xhr.setRequestHeader('x-upsert', 'true');
        xhr.setRequestHeader('Content-Type', 'image/jpeg');
        xhr.onload = () => {
          if (xhr.status === 200) {
            const { data } = supabase.storage.from('chat-images').getPublicUrl(fileName);
            resolve(data.publicUrl);
          } else {
            reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send({ uri, type: 'image/jpeg', name: 'photo.jpg' } as any);
      });

      const { data: inserted, error: insertErr } = await supabase.from('messages').insert({
        conversation_id: convId, sender_id: session.user.id,
        image_url: publicUrl, type: 'image', is_read: false, delivered: false,
      }).select().single();
      if (insertErr) throw new Error(insertErr.message);

      await supabase.from('messages').update({ delivered: true }).eq('id', inserted.id);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...inserted, delivered: true } : m));
      await supabase.from('conversations').update({
        last_message: 'Image', last_message_at: new Date().toISOString(),
      }).eq('id', convId);

    } catch (e: any) {
      console.error('Upload error:', e.message);
      vendrAlert({ title: 'Upload Failed', message: e.message ?? 'Something went wrong', type: 'danger' });
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
    if (!newContent || !editingMsg) return;
    setSending(true);
    setText('');
    setMessages(prev => prev.map(m => m.id === editingMsg.id ? { ...m, content: newContent, edited: true } as any : m));
    setEditingMsg(null);
    const { error } = await supabase.from('messages').update({ content: newContent, edited: true }).eq('id', editingMsg.id);
    if (error) {
      vendrAlert({ title: 'Error', message: 'Could not edit message', type: 'danger' });
      setMessages(prev => prev.map(m => m.id === editingMsg.id ? editingMsg : m));
      setSending(false);
      return;
    }
    const { data: latest } = await supabase
      .from('messages').select('id').eq('conversation_id', convId)
      .order('created_at', { ascending: false }).limit(1).single();
    if (latest?.id === editingMsg.id) {
      await supabase.from('conversations').update({ last_message: newContent }).eq('id', convId);
    }
    setSending(false);
  };

  const deleteMessage = async () => {
    if (!selectedMsg) return;
    setShowActions(false);
    vendrAlert({
      title: 'Delete Message?',
      message: 'This cannot be undone.',
      type: 'danger',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          setMessages(prev => prev.filter(m => m.id !== selectedMsg.id));
          const { error } = await supabase.from('messages').delete().eq('id', selectedMsg.id);
          if (error) {
            vendrAlert({ title: 'Error', message: 'Could not delete message', type: 'danger' });
            setMessages(prev => [...prev, selectedMsg].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            ));
            return;
          }
          const { data: latest } = await supabase.from('messages').select('content, type, created_at')
            .eq('conversation_id', convId).order('created_at', { ascending: false }).limit(1).single();
          await supabase.from('conversations').update({
            last_message: latest ? (latest.type === 'image' ? 'Image' : latest.content) : null,
            last_message_at: latest?.created_at ?? new Date().toISOString(),
          }).eq('id', convId);
        }},
      ],
    });
  };

  const sendEnquiry = async () => {
    if (!convId || !session?.user?.id || !productName) return;
    setShowProductEnquiry(false);
    const msg = `Hi! I'm interested in your product: *${productName}*${productPrice ? ` (${productPrice})` : ''}. Is it still available?`;
    setText(msg);
    setSending(true);
    const { data: inserted, error: insertErr } = await supabase.from('messages').insert({
      conversation_id: convId, sender_id: session.user.id, content: msg, type: 'text', is_read: false,
    }).select().single();
    if (!insertErr && inserted) {
      await supabase.from('messages').update({ delivered: true }).eq('id', inserted.id);
      setMessages(prev => [...prev, { ...inserted, delivered: true }]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      const unreadField = actingAsVendor ? 'buyer_unread' : 'vendor_unread';
      await supabase.rpc('increment_unread', { conv_id: convId, field: unreadField });
      await supabase.from('conversations').update({ last_message: msg, last_message_at: new Date().toISOString() }).eq('id', convId);
    }
    setText('');
    setSending(false);
  };

  // ─── Payment Request ───────────────────────────────────────────────────────
  const sendPaymentRequest = async () => {
    if (!convId || !session?.user?.id) return;
    const amount = parseFloat(payAmount.replace(/[^0-9.]/g, ''));
    if (!amount || amount <= 0) {
      vendrAlert({ title: 'Invalid Amount', message: 'Please enter a valid amount to request.', type: 'warning' });
      return;
    }
    if (!vendorDbId || !buyerId) {
      vendrAlert({ title: 'Error', message: 'Conversation not fully loaded. Please go back and try again.', type: 'danger' });
      return;
    }

    setSendingPaymentRequest(true);
    try {
      // Create payment_request row
      const { data: pr, error: prErr } = await supabase
        .from('payment_requests')
        .insert({
          vendor_id: vendorDbId,
          buyer_id: buyerId,
          conversation_id: convId,
          amount,
          description: payDescription.trim(),
          status: 'pending',
          vendor_user_id: vendorUserId,
        })
        .select()
        .single();

      if (prErr) throw new Error(prErr.message);

      // Store PR in local map immediately
      setPaymentRequests(prev => ({ ...prev, [pr.id]: pr }));

      // Insert special message — content = payment_request id, type = 'payment_request'
      const { data: msg, error: msgErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: convId,
          sender_id: session.user.id,
          content: pr.id,
          type: 'payment_request',
          is_read: false,
        })
        .select()
        .single();

      if (msgErr) throw new Error(msgErr.message);

      setMessages(prev => [...prev, msg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

      await supabase.from('conversations').update({
        last_message: `Payment request: ${formatAmount(amount)}`,
        last_message_at: new Date().toISOString(),
      }).eq('id', convId);
      await supabase.rpc('increment_unread', { conv_id: convId, field: 'buyer_unread' });

      setShowPaymentSheet(false);
      setPayAmount('');
      setPayDescription('');
    } catch (e: any) {
      vendrAlert({ title: 'Error', message: e.message, type: 'danger' });
    } finally {
      setSendingPaymentRequest(false);
    }
  };

  const handlePayNow = async (pr: PaymentRequest) => {
    if (!session?.user?.id) return;
    setPaying(pr.id);
    try {
      // Check buyer balance first
      const { data: wallet } = await supabase
        .from('wallets')
        .select('available_balance')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!wallet || wallet.available_balance < pr.amount) {
        setPaying(null);
        vendrAlert({
          title: 'Insufficient Balance',
          message: `You need ${formatAmount(pr.amount)} but only have ${formatAmount(wallet?.available_balance ?? 0)} in your wallet.`,
          type: 'warning',
          buttons: [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Fund Wallet', style: 'default', onPress: () => router.push('/fund-wallet') },
          ],
        });
        return;
      }

      // Call process_payment Postgres function
      const { error: payErr } = await supabase.rpc('process_payment', {
        p_buyer_id: session.user.id,
        p_vendor_id: pr.vendor_id,   // vendors.id — resolved by process_payment() SQL function
        p_amount: pr.amount,
        p_payment_request_id: pr.id,
        p_description: pr.description || `Payment to vendor`,
      });

      if (payErr) throw new Error(payErr.message);

      // Mark payment_request as paid
      const { data: updatedPr } = await supabase
        .from('payment_requests')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', pr.id)
        .select()
        .single();

      if (updatedPr) setPaymentRequests(prev => ({ ...prev, [pr.id]: updatedPr }));

      // Send confirmation message
      await supabase.from('messages').insert({
        conversation_id: convId,
        sender_id: session.user.id,
        content: `Payment of ${formatAmount(pr.amount)} sent successfully.`,
        type: 'text',
        is_read: false,
      });

      await supabase.from('conversations').update({
        last_message: `Paid ${formatAmount(pr.amount)}`,
        last_message_at: new Date().toISOString(),
      }).eq('id', convId);

    } catch (e: any) {
      vendrAlert({ title: 'Payment Failed', message: e.message, type: 'danger' });
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
          const { data: updated } = await supabase
            .from('payment_requests')
            .update({ status: 'cancelled' })
            .eq('id', pr.id)
            .select()
            .single();
          if (updated) setPaymentRequests(prev => ({ ...prev, [pr.id]: updated }));
        }},
      ],
    });
  };

  const sendMessage = async () => {
    if (editingMsg) { editMessage(); return; }
    const content = text.trim();
    if (!content || !convId || !session?.user?.id || sending) return;
    setText('');
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const tempMsg: Message = {
      id: tempId, conversation_id: convId, sender_id: session.user.id,
      content, image_url: null, type: 'text',
      is_read: false, delivered: false, created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    const { data: inserted, error: insertErr } = await supabase.from('messages').insert({
      conversation_id: convId, sender_id: session.user.id, content, type: 'text', is_read: false,
    }).select().single();

    if (insertErr) {
      vendrAlert({ title: 'Send Failed', message: 'Could not send message: ' + insertErr.message, type: 'danger' });
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setText(content);
      setSending(false);
      return;
    }

    await supabase.from('messages').update({ delivered: true }).eq('id', inserted.id);
    setMessages(prev => prev.map(m => m.id === tempId ? { ...inserted, delivered: true } : m));

    const unreadField = actingAsVendor ? 'buyer_unread' : 'vendor_unread';
    await supabase.rpc('increment_unread', { conv_id: convId, field: unreadField });
    await supabase.from('conversations').update({
      last_message: content, last_message_at: new Date().toISOString(),
    }).eq('id', convId);

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
              const pr = item.content ? paymentRequests[item.content] : null;
              return (
                <PaymentRequestBubble
                  msg={item}
                  isMine={item.sender_id === session?.user?.id}
                  paymentRequest={pr}
                  onPay={handlePayNow}
                  onCancel={handleCancelRequest}
                  paying={paying}
                />
              );
            }
            return (
              <MessageBubble
                msg={item}
                isMine={item.sender_id === session?.user?.id}
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
              <Image
                source={{ uri: viewingImage }}
                style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.85 }}
                resizeMode="contain"
              />
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
  );
}