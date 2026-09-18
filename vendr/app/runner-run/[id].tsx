import { useState, useCallback, useEffect } from 'react';
import {
  View, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/ui/StyledText';
import { useVendrAlert } from '../../components/ui/VendrAlert';
import { apiFetch } from '../../lib/api';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

type RunStatus = 'assigned' | 'picked_up' | 'in_transit' | 'delivered';

interface RunDetail {
  id: string;
  order_id: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  seller_name: string;
  seller_phone?: string;
  buyer_name: string;
  buyer_phone?: string;
  delivery_fee: number;
  status: RunStatus;
  assigned_at: string;
  picked_up_at?: string;
  estimated_delivery: string;
  items: Array<{ name: string; quantity: number }>;
}

const STATUS_STEPS: RunStatus[] = ['assigned', 'picked_up', 'in_transit', 'delivered'];

const STATUS_LABELS: Record<RunStatus, string> = {
  assigned: 'Assigned',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  delivered: 'Delivered',
};

export default function RunTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showAlert, alertElement } = useVendrAlert();
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchRun = useCallback(async () => {
    try {
      // TODO: Replace with actual API call
      // const res = await apiFetch(`/runner/runs/${id}`, { method: 'GET' });
      // setRun(res.data);
      
      // Mock data
      setRun({
        id: id as string,
        order_id: 'ORD-1234567890',
        pickup_address: '12 Adetokunbo Ademola Street, Victoria Island, Lagos',
        dropoff_address: '45 Awolowo Road, Ikoyi, Lagos',
        pickup_lat: 6.4281,
        pickup_lng: 3.4219,
        dropoff_lat: 6.4398,
        dropoff_lng: 3.4064,
        seller_name: 'Chike Electronics',
        seller_phone: '+234 802 123 4567',
        buyer_name: 'Tunde Bakare',
        buyer_phone: '+234 803 987 6543',
        delivery_fee: 2500,
        status: 'picked_up',
        assigned_at: new Date(Date.now() - 15 * 60000).toISOString(),
        picked_up_at: new Date(Date.now() - 5 * 60000).toISOString(),
        estimated_delivery: '10 min',
        items: [
          { name: 'iPhone 13 Pro Case', quantity: 1 },
          { name: 'Screen Protector', quantity: 1 },
        ],
      });
    } catch (err) {
      showAlert({
        title: 'Error',
        message: 'Failed to load run details',
        type: 'danger',
      });
    } finally {
      setLoading(false);
    }
  }, [id, showAlert]);

  useEffect(() => {
    fetchRun();
  }, []);

  const handleUpdateStatus = async (newStatus: RunStatus) => {
    setUpdating(true);
    try {
      // TODO: Replace with actual API call
      // await apiFetch(`/runner/runs/${id}/status`, {
      //   method: 'PATCH',
      //   body: JSON.stringify({ status: newStatus }),
      // });
      
      setRun(prev => prev ? { ...prev, status: newStatus } : null);
      
      if (newStatus === 'delivered') {
        showAlert({
          title: 'Delivery Complete!',
          message: 'Great job! Your earnings will be available shortly.',
          type: 'success',
          buttons: [
            {
              text: 'View Earnings',
              onPress: () => router.replace('/(tabs)/runner-earnings'),
            },
          ],
        });
      }
    } catch (err) {
      showAlert({
        title: 'Error',
        message: 'Failed to update status. Please try again.',
        type: 'danger',
      });
    } finally {
      setUpdating(false);
    }
  };

  const getCurrentStepIndex = () => STATUS_STEPS.indexOf(run?.status || 'assigned');

  if (loading) {
    return (
      <View className="flex-1 bg-dark items-center justify-center">
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#2D8653" />
      </View>
    );
  }

  if (!run) {
    return (
      <View className="flex-1 bg-dark items-center justify-center px-5">
        <StatusBar style="light" />
        <Ionicons name="alert-circle-outline" size={48} color="#E85555" />
        <Text className="text-cream text-lg mt-4" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
          Run not found
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-green-500 rounded-2xl py-3 px-6 mt-4"
        >
          <Text className="text-dark text-sm" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStep = getCurrentStepIndex();

  return (
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />
      <View className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-green-500 opacity-[0.06]" />

      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-14 pb-4">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-dark-2 border border-faint rounded-xl items-center justify-center">
          <Ionicons name="chevron-back" size={20} color="#FDF6EC" />
        </TouchableOpacity>
        <Text className="text-cream text-lg" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
          Track Delivery
        </Text>
        <TouchableOpacity className="w-10 h-10 bg-dark-2 border border-faint rounded-xl items-center justify-center">
          <Ionicons name="call-outline" size={18} color="#2D8653" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Status Progress */}
        <View className="mx-5 bg-dark-2 border border-faint rounded-2xl p-5 mb-4">
          <View className="flex-row justify-between mb-4">
            {STATUS_STEPS.map((step, index) => {
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;
              return (
                <View key={step} className="flex-1 items-center">
                  <View
                    className={`w-8 h-8 rounded-full items-center justify-center ${
                      isCompleted ? 'bg-green-500' : isCurrent ? 'bg-green-500/30 border-2 border-green-500' : 'bg-dark-3'
                    }`}
                  >
                    {isCompleted ? (
                      <Ionicons name="checkmark" size={16} color="#1A1208" />
                    ) : (
                      <View className={`w-3 h-3 rounded-full ${isCurrent ? 'bg-green-500' : 'bg-faint'}`} />
                    )}
                  </View>
                  <Text
                    className={`text-xs mt-2 ${
                      isCurrent ? 'text-green-500' : isCompleted ? 'text-muted' : 'text-faint'
                    }`}
                    style={{ fontFamily: 'SpaceGrotesk_500Medium' }}
                  >
                    {STATUS_LABELS[step]}
                  </Text>
                </View>
              );
            })}
          </View>
          <View className="flex-row items-center justify-between pt-4 border-t border-faint">
            <Text className="text-muted text-xs">Order #{run.order_id.slice(-6)}</Text>
            <Text className="text-green-500 text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
              ₦{run.delivery_fee.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Route Info */}
        <View className="mx-5 bg-dark-2 border border-faint rounded-2xl p-4 mb-4">
          <View className="flex-row items-start gap-3">
            <View className="mt-1">
              <View className="w-2 h-2 bg-orange rounded-full" />
              <View className="w-0.5 h-16 bg-faint ml-1" />
              <View className="w-2 h-2 bg-green-500 rounded-full mt-1" />
            </View>
            <View className="flex-1">
              <View className="mb-4">
                <Text className="text-muted text-xs mb-1">FROM</Text>
                <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_500Medium' }}>
                  {run.seller_name}
                </Text>
                <Text className="text-muted text-xs">{run.pickup_address}</Text>
              </View>
              <View>
                <Text className="text-muted text-xs mb-1">TO</Text>
                <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_500Medium' }}>
                  {run.buyer_name}
                </Text>
                <Text className="text-muted text-xs">{run.dropoff_address}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Contact Cards */}
        <View className="mx-5 flex-row gap-3 mb-4">
          <TouchableOpacity className="flex-1 bg-dark-2 border border-faint rounded-2xl p-4">
            <View className="flex-row items-center gap-2 mb-2">
              <View className="w-8 h-8 bg-orange/20 rounded-full items-center justify-center">
                <Text className="text-orange text-xs" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
                  {run.seller_name.charAt(0)}
                </Text>
              </View>
              <Text className="text-cream text-xs" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
                Seller
              </Text>
            </View>
            <Text className="text-muted text-xs mb-2">{run.seller_name}</Text>
            <TouchableOpacity className="flex-row items-center gap-1">
              <Ionicons name="call-outline" size={14} color="#2D8653" />
              <Text className="text-green-500 text-xs">Call</Text>
            </TouchableOpacity>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1 bg-dark-2 border border-faint rounded-2xl p-4">
            <View className="flex-row items-center gap-2 mb-2">
              <View className="w-8 h-8 bg-green-500/20 rounded-full items-center justify-center">
                <Text className="text-green-500 text-xs" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
                  {run.buyer_name.charAt(0)}
                </Text>
              </View>
              <Text className="text-cream text-xs" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
                Buyer
              </Text>
            </View>
            <Text className="text-muted text-xs mb-2">{run.buyer_name}</Text>
            <TouchableOpacity className="flex-row items-center gap-1">
              <Ionicons name="call-outline" size={14} color="#2D8653" />
              <Text className="text-green-500 text-xs">Call</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {/* Items */}
        <View className="mx-5 bg-dark-2 border border-faint rounded-2xl p-4 mb-4">
          <Text className="text-muted text-xs mb-3">ITEMS ({run.items.length})</Text>
          {run.items.map((item, index) => (
            <View key={index} className="flex-row items-center justify-between py-2 border-b border-faint last:border-0">
              <Text className="text-cream text-sm">{item.name}</Text>
              <Text className="text-muted text-xs">x{item.quantity}</Text>
            </View>
          ))}
        </View>

        {/* ETA */}
        <View className="mx-5 bg-green-500/10 border border-green-500/30 rounded-2xl p-4 mb-4">
          <View className="flex-row items-center gap-2">
            <Ionicons name="time-outline" size={20} color="#2D8653" />
            <View>
              <Text className="text-green-500 text-xs" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
                Estimated Arrival
              </Text>
              <Text className="text-cream text-lg" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
                {run.estimated_delivery}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      {run.status !== 'delivered' && (
        <View className="absolute bottom-0 left-0 right-0 bg-dark border-t border-faint p-5">
          <TouchableOpacity
            onPress={() => {
              const nextStatus = STATUS_STEPS[currentStep + 1];
              handleUpdateStatus(nextStatus);
            }}
            disabled={updating}
            className="bg-green-500 rounded-2xl py-3.5 items-center"
          >
            {updating ? (
              <ActivityIndicator size="small" color="#1A1208" />
            ) : (
              <Text className="text-dark text-sm" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
                {run.status === 'assigned' ? 'Confirm Pickup' : 'Confirm Delivery'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {alertElement}
    </View>
  );
}
