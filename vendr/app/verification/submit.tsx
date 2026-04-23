import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Image
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { verificationApi } from '../../lib/api';
import { Text as StyledText } from '../../components/ui/StyledText';
import { apiFetch } from '../../lib/api';
import { useVendrAlert } from '../../components/ui/VendrAlert';
import { useAuthStore } from '../../stores/authStore';

export default function VerificationSubmitScreen() {
  const { vendorId: paramVendorId } = useLocalSearchParams<{ vendorId?: string }>();
  const { user } = useAuthStore();
  
  // Use vendorId from params, fallback to auth store vendor
  const vendorId = paramVendorId || user?.vendor?.id;
  
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [existingStatus, setExistingStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [uploading, setUploading] = useState<{
    cac_certificate?: boolean;
    nin_card?: boolean;
    proof_of_address?: boolean;
  }>({});
  const { alert, alertElement } = useVendrAlert();
  const [formData, setFormData] = useState({
    cac_number: '',
    nin_number: '',
    business_address: '',
  });
  const [documents, setDocuments] = useState<{
    cac_certificate?: string;
    nin_card?: string;
    proof_of_address?: string;
  }>({});

  // Check existing verification status on mount
  useEffect(() => {
    const checkStatus = async () => {
      if (!vendorId) {
        setCheckingStatus(false);
        return;
      }

      try {
        const response = await apiFetch(`/verification/status/${vendorId}`, { method: 'GET' });
        const data = response.data;
        
        if (data?.latest_request) {
          setExistingStatus(data.latest_request.status);
          
          if (data.latest_request.status === 'pending') {
            alert(
              'Verification Pending',
              'You already have a verification request in review. Please wait 3-4 business days for approval.',
              [{ text: 'OK', onPress: () => router.back() }],
              { type: 'info' }
            );
          } else if (data.latest_request.status === 'approved') {
            alert(
              'Already Verified',
              'Your business is already verified!',
              [{ text: 'OK', onPress: () => router.back() }],
              { type: 'success' }
            );
          }
        }
      } catch (err) {
        console.error('Failed to check verification status:', err);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkStatus();
  }, [vendorId]);

  const handleUploadDocument = async (docType: 'cac_certificate' | 'nin_card' | 'proof_of_address') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      setUploading(prev => ({ ...prev, [docType]: true }));

      // Get signed upload URL from backend
      const fileName = `verification/${vendorId}_${docType}_${Date.now()}.${file.mimeType?.split('/')[1] || 'pdf'}`;
      const signRes = await apiFetch('/storage/sign', {
        method: 'POST',
        body: JSON.stringify({
          key: fileName,
          contentType: file.mimeType || 'application/pdf',
        }),
      });

      // Upload file to R2 using signed URL
      const uploadRes = await fetch(signRes.data.uploadUrl, {
        method: 'PUT',
        body: file.uri,
        headers: {
          'Content-Type': file.mimeType || 'application/pdf',
        },
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload document');
      }

      // Update documents state with public URL
      setDocuments(prev => ({
        ...prev,
        [docType]: signRes.data.publicUrl,
      }));

      alert('Success', 'Document uploaded successfully', undefined, { type: 'success' });
    } catch (error: any) {
      alert('Error', error.message || 'Failed to upload document', undefined, { type: 'danger' });
    } finally {
      setUploading(prev => ({ ...prev, [docType]: false }));
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.cac_number.trim()) {
      alert('Error', 'Please enter your CAC registration number', undefined, { type: 'warning' });
      return;
    }
    if (!formData.nin_number.trim()) {
      alert('Error', 'Please enter your NIN number', undefined, { type: 'warning' });
      return;
    }
    if (!formData.business_address.trim()) {
      alert('Error', 'Please enter your business address', undefined, { type: 'warning' });
      return;
    }

    try {
      setLoading(true);
      await verificationApi.submitVerification({
        vendor_id: vendorId as string,
        cac_number: formData.cac_number,
        nin_number: formData.nin_number,
        business_address: formData.business_address,
        documents,
      });
      
      alert(
        'Success',
        'Your verification request has been submitted. You will be notified within 3-4 business days.',
        [{ text: 'OK', onPress: () => router.back() }],
        { type: 'success' }
      );
    } catch (error: any) {
      alert('Error', error.message || 'Failed to submit verification request', undefined, { type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
      {alertElement}
      <StatusBar style="light" />

      {checkingStatus ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#E8521A" />
          <StyledText style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#9A8570', marginTop: 16 }}>
            Checking verification status...
          </StyledText>
        </View>
      ) : (
        <>

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: '#1A1208', gap: 12,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <StyledText style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#FDF6EC' }}>
            Get Verified
          </StyledText>
          <StyledText style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50' }}>
            Verify your business to build trust
          </StyledText>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ padding: 20, gap: 24 }}>
          {/* Info Card */}
          <View style={{
            backgroundColor: 'rgba(232,82,26,0.1)', borderWidth: 1,
            borderColor: 'rgba(232,82,26,0.2)', borderRadius: 16, padding: 16, gap: 12,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{
                width: 36, height: 36, borderRadius: 12,
                backgroundColor: 'rgba(232,82,26,0.15)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="information-circle" size={18} color="#E8521A" />
              </View>
              <StyledText style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }}>
                Why get verified?
              </StyledText>
            </View>
            <StyledText style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570', lineHeight: 20 }}>
              Verified vendors receive a badge on their profile, appear higher in search results, and build more trust with buyers.
            </StyledText>
          </View>

          {/* CAC Number */}
          <View style={{ gap: 8 }}>
            <StyledText style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }}>
              CAC Registration Number
            </StyledText>
            <TextInput
              value={formData.cac_number}
              onChangeText={(text) => setFormData({ ...formData, cac_number: text })}
              placeholder="e.g., RC1234567"
              placeholderTextColor="#6B5E50"
              style={{
                backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
                borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
                fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#FDF6EC',
              }}
              autoCapitalize="characters"
            />
          </View>

          {/* NIN Number */}
          <View style={{ gap: 8 }}>
            <StyledText style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }}>
              NIN Number
            </StyledText>
            <TextInput
              value={formData.nin_number}
              onChangeText={(text) => setFormData({ ...formData, nin_number: text })}
              placeholder="e.g., 12345678901"
              placeholderTextColor="#6B5E50"
              keyboardType="number-pad"
              maxLength={11}
              style={{
                backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
                borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
                fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#FDF6EC',
              }}
            />
          </View>

          {/* Business Address */}
          <View style={{ gap: 8 }}>
            <StyledText style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }}>
              Business Address
            </StyledText>
            <TextInput
              value={formData.business_address}
              onChangeText={(text) => setFormData({ ...formData, business_address: text })}
              placeholder="Enter your full business address"
              placeholderTextColor="#6B5E50"
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
                borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
                fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#FDF6EC',
                minHeight: 80,
                textAlignVertical: 'top',
              }}
            />
          </View>

          {/* Documents Section */}
          <View style={{ gap: 16 }}>
            <StyledText style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }}>
              Supporting Documents
            </StyledText>

            {/* CAC Certificate */}
            <View style={{ gap: 8 }}>
              <StyledText style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570' }}>
                CAC Registration Certificate
              </StyledText>
              {documents.cac_certificate ? (
                <View style={{
                  backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2D8653',
                  borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
                }}>
                  <Ionicons name="checkmark-circle" size={20} color="#2D8653" />
                  <StyledText style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#FDF6EC', flex: 1 }}>
                    Document uploaded
                  </StyledText>
                  <TouchableOpacity onPress={() => setDocuments(prev => ({ ...prev, cac_certificate: undefined }))}>
                    <Ionicons name="close-circle" size={20} color="#E8521A" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => handleUploadDocument('cac_certificate')}
                  disabled={uploading.cac_certificate}
                  style={{
                    backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
                    borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
                  }}
                >
                  <Ionicons name="cloud-upload-outline" size={20} color="#E8521A" />
                  <StyledText style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#FDF6EC' }}>
                    {uploading.cac_certificate ? 'Uploading...' : 'Upload CAC Certificate'}
                  </StyledText>
                </TouchableOpacity>
              )}
            </View>

            {/* NIN Card */}
            <View style={{ gap: 8 }}>
              <StyledText style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570' }}>
                NIN Card
              </StyledText>
              {documents.nin_card ? (
                <View style={{
                  backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2D8653',
                  borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
                }}>
                  <Ionicons name="checkmark-circle" size={20} color="#2D8653" />
                  <StyledText style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#FDF6EC', flex: 1 }}>
                    Document uploaded
                  </StyledText>
                  <TouchableOpacity onPress={() => setDocuments(prev => ({ ...prev, nin_card: undefined }))}>
                    <Ionicons name="close-circle" size={20} color="#E8521A" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => handleUploadDocument('nin_card')}
                  disabled={uploading.nin_card}
                  style={{
                    backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
                    borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
                  }}
                >
                  <Ionicons name="cloud-upload-outline" size={20} color="#E8521A" />
                  <StyledText style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#FDF6EC' }}>
                    {uploading.nin_card ? 'Uploading...' : 'Upload NIN Card'}
                  </StyledText>
                </TouchableOpacity>
              )}
            </View>

            {/* Proof of Address */}
            <View style={{ gap: 8 }}>
              <StyledText style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570' }}>
                Proof of Address (Utility Bill, Bank Statement, etc.)
              </StyledText>
              {documents.proof_of_address ? (
                <View style={{
                  backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2D8653',
                  borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
                }}>
                  <Ionicons name="checkmark-circle" size={20} color="#2D8653" />
                  <StyledText style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#FDF6EC', flex: 1 }}>
                    Document uploaded
                  </StyledText>
                  <TouchableOpacity onPress={() => setDocuments(prev => ({ ...prev, proof_of_address: undefined }))}>
                    <Ionicons name="close-circle" size={20} color="#E8521A" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => handleUploadDocument('proof_of_address')}
                  disabled={uploading.proof_of_address}
                  style={{
                    backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
                    borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
                  }}
                >
                  <Ionicons name="cloud-upload-outline" size={20} color="#E8521A" />
                  <StyledText style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#FDF6EC' }}>
                    {uploading.proof_of_address ? 'Uploading...' : 'Upload Proof of Address'}
                  </StyledText>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={{
              backgroundColor: '#E8521A', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 14,
              alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
              marginTop: 8,
            }}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={18} color="white" />
                <StyledText style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, color: 'white' }}>
                  Submit Verification
                </StyledText>
              </>
            )}
          </TouchableOpacity>

          {/* Note */}
          <StyledText style={{
            fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50',
            textAlign: 'center', lineHeight: 18,
          }}>
            Your information will be reviewed within 3-4 business days. You'll receive a notification once your verification is complete.
          </StyledText>
        </View>
      </ScrollView>
        </>
      )}
    </View>
  );
}
