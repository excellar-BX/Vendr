export type Category =
  | 'All'
  | 'Food & Drinks'
  | 'Fashion'
  | 'Accessories'
  | 'Beauty & Hair'
  | 'Electronics'
  | 'Groceries';

export interface Vendor {
  id: string;
  user_id: string;
  business_name: string;
  description?: string;
  category: Category | string;
  lat: number;
  lng: number;
  address?: string;
  is_verified: boolean;
  is_active: boolean;
  avatar_url?: string;
  banner_url?: string;
  logo_url?: string;
  rating: number;
  review_count: number;
  created_at: string;
  // computed client-side
  distance?: number;
}

export interface Product {
  id: string;
  vendor_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  buyer_id: string;
  vendor_id: string;
  product_id: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  paystack_ref?: string;
  created_at: string;
}

export interface Message {
  id: string;
  order_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface Profile {
  id: string;
  name?: string;
  phone?: string;
  avatar_url?: string;
  role: 'buyer' | 'vendor';
  created_at: string;
}