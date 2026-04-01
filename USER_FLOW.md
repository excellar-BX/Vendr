# Vendr — Complete User Flow

Vendr is a hyperlocal B2C marketplace connecting buyers to local vendors across Nigerian cities, starting with Lagos.

---

## Table of Contents

1. [Onboarding](#1-onboarding)
2. [Home Feed](#2-home-feed)
3. [Search & Discovery](#3-search--discovery)
4. [Vendor Profile](#4-vendor-profile)
5. [Chat & Enquiry](#5-chat--enquiry)
6. [Payments & Wallet](#6-payments--wallet)
7. [Reels](#7-reels)
8. [Buyer Profile](#8-buyer-profile)
9. [Become a Vendor](#9-become-a-vendor)
10. [Vendor — Store Management](#10-vendor--store-management)
11. [Vendor — Receiving Payments](#11-vendor--receiving-payments)
12. [Notifications](#12-notifications)
13. [Settings & Account](#13-settings--account)

---

## 1. Onboarding

### First Launch
- User opens the app and sees the **Welcome screen**
- Two options: **Sign Up** or **Log In**

### Sign Up
1. Enter name, email, and password
2. Account is created as a **Buyer** by default
3. Wallet is automatically created on account creation
4. User is taken to the **Home Feed**

### Log In
1. Enter email and password
2. On success, user is taken to the **Home Feed**
3. Session is persisted — user stays logged in until they sign out

### Auth Rules
- Access token expires every 15 minutes (refreshed silently in background)
- Refresh token valid for 30 days
- On logout, refresh token is invalidated

---

## 2. Home Feed

The home feed is the **Discover** tab — the first screen after login.

### What the user sees
- **Vendor cards** — nearby vendors sorted by distance (requires location permission)
- **Category chips** — filter vendors by category (Food & Drinks, Fashion, Electronics, etc.)
- **Search bar** — tap to go to full search screen
- **Reels preview strip** — horizontally scrollable reel thumbnails

### Location
- App requests location permission on first load
- Distance to each vendor is calculated and shown on cards (e.g. "1.2km away")
- If permission is denied, vendors are shown without distance

### Vendor Card
- Shows vendor logo, banner, business name, category, rating, distance
- Tap → goes to **Vendor Profile**

---

## 3. Search & Discovery

Accessed via the **Search tab** (bottom navigation).

### Before Searching
- User sees **Browse by Category** chips
- After at least one previous search: **Recent Searches** list appears below categories
- Tapping a category immediately runs a search for that category

### Typing a Search
1. User taps the search bar and starts typing
2. A **dropdown appears** immediately with:
   - **Row 1 (always):** The raw search term with a "Search" badge → tapping runs full search
   - **Suggestion rows:** Up to 2 top-ranked products + 1 top-ranked vendor matching the term
   - Each suggestion shows name, price (products) or category + rating (vendors)
3. Tapping a suggestion runs search for that term
4. Tapping the raw query row runs full search
5. **No search fires automatically while typing** — only on explicit tap

### Smart Search
- Filler words are stripped before querying: "near me", "in Lagos", "cheap", "best", "where can I buy", etc.
- Example: "jollof rice near me" → searches for "jollof rice"

### Search Results
- Results split into **Vendors** (grid) and **Products** (list)
- Filter tabs: All / Vendors / Products
- Category chips to narrow by category
- Filters panel: Verified only toggle, minimum rating selector
- **Map FAB** appears when vendor results exist → tapping opens all vendors on a map
- The search bar clears after a search and shows the committed query as placeholder text

### Recent Searches
- Saved to database per user
- Appear on the page after the first successful search
- Individual searches can be deleted
- "Clear all" wipes the full history

---

## 4. Vendor Profile

Accessed by tapping any vendor card from Home or Search.

### What the user sees
- Banner image, logo, business name, category, rating, review count
- Verified badge (if vendor is verified)
- Distance from user
- Description
- **Products tab** — grid of all available products
- **Reels tab** — vendor's reels

### Actions
- **Save vendor** — heart icon, saves to user's saved list
- **Chat** — opens chat with the vendor
- **Enquire on a product** — tap a product → opens chat with pre-filled enquiry message

### Product Card
- Shows image, name, price
- Tapping opens chat with the vendor with a product enquiry pre-loaded

---

## 5. Chat & Enquiry

Accessed from vendor profile, product tap, or the **Chat tab**.

### Starting a Chat
- **From a product:** Tap product → confirm enquiry modal → message sent automatically
- **From vendor profile:** Tap Chat button → empty conversation opens
- **From Chat tab:** Tap any existing conversation

### Chat Features
- Real-time messaging (messages appear instantly for both parties)
- Online/offline indicator for the other party
- Message delivery ticks (sent → delivered → read)
- **Image sharing** — camera or gallery, images sent inline
- **Edit message** — long press on your own message → Edit
- **Delete message** — long press → Delete (removes for both sides, updates conversation preview)
- **Unsend message** — soft delete, shows "Message unsent" placeholder

### Payment Request (Vendor only)
- Vendor sees a **Request Payment** button in the chat header
- Vendor enters amount and optional description → sends a payment request bubble
- Buyer sees the bubble with a **Pay Now** button
- Buyer can pay directly from their Vendr wallet
- Payment request can be cancelled by the vendor if not yet paid

### Chat Tab (Inbox)
- Lists all conversations sorted by latest message
- Shows unread count badge per conversation
- Shows last message preview and timestamp

---

## 6. Payments & Wallet

Accessed via **Profile tab → Wallet**.

### Wallet Screen
- Shows available balance
- Shows dedicated virtual account details (bank name, account number, account name)
- Recent transaction history
- Quick actions: Fund, Withdraw, History

### Fund Wallet
1. Tap **Fund** or **Fund Wallet** section
2. User sees their dedicated Wema Bank virtual account number
3. User copies the account number
4. User opens their bank app and transfers any amount to that account
5. Transfer reflects in the wallet automatically within 1–5 minutes
6. The fund wallet screen polls every 5 seconds and shows a green banner when payment is detected

### Withdraw
1. Tap **Withdraw**
2. Enter amount
3. Select destination bank account (or add one)
4. Confirm withdrawal details
5. Funds sent to bank account (1–5 minutes)
6. If disbursement fails, wallet balance is automatically restored

### Transaction History
Accessed via **Wallet → History** or **Wallet Transactions screen**:
- Full list of credits and debits
- Filterable by type (credit/debit/withdrawal/payment)
- Searchable by description
- Each entry shows type icon, description, amount, status badge, date

### Bank Accounts
- Add multiple bank accounts for withdrawal
- Set a default account
- Bank accounts saved securely per user

---

## 7. Reels

Accessed via the **Reels tab** (bottom navigation).

### Watching Reels
- Full-screen vertical scroll (TikTok-style)
- Auto-plays as user scrolls into view
- Pauses when user switches tabs
- Seek bar at bottom

### Reel Actions
- **Like** — heart icon (tap to toggle)
- **Save** — bookmark icon (tap to toggle, saved to user's collection)
- **View count** — incremented on watch
- Tap vendor name/avatar → goes to vendor profile

### Reel Feed Algorithm
Reels are ranked by:
- Saved vendor content gets priority
- Vendor category matches user's search history
- Vendors the user has chatted with
- Engagement score (likes × 0.3 + saves × 0.5 + views × 0.01)
- Freshness bonus for reels under 48 hours old
- 20% random discovery injection to surface new vendors

### Deep Link
- Sharing a reel opens it at `reel/[reelId]` — full screen single reel view

---

## 8. Buyer Profile

Accessed via the **Profile tab** (bottom navigation).

### Profile Screen
- Avatar, name, email
- Account type badge (Buyer / Vendor)
- Quick links: Orders, Saved Vendors, Reviews, Wallet, Notifications

### Saved Vendors
- List of all vendors the user has saved
- Tap to go to vendor profile
- Unsave by tapping the heart icon

### Orders
- History of all completed payments made through the app

### Reviews
- List of reviews the user has left for vendors
- Star rating + comment

### Edit Profile
- Change name, phone number
- Upload new avatar (goes to R2)

### Appearance
- Light / Dark / System theme toggle

---

## 9. Become a Vendor

Any buyer can apply to become a vendor.

### Flow
1. Profile tab → **Become a Vendor**
2. Multi-step form:
   - **Step 1:** Business name, category, description
   - **Step 2:** Logo upload (optional), banner upload (optional)
   - **Step 3:** Location — enter address or use current location
   - **Step 4:** Review and submit
3. On submit, vendor profile is created
4. User's role updates to `vendor`
5. User is taken to their new **Store dashboard**

### Rules
- A user can only have one vendor account
- Vendor is not verified by default — admin verifies manually
- Verified badge shows on vendor profile and chat

---

## 10. Vendor — Store Management

Accessed via **Profile tab → My Stores** or bottom tab when role is vendor.

### Store Dashboard (`store/[storeId]`)
- Shows store stats: product count, reel count
- Two tabs: **Products** and **Reels**

### Managing Products

**Add Product**
1. Tap the + button in the Products tab
2. Enter name, description, price
3. Upload product image (optional) — goes to R2
4. Save → product appears in store and vendor profile

**Edit Product**
1. Tap a product card → edit modal opens
2. Change name, price, description, image, availability toggle
3. Save changes

**Delete Product**
1. Tap product → delete option in modal
2. Confirm → product removed

**Toggle Availability**
- Switch on product card — marks product as available/unavailable
- Unavailable products are hidden from buyers in search and vendor profile

### Managing Store Info
- Edit business name, description, category
- Upload/change logo and banner
- Update address/location

### Managing Reels
- Reels tab shows all vendor's uploaded reels
- Tap a reel → full screen preview
- Delete reel from store dashboard

---

## 11. Vendor — Receiving Payments

### Payment Request Flow
1. Vendor opens a chat with a buyer
2. Tap **Request** button in chat header
3. Enter amount and description (e.g. "2 units Red Sneakers")
4. Tap **Send Request** → payment request bubble appears in chat
5. Buyer sees **Pay Now** button on the bubble
6. Buyer taps Pay Now → balance checked → payment processed
7. Vendor's wallet is credited instantly
8. Chat shows a confirmation message "Payment of ₦X,XXX sent successfully"

### Vendor Wallet
- Same wallet as the buyer wallet
- Vendors receive payments directly into their Vendr wallet
- Can withdraw to bank at any time

---

## 12. Notifications

Accessed via the bell icon or **Profile → Notifications**.

### Notification Types
- **New message** — someone sent you a chat message
- **Payment received** — buyer paid a payment request
- **New review** — buyer left a review on your store
- **Store saved** — someone saved your vendor store
- **Wallet funded** — transfer received, wallet credited
- **Vendor verified** — admin has verified your store

### Push Notifications
- Enabled by default on signup
- Can be toggled off in Profile → Settings
- Deep links: tapping a message notification opens the specific chat

---

## 13. Settings & Account

### Profile → Settings
- **Edit Profile** — name, phone, avatar
- **Appearance** — theme preference
- **Notifications** — toggle push notifications on/off
- **Bank Accounts** — manage withdrawal accounts
- **Help Center** — FAQs
- **Contact Support** — WhatsApp support link
- **Privacy Policy**
- **Terms of Service**
- **About Vendr**

### Sign Out
- Tap Sign Out in Profile tab
- Session cleared immediately
- App navigates to Login screen

### Delete Account
- Profile tab → Delete Account
- 30-day grace period before permanent deletion
- User is signed out immediately
- Data is permanently deleted after 30 days if not recovered

---

## Summary — Navigation Structure

```
Bottom Tabs:
├── Home (Discover)       — vendor feed, categories, location-based
├── Search                — search, dropdown suggestions, filters, map
├── Reels                 — full-screen video feed, like/save
├── Chat                  — inbox, conversations, payments
└── Profile               — wallet, saved, orders, settings, store
```

---

*Vendr — Find vendors near you. Pay. Done.*
