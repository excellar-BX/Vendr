import { useState, useRef } from 'react';
import {
  View, TouchableOpacity, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './StyledText';

interface TimePickerProps {
  label: string;
  value: string;
  onChange: (time: string) => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

function WheelPicker({
  items, selected, onSelect, formatItem,
}: {
  items: string[];
  selected: string;
  onSelect: (val: string) => void;
  formatItem?: (val: string) => string;
}) {
  const listRef = useRef<FlatList>(null);

  const handleSelect = (item: string, index: number) => {
    onSelect(item);
    // Scroll so selected item is centered (2 items from top in a 5-item view)
    listRef.current?.scrollToIndex({
      index: Math.max(0, index - 2),
      animated: true,
    });
  };

  return (
    <FlatList
      ref={listRef}
      data={items}
      keyExtractor={(item) => item}
      showsVerticalScrollIndicator={false}
      style={{ flex: 1, height: PICKER_HEIGHT }}
      initialScrollIndex={Math.max(0, items.indexOf(selected) - 2)}
      getItemLayout={(_, index) => ({
        length: ITEM_HEIGHT,
        offset: ITEM_HEIGHT * index,
        index,
      })}
      renderItem={({ item, index }) => {
        const isSelected = item === selected;
        return (
          <TouchableOpacity
            onPress={() => handleSelect(item, index)}
            activeOpacity={0.7}
            style={{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}
          >
            <Text
              style={{
                fontFamily: isSelected ? 'SpaceGrotesk_700Bold' : 'SpaceGrotesk_400Regular',
                fontSize: isSelected ? 22 : 16,
                color: isSelected ? '#E8521A' : '#6B5E50',
                opacity: isSelected ? 1 : 0.5,
              }}
            >
              {formatItem ? formatItem(item) : item}
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

export function TimePicker({ label, value, onChange, icon }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [tempHour, setTempHour] = useState(value.split(':')[0] ?? '08');
  const [tempMin, setTempMin] = useState(value.split(':')[1] ?? '00');

  const confirm = () => {
    onChange(`${tempHour}:${tempMin}`);
    setOpen(false);
  };

  const formatDisplay = (t: string) => {
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:${m} ${ampm}`;
  };

  const formatHour = (h: string) => {
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const display = hour % 12 === 0 ? 12 : hour % 12;
    return `${display} ${ampm}`;
  };

  return (
    <View className="flex-1">
      <Text
        className="text-muted text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}
      >
        {label}
      </Text>

      <TouchableOpacity
        onPress={() => {
          setTempHour(value.split(':')[0] ?? '08');
          setTempMin(value.split(':')[1] ?? '00');
          setOpen(true);
        }}
        activeOpacity={0.8}
        className="flex-row items-center bg-dark-2 border border-faint rounded-2xl px-4 h-14 gap-3"
      >
        {icon && <Ionicons name={icon} size={18} color="#6B5E50" />}
        <Text className="text-cream text-base flex-1" style={{ fontFamily: 'SpaceGrotesk_500Medium' }}>
          {formatDisplay(value)}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#6B5E50" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        />

        <View className="bg-dark-2 border-t border-faint rounded-t-3xl px-5 pt-4 pb-10">
          <View className="w-10 h-1 bg-faint rounded-full self-center mb-4" />

          <Text className="text-cream text-lg text-center mb-1" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
            {label}
          </Text>

          <Text className="text-orange text-3xl text-center mb-5" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
            {formatDisplay(`${tempHour}:${tempMin}`)}
          </Text>

          <View className="flex-row mb-2 px-4">
            <Text className="flex-1 text-center text-muted text-xs" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
              HOUR
            </Text>
            <View className="w-8" />
            <Text className="flex-1 text-center text-muted text-xs" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
              MINUTE
            </Text>
          </View>

          <View className="flex-row items-center px-2" style={{ height: PICKER_HEIGHT }}>
            <WheelPicker
              items={HOURS}
              selected={tempHour}
              onSelect={setTempHour}
              formatItem={formatHour}
            />
            <Text className="text-orange text-2xl w-8 text-center" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
              :
            </Text>
            <WheelPicker
              items={MINUTES}
              selected={tempMin}
              onSelect={setTempMin}
            />
          </View>

          <TouchableOpacity
            onPress={confirm}
            activeOpacity={0.85}
            className="bg-orange rounded-2xl py-4 items-center mt-5"
            style={{ shadowColor: '#E8521A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6 }}
          >
            <Text className="text-white text-base" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
              Confirm
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}