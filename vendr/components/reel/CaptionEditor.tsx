import { useEffect, useState } from 'react';
import { View, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../ui/StyledText';
import { hashtagApi, HashtagSummary } from '../../lib/api';
import { T, useTheme } from '../../constants/theme';

export const MAX_TAGS = 15;
// Same rule as the server: "#" starts a tag only at the beginning of a word
const TAG_RE = /(?<![\p{L}\p{N}_#])#([\p{L}\p{N}_]+)/gu;

export function tagsIn(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(TAG_RE)) {
    if (/\p{L}/u.test(m[1])) out.add(m[1].toLowerCase());
  }
  return [...out];
}

/**
 * Caption box with hashtag help (used by "new post" and "edit post"):
 * - typing "#an…" suggests tags people already use
 * - shows the tags the post will have
 * - quick-add chips for trending tags
 */
export function CaptionEditor({ value, onChange, maxLength = 300, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  placeholder?: string;
}) {
  useTheme();
  const [cursor, setCursor] = useState(value.length);
  const [trending, setTrending] = useState<HashtagSummary[]>([]);
  const [suggestions, setSuggestions] = useState<HashtagSummary[]>([]);

  useEffect(() => {
    hashtagApi.trending(15).then(({ data }) => setTrending(data ?? [])).catch(() => {});
  }, []);

  const used = tagsIn(value);
  // The "#partial" word the cursor is in, if any
  const active = (() => {
    const m = value.slice(0, cursor).match(/(?<![\p{L}\p{N}_#])#([\p{L}\p{N}_]*)$/u);
    return m ? m[1].toLowerCase() : null;
  })();

  useEffect(() => {
    if (active === null) { setSuggestions([]); return; }
    if (active === '') { setSuggestions(trending.slice(0, 8)); return; }
    const t = setTimeout(() => {
      hashtagApi.search(active, 8)
        .then(({ data }) => setSuggestions(data ?? []))
        .catch(() => setSuggestions([]));
    }, 180);
    return () => clearTimeout(t);
  }, [active, trending]);

  const complete = (tag: string) => {
    const before = value.slice(0, cursor).replace(/#[\p{L}\p{N}_]*$/u, `#${tag} `);
    const after = value.slice(cursor).replace(/^[\p{L}\p{N}_]*/u, '');
    const next = (before + after).slice(0, maxLength);
    onChange(next);
    setCursor(Math.min(before.length, next.length));
  };

  const append = (tag: string) => {
    if (used.includes(tag) || used.length >= MAX_TAGS) return;
    const sep = value.length === 0 || /\s$/.test(value) ? '' : ' ';
    const next = `${value}${sep}#${tag} `.slice(0, maxLength);
    onChange(next);
    setCursor(next.length);
  };

  return (
    <View>
      <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, minHeight: 90 }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          onSelectionChange={(e) => setCursor(e.nativeEvent.selection.end)}
          placeholder={placeholder ?? 'What are you showing? Sizes, colours, price… add #hashtags'}
          placeholderTextColor={T.ink4}
          multiline
          maxLength={maxLength}
          style={{ color: T.ink, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14.5, lineHeight: 21, textAlignVertical: 'top' }}
        />
      </View>
      <Text style={{ fontSize: 11, color: T.ink4, textAlign: 'right', marginTop: 4 }}>{value.length}/{maxLength}</Text>

      {active !== null && suggestions.length > 0 && (
        <View style={{ marginTop: 4, borderRadius: 14, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface, overflow: 'hidden' }}>
          {suggestions.map((t, i) => (
            <TouchableOpacity
              key={t.tag}
              onPress={() => complete(t.tag)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: T.line }}
            >
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: T.primary }}>#</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.ink }}>{t.tag}</Text>
              <Text style={{ fontSize: 12, color: T.ink3 }}>{t.post_count} post{t.post_count === 1 ? '' : 's'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {used.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {used.slice(0, MAX_TAGS).map((t) => (
            <View key={t} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: T.primarySoft }}>
              <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: T.primaryInk }}>#{t}</Text>
            </View>
          ))}
          <Text style={{ fontSize: 11.5, color: used.length > MAX_TAGS ? T.dangerInk : T.ink4, alignSelf: 'center' }}>
            {used.length > MAX_TAGS ? `Only the first ${MAX_TAGS} tags count` : `${used.length}/${MAX_TAGS}`}
          </Text>
        </View>
      )}

      {active === null && trending.some((t) => !used.includes(t.tag)) && used.length < MAX_TAGS && (
        <>
          <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink3, letterSpacing: 1, marginTop: 14, marginBottom: 8 }}>ADD HASHTAGS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
            {trending.filter((t) => !used.includes(t.tag)).slice(0, 12).map((t) => (
              <TouchableOpacity
                key={t.tag}
                onPress={() => append(t.tag)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 34, borderRadius: 17, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface }}
              >
                <Ionicons name="add" size={14} color={T.ink3} />
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.ink2 }}>#{t.tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}
