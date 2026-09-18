import { useState, useCallback, useEffect } from 'react';
import {
  View, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/ui/StyledText';
import { useVendrAlert } from '../../components/ui/VendrAlert';
import { apiFetch } from '../../lib/api';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface JobDetail {
  id: string;
  order_id: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  delivery_fee: number;
  distance_km: number;
  estimated_time: string;
  seller_name: string;
  seller_avatar?: string;
  seller_phone?: string;
  items_count: number;
  items: Array<{ name: string; quantity: number; image?: string }>;
  special_instructions?: string;
  created_at: string;
  expires_at: string;
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showAlert, alertElement } = useVendrAlert();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  const fetchJob = useCallback(async () => {
    try {
      // TODO: Replace with actual API call
      // const res = await apiFetch(`/runner/jobs/${id}`, { method: 'GET' });
      // setJob(res.data);
      
      // Mock data
      setJob({
        id: id as string,
        order_id: 'ORD-1234567890',
        pickup_address: '12 Adetokunbo Ademola Street, Victoria Island, Lagos',
        dropoff_address: '45 Awolowo Road, Ikoyi, Lagos',
        pickup_lat: 6.4281,
        pickup_lng: 3.4219,
        dropoff_lat: 6.4398,
        dropoff_lng: 3.4064,
        delivery_fee: 2500,
        distance_km: 3.2,
        estimated_time: '15 min',
        seller_name: 'Chike Electronics',
        seller_phone: '+234 802 123 4567',
        items_count: 2,
        items: [
          { name: 'iPhone 13 Pro Case', quantity: 1 },
          { name: 'Screen Protector', quantity: 1 },
        ],
        special_instructions: 'Call when you arrive at pickup',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 15 * 60000).toISOString(),
      });
    } catch (err) {
      showAlert({
        title: 'Error',
        message: 'Failed to load job details',
        type: 'danger',
      });
    } finally {
      setLoading(false);
    }
  }, [id, showAlert]);

  useEffect(() => {
    fetchJob();
  }, []);

  const handleAcceptJob = async () => {
    setAccepting(true);
    try {
      // TODO: Replace with actual API call
      // await apiFetch(`/runner/jobs/${id}/accept`, { method: 'POST' });
      
      showAlert({
        title: 'Job Accepted!',
        message: 'Navigate to pickup location to begin delivery',
        type: 'success',
        buttons: [
          {
            text: 'Go to Active',
            onPress: () => router.replace('/(tabs)/runner-active'),
          },
        ],
      });
    } catch (err) {
      showAlert({
        title: 'Error',
        message: 'Failed to accept job. Please try again.',
        type: 'danger',
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleDeclineJob = () => {
    showAlert({
      title: 'Decline Job',
      message: 'Are you sure you want to decline this delivery?',
      type: 'question',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              // TODO: Replace with actual API call
              // await apiFetch(`/runner/jobs/${id}/decline`, { method: 'POST' });
              router.back();
            } catch (err) {
              showAlert({
                title: 'Error',
                message: 'Failed to decline job',
                type: 'danger',
              });
            }
          },
        },
      ],
    });
  };

  if (loading) {
    return (
      <View className="flex-1 bg-dark items-center justify-center">
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#2D8653" />
      </View>
    );
  }

  if (!job) {
    return (
      <View className="flex-1 bg-dark items-center justify-center px-5">
        <StatusBar style="light" />
        <Ionicons name="alert-circle-outline" size={48} color="#E85555" />
        <Text className="text-cream text-lg mt-4" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
          Job not found
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

  const timeRemaining = Math.max(0, Math.floor((new Date(job.expires_at).getTime() - Date.now()) / 60000));

  return (
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />
      <View className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-green-500 opacity-[0.06]" />

      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-14 pb-4">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-dark-2 border border-faint rounded-xl items-center justify-center">
          <Ionicons name="chevron-back" size={20} color="#FDF6EC" />
        </TouchableOpacity>
        <Text className="text-cream text-lg" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>Job Details</Text>
        <View className="w-10" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Delivery Fee Card */}
        <View className="mx-5 bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-3xl p-5 mb-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-muted text-xs mb-1">Delivery Fee</Text>
              <Text className="text-cream text-3xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
                ₦{job.delivery_fee.toLocaleString()}
              </Text>
            </View>
            <View className="bg-orange/20 px-3 py-1.5 rounded-full">
              <Text className="text-orange text-xs" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
                {timeRemaining} min left
              </Text>
            </View>
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
                <Text className="text-muted text-xs mb-1">PICKUP</Text>
                <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_500Medium' }}>
                  {job.pickup_address}
                </Text>
              </View>
              <View>
                <Text className="text-muted text-xs mb-1">DROPOFF</Text>
                <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_500Medium' }}>
                  {job.dropoff_address}
                </Text>
              </View>
            </View>
          </View>
          <View className="flex-row items-center gap-4 mt-4 pt-4 border-t border-faint">
            <View className="flex-row items-center gap-1">
              <Ionicons name="location-outline" size={14} color="#9A8570" />
              <Text className="text-muted text-xs">{job.distance_km.toFixed(1)} km</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Ionicons name="time-outline" size={14} color="#9A8570" />
              <Text className="text-muted text-xs">{job.estimated_time}</Text>
            </View>
          </View>
        </View>

        {/* Seller Info */}
        <View className="mx-5 bg-dark-2 border border-faint rounded-2xl p-4 mb-4">
          <Text className="text-muted text-xs mb-3">SELLER</Text>
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 bg-orange/20 rounded-full items-center justify-center">
              <Text className="text-orange text-sm" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
                {job.seller_name.charAt(0)}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
                {job.seller_name}
              </Text>
              {job.seller_phone && (
                <Text className="text-muted text-xs">{job.seller_phone}</Text>
              )}
            </View>
            <TouchableOpacity className="w-10 h-10 bg-green-500/20 rounded-full items-center justify-center">
              <Ionicons name="call-outline" size={18} color="#2D8653" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Items */}
        <View className="mx-5 bg-dark-2 border border-faint rounded-2xl p-4 mb-4">
          <Text className="text-muted text-xs mb-3">ITEMS ({job.items_count})</Text>
          {job.items.map((item, index) => (
            <View key={index} className="flex-row items-center justify-between py-2 border-b border-faint last:border-0">
              <Text className="text-cream text-sm">{item.name}</Text>
              <Text className="text-muted text-xs">x{item.quantity}</Text>
            </View>
          ))}
        </View>

        {/* Special Instructions */}
        {job.special_instructions && (
          <View className="mx-5 bg-orange/10 border border-orange/30 rounded-2xl p-4 mb-4">
            <View className="flex-row items-start gap-2">
              <Ionicons name="information-circle-outline" size={16} color="#F5A623" />
              <View className="flex-1">
                <Text className="text-orange text-xs mb-1" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
                  Special Instructions
                </Text>
                <Text className="text-muted text-xs">{job.special_instructions}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View className="absolute bottom-0 left-0 right-0 bg-dark border-t border-faint p-5">
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={handleDeclineJob}
            disabled={accepting}
            className="flex-1 bg-dark-2 border border-faint rounded-2xl py-3.5 items-center"
          >
            <Text className="text-muted text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
              Decline
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleAcceptJob}
            disabled={accepting}
            className="flex-1 bg-green-500 rounded-2xl py-3.5 items-center"
          >
            {accepting ? (
              <ActivityIndicator size="small" color="#1A1208" />
            ) : (
              <Text className="text-dark text-sm" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
                Accept Job
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {alertElement}
    </View>
  );
}
