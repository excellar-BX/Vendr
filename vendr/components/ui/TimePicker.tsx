import { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, Modal, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './StyledText';
import { T, useTheme } from '../../constants/theme';
import { Fonts } from '../../constants/colors';

interface TimePickerProps {
  label: string;
  value: string; // "HH:mm" (24h)
  onChange: (time: string) => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PAD = Math.floor(VISIBLE_ITEMS / 2); // rows above/below the centred selection

// Plain module-level data — no hooks here.
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

function parse(value: string) {
  const [h = '08', m = '00'] = (value || '').split(':');
  return {
    hour: HOURS.includes(h.padStart(2, '0')) ? h.padStart(2, '0') : '08',
    minute: MINUTES.includes(m.padStart(2, '0')) ? m.padStart(2, '0') : '00',
  };
}

function to12h(hour: string) {
  const n = parseInt(hour, 10);
  return { h: n % 12 === 0 ? 12 : n % 12, ampm: n >= 12 ? 'PM' : 'AM' };
}

function formatDisplay(t: string) {
  const { hour, minute } = parse(t);
  const { h, ampm } = to12h(hour);
  return `${h}:${minute} ${ampm}`;
}

function WheelPicker({
  items, selected, onSelect, formatItem, label,
}: {
  items: string[];
  selected: string;
  onSelect: (val: string) => void;
  formatItem?: (val: string) => string;
  label: string;
}) {
  useTheme();
  const listRef = useRef<FlatList<string>>(null);
  const index = Math.max(0, items.indexOf(selected));

  // Keep the selected value centred when it changes
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: index * ITEM_HEIGHT, animated: true });
  }, [index]);

  return (
    <View style={{ flex: 1, height: PICKER_HEIGHT }}>
      {/* Selection band behind the centred row */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', left: 4, right: 4, top: PAD * ITEM_HEIGHT, height: ITEM_HEIGHT,
          borderRadius: 12, backgroundColor: T.primarySoft,
        }}
      />
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: PAD * ITEM_HEIGHT }}
        initialScrollIndex={index}
        getItemLayout={(_, i) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * i, index: i })}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
          const val = items[Math.max(0, Math.min(i, items.length - 1))];
          if (val && val !== selected) onSelect(val);
        }}
        accessibilityLabel={label}
        renderItem={({ item }) => {
          const isSelected = item === selected;
          return (
            <TouchableOpacity
              onPress={() => onSelect(item)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${label} ${formatItem ? formatItem(item) : item}`}
              style={{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text
                style={{
                  fontFamily: isSelected ? Fonts.bold : Fonts.medium,
                  fontSize: isSelected ? 22 : 17,
                  color: isSelected ? T.primaryInk : T.ink3,
                }}
              >
                {formatItem ? formatItem(item) : item}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

export function TimePicker({ label, value, onChange, icon }: TimePickerProps) {
  useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [tempHour, setTempHour] = useState(parse(value).hour);
  const [tempMin, setTempMin] = useState(parse(value).minute);

  const openPicker = () => {
    const p = parse(value);
    setTempHour(p.hour);
    setTempMin(p.minute);
    setOpen(true);
  };

  const confirm = () => {
    onChange(`${tempHour}:${tempMin}`);
    setOpen(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          fontFamily: Fonts.semibold, fontSize: 12, color: T.ink2,
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8,
        }}
      >
        {label}
      </Text>

      {/* Field */}
      <TouchableOpacity
        onPress={openPicker}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDisplay(value)}. Change`}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 10, height: 56, paddingHorizontal: 16,
          borderRadius: 16, backgroundColor: T.surface, borderWidth: 1, borderColor: T.lineStrong,
        }}
      >
        <Ionicons name={icon ?? 'time-outline'} size={18} color={T.ink3} />
        <Text style={{ flex: 1, fontFamily: Fonts.semibold, fontSize: 16, color: T.ink }}>
          {formatDisplay(value)}
        </Text>
        <Ionicons name="chevron-down" size={16} color={T.ink3} />
      </TouchableOpacity>

      {/* Sheet */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable style={{ flex: 1, backgroundColor: T.overlay }} onPress={() => setOpen(false)} accessibilityLabel="Close" />

        <View
          style={{
            backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
            borderTopWidth: 1, borderColor: T.line,
            paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 20,
          }}
        >
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: T.lineStrong, alignSelf: 'center', marginBottom: 16 }} />

          <Text style={{ fontFamily: Fonts.bold, fontSize: 17, color: T.ink, textAlign: 'center' }}>{label}</Text>
          <Text style={{ fontFamily: Fonts.extrabold, fontSize: 32, color: T.primaryInk, textAlign: 'center', marginTop: 4, marginBottom: 18, letterSpacing: -0.5 }}>
            {formatDisplay(`${tempHour}:${tempMin}`)}
          </Text>

          <View style={{ flexDirection: 'row', marginBottom: 6, paddingHorizontal: 8 }}>
            <Text style={{ flex: 1, textAlign: 'center', fontFamily: Fonts.semibold, fontSize: 12, color: T.ink2, letterSpacing: 1 }}>HOUR</Text>
            <View style={{ width: 24 }} />
            <Text style={{ flex: 1, textAlign: 'center', fontFamily: Fonts.semibold, fontSize: 12, color: T.ink2, letterSpacing: 1 }}>MINUTE</Text>
          </View>

          <View
            style={{
              flexDirection: 'row', alignItems: 'center', height: PICKER_HEIGHT,
              backgroundColor: T.surface2, borderRadius: 18, paddingHorizontal: 4, overflow: 'hidden',
            }}
          >
            <WheelPicker
              items={HOURS}
              selected={tempHour}
              onSelect={setTempHour}
              formatItem={(h) => { const t = to12h(h); return `${t.h} ${t.ampm}`; }}
              label="Hour"
            />
            <Text style={{ width: 24, textAlign: 'center', fontFamily: Fonts.bold, fontSize: 22, color: T.primaryInk }}>:</Text>
            <WheelPicker items={MINUTES} selected={tempMin} onSelect={setTempMin} label="Minute" />
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            <TouchableOpacity
              onPress={() => setOpen(false)}
              activeOpacity={0.85}
              accessibilityRole="button"
              style={{ flex: 1, height: 54, borderRadius: 16, borderWidth: 1, borderColor: T.lineStrong, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: Fonts.semibold, fontSize: 16, color: T.ink }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirm}
              activeOpacity={0.85}
              accessibilityRole="button"
              style={{
                flex: 2, height: 54, borderRadius: 16, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center',
                shadowColor: T.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4,
              }}
            >
              <Text style={{ fontFamily: Fonts.bold, fontSize: 16, color: '#FFFFFF' }}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
