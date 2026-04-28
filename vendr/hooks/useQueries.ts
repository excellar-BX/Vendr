import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { Vendor, Product } from '../types';

// ─── Vendors ───────────────────────────────────────────────────────────────

export function useVendors(lat?: number | null, lng?: number | null) {
  return useQuery({
    queryKey: ['vendors', lat, lng],
    queryFn: async () => {
      const response = await apiFetch('/vendors', { method: 'GET' });
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: true,
  });
}

export function useVendor(id: string) {
  return useQuery({
    queryKey: ['vendor', id],
    queryFn: async () => {
      const response = await apiFetch(`/vendors/${id}`);
      return response.data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - vendor data changes less frequently
    enabled: !!id,
  });
}

export function useVendorProducts(vendorId: string) {
  return useQuery({
    queryKey: ['vendor-products', vendorId],
    queryFn: async () => {
      const response = await apiFetch(`/products?vendor_id=${vendorId}`);
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!vendorId,
  });
}

export function useVendorReels(vendorId: string) {
  return useQuery({
    queryKey: ['vendor-reels', vendorId],
    queryFn: async () => {
      const response = await apiFetch(`/reels?vendor_id=${vendorId}`);
      return response.data;
    },
    staleTime: 1000 * 60 * 3, // 3 minutes - reels change more frequently
    enabled: !!vendorId,
  });
}

export function useVendorReviews(vendorId: string) {
  return useQuery({
    queryKey: ['vendor-reviews', vendorId],
    queryFn: async () => {
      const response = await apiFetch(`/reviews?vendor_id=${vendorId}`);
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!vendorId,
  });
}

// ─── Saved Vendors ───────────────────────────────────────────────────────────

export function useIsVendorSaved(vendorId: string, userId?: string) {
  return useQuery({
    queryKey: ['saved-vendor', vendorId, userId],
    queryFn: async () => {
      const response = await apiFetch(`/saved-vendors/${vendorId}/check`);
      return response.data.is_saved;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!vendorId && !!userId,
    retry: false,
  });
}

export function useToggleSaveVendor() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ vendorId, isSaved }: { vendorId: string; isSaved: boolean }) => {
      if (isSaved) {
        await apiFetch(`/saved-vendors/${vendorId}`, { method: 'DELETE' });
      } else {
        await apiFetch('/saved-vendors', {
          method: 'POST',
          body: JSON.stringify({ vendor_id: vendorId }),
        });
      }
    },
    onSuccess: (_, { vendorId }) => {
      // Invalidate saved vendor check
      queryClient.invalidateQueries({ queryKey: ['saved-vendor', vendorId] });
      // Invalidate saved vendors list
      queryClient.invalidateQueries({ queryKey: ['saved-vendors'] });
    },
  });
}

// ─── Wallet ──────────────────────────────────────────────────────────────────

export function useWalletBalance() {
  return useQuery({
    queryKey: ['wallet-balance'],
    queryFn: async () => {
      const response = await apiFetch('/wallet/balance');
      return response.data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes - balance changes frequently
    refetchInterval: 1000 * 60 * 2, // Auto-refetch every 2 minutes
  });
}

export function useVirtualAccount() {
  return useQuery({
    queryKey: ['virtual-account'],
    queryFn: async () => {
      const response = await apiFetch('/wallet/virtual-account');
      return response.data;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes - virtual account rarely changes
    retry: false,
  });
}

export function useWalletTransactions(limit: number = 50) {
  return useQuery({
    queryKey: ['wallet-transactions', limit],
    queryFn: async () => {
      const response = await apiFetch(`/wallet/transactions?limit=${limit}`);
      return response.data;
    },
    staleTime: 1000 * 60 * 1, // 1 minute - transactions change frequently
  });
}

export function useCreateVirtualAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await apiFetch('/wallet/virtual-account', { method: 'POST' });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-account'] });
    },
  });
}

// ─── Search ───────────────────────────────────────────────────────────────────

export function useSearchSuggestions(query: string) {
  return useQuery({
    queryKey: ['search-suggestions', query],
    queryFn: async () => {
      const response = await apiFetch('/search/suggestions', {
        method: 'POST',
        body: JSON.stringify({ q: query, limit: 5 }),
      });
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
    enabled: query.length >= 1,
  });
}

export function useSearchHistory() {
  return useQuery({
    queryKey: ['search-history'],
    queryFn: async () => {
      const response = await apiFetch('/search/history');
      return response.data;
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useSaveSearchHistory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (query: string) => {
      await apiFetch('/search/history', {
        method: 'POST',
        body: JSON.stringify({ query }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-history'] });
    },
  });
}

export function useClearSearchHistory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (query?: string) => {
      if (query) {
        await apiFetch(`/search/history`, {
          method: 'DELETE',
          body: JSON.stringify({ query }),
        });
      } else {
        await apiFetch('/search/history', { method: 'DELETE' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-history'] });
    },
  });
}

// ─── Notifications ────────────────────────────────────────────────────────────

export function useUnreadNotificationsCount() {
  return useQuery({
    queryKey: ['unread-notifications-count'],
    queryFn: async () => {
      const response = await apiFetch('/notifications/unread-count');
      return response.data.count;
    },
    staleTime: 1000 * 60 * 1, // 1 minute - notifications change frequently
    refetchInterval: 1000 * 60 * 1, // Auto-refetch every minute
  });
}

// ─── Reviews ───────────────────────────────────────────────────────────────────

export function useSubmitReview() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ vendorId, rating, comment }: { vendorId: string; rating: number; comment: string }) => {
      const response = await apiFetch('/reviews', {
        method: 'POST',
        body: JSON.stringify({ vendor_id: vendorId, rating, comment }),
      });
      return response.data;
    },
    onSuccess: (_, { vendorId }) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-reviews', vendorId] });
      queryClient.invalidateQueries({ queryKey: ['vendor', vendorId] }); // Update rating on vendor
    },
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (reviewId: string) => {
      await apiFetch(`/reviews/${reviewId}`, { method: 'DELETE' });
    },
    onSuccess: (_, reviewId) => {
      // Need to invalidate all review queries since we don't know the vendorId
      queryClient.invalidateQueries({ queryKey: ['vendor-reviews'] });
    },
  });
}

// ─── My Vendor ───────────────────────────────────────────────────────────────

export function useMyVendor() {
  return useQuery({
    queryKey: ['my-vendor'],
    queryFn: async () => {
      const response = await apiFetch('/vendors/me');
      return response.data;
    },
    staleTime: 1000 * 60 * 10,
  });
}

// ─── Vendor Reports ────────────────────────────────────────────────────────────

export function useHasReportedVendor(vendorId: string, userId?: string) {
  return useQuery({
    queryKey: ['vendor-report', vendorId, userId],
    queryFn: async () => {
      const response = await apiFetch(`/vendor-reports/${vendorId}/check`);
      return response.data.has_reported;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!vendorId && !!userId,
    retry: false,
  });
}

export function useSubmitVendorReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vendorId, reason, description }: { vendorId: string; reason: string; description?: string }) => {
      const response = await apiFetch('/vendor-reports', {
        method: 'POST',
        body: JSON.stringify({ vendor_id: vendorId, reason, description }),
      });
      return response.data;
    },
    onSuccess: (_, { vendorId }) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-report', vendorId] });
    },
  });
}
