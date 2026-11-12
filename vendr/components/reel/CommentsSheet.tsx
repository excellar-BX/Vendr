import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Modal, Pressable, FlatList, TextInput, TouchableOpacity, Image, ActivityIndicator,
  KeyboardAvoidingView, Platform, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../ui/StyledText';
import { reelSocialApi } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { T, useTheme } from '../../constants/theme';

export interface ReelComment {
  id: string;
  reel_id: string;
  parent_id: string | null;
  body: string;
  is_deleted: boolean;
  reply_count: number;
  created_at: string;
  user: { id: string; name: string; avatar_url: string | null };
  is_mine: boolean;
  is_author: boolean;
  can_delete: boolean;
  pending?: boolean;
}

function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function Avatar({ uri, name, size = 34 }: { uri: string | null; name: string; size?: number }) {
  useTheme();
  return uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: T.surface2 }} />
    : (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: size * 0.38, fontFamily: 'PlusJakartaSans_700Bold', color: T.primaryInk }}>{(name || '?').slice(0, 1).toUpperCase()}</Text>
      </View>
    );
}

/** Bottom sheet with a post's comments. Reports count changes back to the feed. */
export function CommentsSheet({ reelId, visible, onClose, count, onCountChange }: {
  reelId: string | null;
  visible: boolean;
  onClose: () => void;
  count: number;
  onCountChange: (reelId: string, delta: number) => void;
}) {
  useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const user = useAuthStore((s) => s.user);
  const inputRef = useRef<TextInput>(null);

  const [comments, setComments] = useState<ReelComment[]>([]);
  const [replies, setReplies] = useState<Record<string, ReelComment[]>>({});
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ReelComment | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async (before?: string) => {
    if (!reelId) return;
    setLoading(true);
    setError(false);
    try {
      const { data } = await reelSocialApi.comments(reelId, { before, limit: 30 });
      const page = (data ?? []) as ReelComment[];
      setComments((prev) => (before ? [...prev, ...page.filter((c) => !prev.some((p) => p.id === c.id))] : page));
      setHasMore(page.length === 30);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [reelId]);

  useEffect(() => {
    if (visible && reelId) {
      setComments([]); setReplies({}); setReplyTo(null); setText('');
      load();
    }
  }, [visible, reelId]);

  const loadReplies = async (parent: ReelComment) => {
    if (!reelId) return;
    try {
      const { data } = await reelSocialApi.comments(reelId, { parent_id: parent.id, limit: 50 });
      setReplies((r) => ({ ...r, [parent.id]: (data ?? []) as ReelComment[] }));
    } catch {}
  };

  const send = async () => {
    const body = text.trim();
    if (!body || !reelId || sending) return;
    const parent = replyTo ? (replyTo.parent_id ? comments.find((c) => c.id === replyTo.parent_id) ?? replyTo : replyTo) : null;
    const temp: ReelComment = {
      id: `tmp-${Date.now()}`, reel_id: reelId, parent_id: parent?.id ?? null, body, is_deleted: false, reply_count: 0,
      created_at: new Date().toISOString(),
      user: { id: user?.id ?? '', name: user?.full_name ?? 'You', avatar_url: (user as any)?.avatar_url ?? null },
      is_mine: true, is_author: false, can_delete: false, pending: true,
    };
    setSending(true);
    setText('');
    setReplyTo(null);
    if (parent) {
      setReplies((r) => ({ ...r, [parent.id]: [...(r[parent.id] ?? []), temp] }));
      setComments((cs) => cs.map((c) => (c.id === parent.id ? { ...c, reply_count: c.reply_count + 1 } : c)));
    } else {
      setComments((cs) => [temp, ...cs]);
    }
    onCountChange(reelId, 1);
    try {
      const { data } = await reelSocialApi.addComment(reelId, body, replyTo?.id ?? null);
      const saved = data as ReelComment;
      if (parent) setReplies((r) => ({ ...r, [parent.id]: (r[parent.id] ?? []).map((c) => (c.id === temp.id ? saved : c)) }));
      else setComments((cs) => cs.map((c) => (c.id === temp.id ? saved : c)));
    } catch {
      // roll back and give the text back
      if (parent) {
        setReplies((r) => ({ ...r, [parent.id]: (r[parent.id] ?? []).filter((c) => c.id !== temp.id) }));
        setComments((cs) => cs.map((c) => (c.id === parent.id ? { ...c, reply_count: Math.max(0, c.reply_count - 1) } : c)));
      } else {
        setComments((cs) => cs.filter((c) => c.id !== temp.id));
      }
      onCountChange(reelId, -1);
      setText(body);
    } finally {
      setSending(false);
    }
  };

  const remove = async (c: ReelComment) => {
    if (!reelId) return;
    const strip = (list: ReelComment[]) => list.filter((x) => x.id !== c.id);
    if (c.parent_id) {
      setReplies((r) => ({ ...r, [c.parent_id!]: strip(r[c.parent_id!] ?? []) }));
      setComments((cs) => cs.map((x) => (x.id === c.parent_id ? { ...x, reply_count: Math.max(0, x.reply_count - 1) } : x)));
    } else {
      setComments((cs) => (c.reply_count > 0 ? cs.map((x) => (x.id === c.id ? { ...x, is_deleted: true, body: '' } : x)) : strip(cs)));
    }
    onCountChange(reelId, -1);
    try { await reelSocialApi.deleteComment(c.id); } catch { load(); }
  };

  const startReply = (c: ReelComment) => {
    setReplyTo(c);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const Row = ({ c, isReply }: { c: ReelComment; isReply?: boolean }) => (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 9, paddingLeft: isReply ? 44 : 0, opacity: c.pending ? 0.6 : 1 }}>
      <Avatar uri={c.user.avatar_url} name={c.user.name} size={isReply ? 26 : 34} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.ink3 }}>{c.is_mine ? 'You' : c.user.name}</Text>
          {c.is_author && (
            <View style={{ backgroundColor: T.primarySoft, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
              <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_700Bold', color: T.primaryInk }}>SELLER</Text>
            </View>
          )}
          <Text style={{ fontSize: 11.5, color: T.ink4 }}>{c.pending ? 'sending…' : timeAgo(c.created_at)}</Text>
        </View>
        <Text style={{ fontSize: 14.5, lineHeight: 20, color: c.is_deleted ? T.ink4 : T.ink, fontStyle: c.is_deleted ? 'italic' : 'normal', marginTop: 2 }}>
          {c.is_deleted ? 'Comment deleted' : c.body}
        </Text>
        {!c.pending && !c.is_deleted && (
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
            <TouchableOpacity onPress={() => startReply(c)} hitSlop={8}>
              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.ink3 }}>Reply</Text>
            </TouchableOpacity>
            {c.can_delete && (
              <TouchableOpacity onPress={() => remove(c)} hitSlop={8}>
                <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.dangerInk }}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ height: Math.round(height * 0.72), backgroundColor: T.canvas, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' }}>
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: T.line }}>
            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: T.lineStrong, marginBottom: 10 }} />
            <Text style={{ fontSize: 14.5, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>{count} comment{count === 1 ? '' : 's'}</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close comments" style={{ position: 'absolute', right: 12, top: 16, padding: 4 }}>
              <Ionicons name="close" size={22} color={T.ink2} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            onEndReached={() => { if (hasMore && !loading && comments.length) load(comments[comments.length - 1].created_at); }}
            onEndReachedThreshold={0.4}
            renderItem={({ item }) => (
              <View>
                <Row c={item} />
                {(replies[item.id] ?? []).map((r) => <Row key={r.id} c={r} isReply />)}
                {item.reply_count > (replies[item.id]?.length ?? 0) && (
                  <TouchableOpacity onPress={() => loadReplies(item)} style={{ paddingLeft: 44, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 22, height: 1, backgroundColor: T.lineStrong }} />
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.ink3 }}>
                      View {item.reply_count - (replies[item.id]?.length ?? 0)} repl{item.reply_count - (replies[item.id]?.length ?? 0) === 1 ? 'y' : 'ies'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 }}>
                {loading ? <ActivityIndicator color={T.primary} /> : error ? (
                  <>
                    <Text style={{ fontSize: 14, color: T.ink3 }}>Couldn't load comments</Text>
                    <TouchableOpacity onPress={() => load()}><Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: T.primaryInk }}>Retry</Text></TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Ionicons name="chatbubbles-outline" size={34} color={T.ink4} />
                    <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>No comments yet</Text>
                    <Text style={{ fontSize: 13, color: T.ink3 }}>Ask about sizes, prices or delivery.</Text>
                  </>
                )}
              </View>
            }
            ListFooterComponent={loading && comments.length > 0 ? <ActivityIndicator color={T.primary} style={{ marginVertical: 10 }} /> : null}
          />

          {replyTo && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: T.surface2 }}>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, color: T.ink3 }}>
                Replying to <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: T.ink2 }}>{replyTo.is_mine ? 'yourself' : replyTo.user.name}</Text>
              </Text>
              <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={10}><Ionicons name="close-circle" size={18} color={T.ink4} /></TouchableOpacity>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: insets.bottom + 8, borderTopWidth: 1, borderTopColor: T.line }}>
            <View style={{ flex: 1, minHeight: 42, justifyContent: 'center', backgroundColor: T.surface, borderRadius: 21, borderWidth: 1, borderColor: T.line, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 10 : 4 }}>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
                placeholderTextColor={T.ink4}
                multiline
                maxLength={500}
                style={{ fontSize: 14.5, color: T.ink, fontFamily: 'PlusJakartaSans_400Regular', maxHeight: 100, paddingVertical: 0 }}
              />
            </View>
            <TouchableOpacity
              onPress={send}
              disabled={!text.trim() || sending}
              accessibilityLabel="Post comment"
              style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: text.trim() ? T.primary : T.surface2 }}
            >
              <Ionicons name="arrow-up" size={20} color={text.trim() ? T.onPrimary : T.ink4} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
