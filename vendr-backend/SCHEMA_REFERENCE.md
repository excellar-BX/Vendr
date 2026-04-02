# Vendr Database Schema (Prisma)

This schema mirrors the original Supabase PostgreSQL schema for the Vendr app.

## Quick Start

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database (development)
npx prisma db push

# Create migration (for production)
npx prisma migrate dev --name <name>
```

## Schema Overview

### User & Auth (`users` table)
Core user profile with authentication flags.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | User ID (matches auth.users in Supabase) |
| email | varchar(255) | Unique email |
| password | varchar(255) | Hashed password (nullable for OAuth) |
| full_name | varchar(255) | Display name |
| avatar_url | text | Profile picture URL |
| phone | text | Phone number |
| google_id | varchar(255) | Google OAuth ID (unique) |
| is_verified | boolean | Email verification status |
| is_buyer | boolean (default: true) | Can buy products |
| is_vendor | boolean (default: false) | Can sell products |
| is_deleted | boolean (default: false) | Soft delete flag |
| deleted_at | timestamp | Deletion date |
| notifications_enabled | boolean (default: true) | Push notifications opt-in |
| location_enabled | boolean (default: true) | Location services opt-in |
| language | varchar(50) (default: "English") | UI language preference |
| font_size | varchar(20) (default: "Normal") | Text size preference |
| push_token | text | FCM/APNs token for push notifications |
| role | varchar(50) (default: "buyer") | Legacy role field |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last update timestamp |

**Relations:** One-to-many to Vendor, Order, Review, SavedVendor, Notification, Transaction, etc.

---

### Vendor (`vendors` table)
Store/business profile.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Vendor ID |
| user_id | uuid (FK→users) | Owner (unique one-to-one) |
| shop_name | varchar(255) | Business name |
| description | text | Business description |
| category | varchar(100) | Business category (e.g., "Food & Drinks") |
| city | varchar(100) | City name |
| address | text | Full address |
| logo_url | text | Store logo (square) |
| banner_url | text | Store banner (16:9) |
| avatar_url | text | Store profile picture (optional) |
| lat | double precision | Latitude |
| lng | double precision | Longitude |
| phone | text | Business phone |
| whatsapp | text | WhatsApp contact |
| instagram | varchar(255) | Instagram handle |
| twitter | varchar(255) | Twitter/X handle |
| open_days | varchar(50)[] | Array of open days (Mon-Sun) |
| open_time | varchar(10) | Opening time (HH:MM) |
| close_time | varchar(10) | Closing time (HH:MM) |
| is_verified | boolean (default: false) | Admin verification status |
| is_active | boolean (default: true) | Store active flag |
| rating | double precision (default: 0) | Average rating from reviews |
| review_count | integer (default: 0) | Total review count |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last update timestamp |

**Relations:** Belongs to User; has many Products, Orders, Reviews, Reels; can be saved by many Users.

---

### Product (`products` table)
Products listed by vendors.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Product ID |
| vendor_id | uuid (FK→vendors) | Vendor owner |
| name | varchar(255) | Product name |
| description | text | Product description |
| price | double precision | Price in NGN |
| image_url | text | Product image URL |
| is_available | boolean (default: true) | In stock flag |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last update timestamp |

---

### Order (`orders` table)
Purchase transactions.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Order ID |
| buyer_id | uuid (FK→users) | Buyer user ID |
| vendor_id | uuid (FK→vendors) | Vendor store ID |
| vendor_user_id | uuid (FK→users) | Denormalized vendor user ID (for quick access) |
| payment_request_id | uuid (FK→payment_requests) | Optional payment request link |
| conversation_id | uuid (FK→conversations) | Optional chat conversation |
| amount | double precision | Order total |
| description | text | Order description |
| status | varchar(20) | completed, refunded, disputed |
| created_at | timestamp | Order timestamp |

---

### Review (`reviews` table)
User reviews for vendors.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Review ID |
| vendor_id | uuid (FK→vendors) | Reviewed vendor |
| user_id | uuid (FK→users) | Reviewing user |
| rating | integer (1-5) | Star rating |
| comment | text | Review text |
| created_at | timestamp | Review timestamp |

**Unique:** One review per user per vendor.

---

### Saved Vendor (`saved_vendors` table)
Bookmarked vendors per user.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Save ID |
| user_id | uuid (FK→users) | User who saved |
| vendor_id | uuid (FK→vendors) | Saved vendor |
| created_at | timestamp | When saved |

**Unique:** User + Vendor combination.

---

### Conversation (`conversations` table)
Chat threads between buyer and vendor.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Conversation ID |
| buyer_id | uuid (FK→users) | Buyer participant |
| vendor_id | uuid (FK→vendors) | Vendor participant |
| last_message | text | Most recent message preview |
| last_message_at | timestamp | When last message sent |
| buyer_unread | integer (default: 0) | Unread count for buyer |
| vendor_unread | integer (default: 0) | Unread count for vendor |
| created_at | timestamp | Conversation creation |

**Unique:** One conversation per buyer-vendor pair.

---

### Message (`messages` table)
Individual chat messages.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Message ID |
| conversation_id | uuid (FK→conversations) | Parent conversation |
| sender_id | uuid (FK→users) | Message sender |
| content | text | Message text or payment request ID |
| image_url | text | Optional attached image |
| type | varchar(20) | text, image, payment_request, system |
| is_read | boolean | Read status |
| delivered | boolean | Delivery status |
| edited | boolean | Edit flag |
| created_at | timestamp | Send timestamp |

---

### Reel (`reels` table)
Short-form video content.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Reel ID |
| vendor_id | uuid (FK→vendors) | Vendor owner |
| user_id | uuid (FK→users) | Poster (usually vendor) |
| video_url | text | Video file URL |
| thumbnail_url | text | Thumbnail image URL |
| caption | text | Reel caption |
| product_id | uuid (FK→products) | Optional linked product |
| view_count | integer (default: 0) | Total views |
| like_count | integer (default: 0) | Total likes |
| save_count | integer (default: 0) | Total saves |
| is_active | boolean (default: true) | Visibility flag |
| created_at | timestamp | Upload timestamp |

---

### Reel Like (`reel_likes` table)
User likes on reels.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Like ID |
| reel_id | uuid (FK→reels) | Liked reel |
| user_id | uuid (FK→users) | Liking user |
| created_at | timestamp | When liked |

**Unique:** One like per user per reel.

---

### Reel Save (`reel_saves` table)
User saves of reels.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Save ID |
| reel_id | uuid (FK→reels) | Saved reel |
| user_id | uuid (FK→users) | Saving user |
| created_at | timestamp | When saved |

**Unique:** One save per user per reel.

---

### Notification (`notifications` table)
Push/in-app notifications.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Notification ID |
| user_id | uuid (FK→users) | Recipient |
| type | varchar(50) | Notification type (order, chat, etc.) |
| title | varchar(255) | Notification title |
| body | text | Notification body |
| is_read | boolean (default: false) | Read status |
| data | jsonb (default: {}) | Additional payload (order_id, etc.) |
| created_at | timestamp | When sent |

---

### Search History (`search_history` table)
User search query history.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Search ID |
| user_id | uuid (FK→users) | Searching user |
| query | varchar(255) | Search query text |
| created_at | timestamp | When searched |

---

### User Presence (`user_presence` table)
Online status tracking.

| Field | Type | Description |
|-------|------|-------------|
| user_id | uuid (PK, FK→users) | User ID |
| is_online | boolean (default: false) | Online status |
| last_seen | timestamp | Last activity timestamp |

---

### Waitlist (`waitlist` table)
Early access signups.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Waitlist ID |
| name | varchar(255) | Optional name |
| email | varchar(255) | Email (unique) |
| type | varchar(50) | Interest category (buyer/vendor) |
| created_at | timestamp | Signup timestamp |

---

### Wallet (`wallets` table)
User balance accounts.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Wallet ID |
| user_id | uuid (FK→users, unique) | Wallet owner |
| available_balance | double precision (default: 0) | Withdrawable balance |
| frozen_balance | double precision (default: 0) | Held/pending balance |
| currency | varchar(10) (default: "NGN") | Currency code |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last updated |

---

### Transaction (`transactions` table)
Financial transaction ledger.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Transaction ID |
| user_id | uuid (FK→users) | Account holder |
| type | varchar(20) | credit, debit, withdrawal, payment_sent, payment_received, refund |
| amount | double precision | Transaction amount |
| status | varchar(20) | pending, success, failed |
| reference | varchar(255) (unique) | Provider reference (Monnify/Stripe) |
| description | text | Transaction description |
| counterparty_id | uuid (FK→users) | Other party (for transfers) |
| metadata | jsonb (default: {}) | Additional provider data |
| created_at | timestamp | Transaction timestamp |
| provider | varchar(50) (default: "monnify") | Payment provider |

---

### Payment Request (`payment_requests` table)
Payment initiation for orders.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Payment request ID |
| vendor_id | uuid (FK→vendors) | Vendor requesting payment |
| buyer_id | uuid (FK→users) | Payer |
| conversation_id | uuid (FK→conversations) | Related chat |
| amount | double precision | Amount requested |
| description | text | Payment description |
| status | varchar(20) | pending, paid, cancelled, expired |
| paid_at | timestamp | When payment completed |
| created_at | timestamp | Request creation |
| vendor_user_id | uuid (FK→users) | Denormalized vendor user ID |

---

### Bank Account (`bank_accounts` table)
User's bank accounts for withdrawals.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Bank account ID |
| user_id | uuid (FK→users) | Account owner |
| account_number | varchar(50) | Bank account number |
| account_name | varchar(255) | Account holder name |
| bank_name | varchar(100) | Bank name |
| bank_code | varchar(20) | Bank sort code |
| recipient_code | varchar(100) | Monnify recipient code |
| is_default | boolean (default: false) | Primary withdrawal account |
| created_at | timestamp | Addition timestamp |

---

### Virtual Account (`virtual_accounts` table)
Monnify virtual accounts (provider-managed).

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Virtual account ID |
| user_id | uuid (FK→users, unique) | Account owner |
| account_number | varchar(50) | Virtual account number |
| account_name | varchar(255) | Account holder name |
| bank_name | varchar(100) | Bank (e.g., "Monnify") |
| provider_reference | varchar(255) | Provider's reference ID |
| created_at | timestamp | Creation timestamp |
| provider | varchar(50) (default: "monnify") | Provider name |
| reference | varchar(255) (unique) | Internal reference |

---

### Refresh Token (`refresh_tokens` table)
JWT refresh tokens.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Token ID |
| token | varchar(255) (unique) | Refresh token value |
| user_id | uuid (FK→users) | Owner |
| expires_at | timestamp | Expiration date |
| created_at | timestamp | Creation timestamp |

---

### Email Verification Token (`email_verification_tokens` table)
Email verification tokens.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Token ID |
| token | varchar(255) (unique) | Verification token |
| user_id | uuid (FK→users) | User to verify |
| expires_at | timestamp | Expiration (24h) |
| created_at | timestamp | Creation timestamp |

---

### Password Reset Token (`password_reset_tokens` table)
Password reset tokens.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Token ID |
| token | varchar(255) (unique) | Reset token |
| user_id | uuid (FK→users) | User requesting reset |
| expires_at | timestamp | Expiration (1h) |
| used | boolean (default: false) | Single-use flag |
| created_at | timestamp | Creation timestamp |

---

## Table Mapping (`@@map`)

All models use `@@map("table_name")` to match existing Supabase table names. This ensures compatibility if you're migrating data.

## Indexes & Constraints

- **Unique constraints:** Enforce business rules (one vendor per user, one review per user+vendor, etc.)
- **Foreign keys:** Cascading deletes where appropriate
- **Default values:** Sensible defaults for booleans, timestamps, arrays

## Data Types

- `String` maps to `varchar(255)` unless overridden
- `DateTime` maps to `timestamp with time zone`
- `Json` maps to `jsonb`
- `String[]` maps to `varchar(50)[]` (arrays)

## Next Steps

1. Run `npx prisma generate` to generate client
2. Run `npx prisma db push` to create tables in Neon DB
3. Build backend services for each model
4. Replace Supabase calls in mobile app with `apiFetch` to your backend endpoints

See `SCHEMA_MIGRATION_PLAN.md` for phased migration strategy.
