vendr/
│
├── app/                          # All screens (Expo Router)
│   ├── _layout.tsx               # ✅ Root layout + auth guard
│   ├── (auth)/                   # Auth screens
│   │   ├── _layout.tsx           # ✅ Auth stack layout
│   │   ├── welcome.tsx           # ✅ Onboarding carousel
│   │   ├── login.tsx             # ✅ Login screen
│   │   ├── register.tsx          # ✅ Register screen
│   │   ├── verify-email.tsx      # ✅ Email verification
│   │   └── forgot-password.tsx   # ✅ Password reset
│   │
│   ├── (tabs)/                   # Main app tabs
│   │   ├── _layout.tsx           # 🔲 Tab bar (Home, Search, Reels, Chat, Profile)
│   │   ├── index.tsx             # 🔲 Home — proximity vendor feed
│   │   ├── search.tsx            # 🔲 Search — find by category/keyword
│   │   ├── reels.tsx             # 🔲 Reels — vendor video feed
│   │   ├── chat.tsx              # 🔲 Chat — conversations list
│   │   └── profile.tsx           # 🔲 Profile — buyer profile + settings
│   │
│   ├── vendor/
│   │   ├── [id].tsx              # 🔲 Vendor public profile
│   │   └── onboarding.tsx        # 🔲 Become a vendor flow
│   │
│   ├── product/
│   │   └── [id].tsx              # 🔲 Product detail screen
│   │
│   ├── chat/
│   │   └── [id].tsx              # 🔲 Individual chat room
│   │
│   ├── order/
│   │   ├── [id].tsx              # 🔲 Order detail / tracking
│   │   └── confirm.tsx           # 🔲 Payment confirmation
│   │
│   └── settings/
│       ├── index.tsx             # 🔲 Settings screen
│       └── edit-profile.tsx      # 🔲 Edit profile
│
├── components/                   # Reusable components
│   ├── SplashScreenView.tsx      # ✅ Animated splash
│   ├── ui/
│   │   ├── Button.tsx            # 🔲 Primary / ghost / outline variants
│   │   ├── Input.tsx             # 🔲 Text input with label + error
│   │   ├── Badge.tsx             # 🔲 Verified badge, category chips
│   │   ├── Avatar.tsx            # 🔲 User / vendor avatar
│   │   └── BottomSheet.tsx       # 🔲 Reusable bottom sheet
│   ├── vendor/
│   │   ├── VendorCard.tsx        # 🔲 Card shown in feed
│   │   ├── VendorRow.tsx         # 🔲 Compact row for search results
│   │   └── ReviewCard.tsx        # 🔲 Review item
│   ├── product/
│   │   ├── ProductCard.tsx       # 🔲 Product grid card
│   │   └── ProductSheet.tsx      # 🔲 Bottom sheet product detail
│   ├── feed/
│   │   ├── CategoryFilter.tsx    # 🔲 Horizontal scroll category chips
│   │   └── NearYouHeader.tsx     # 🔲 Location header for feed
│   └── chat/
│       ├── MessageBubble.tsx     # 🔲 Chat message bubble
│       └── ChatListItem.tsx      # 🔲 Chat preview row
│
├── lib/                          # Core utilities
│   ├── paystack.ts               # 🔲 Paystack helpers
│   ├── location.ts               # 🔲 Get coords + reverse geocode
│   └── utils.ts                  # 🔲 Format price, distance, date
│
├── stores/                       # Zustand global state
│   ├── authStore.ts              # ✅ Session + user
│   ├── locationStore.ts          # 🔲 User's current coordinates
│   ├── vendorStore.ts            # 🔲 Nearby vendors cache
│   └── chatStore.ts              # 🔲 Active conversations
│
├── hooks/                        # Custom hooks
│   ├── useLocation.ts            # 🔲 Request + watch location
│   ├── useVendors.ts             # 🔲 Fetch nearby vendors
│   ├── useChat.ts                # 🔲 Realtime chat subscription
│   └── useAuth.ts                # 🔲 Auth state helper
│
├── types/                        # TypeScript types
│   └── index.ts                  # 🔲 Vendor, Product, Order, Message...
│
├── constants/
│   └── colors.ts                 # ✅ Brand color palette
│
├── assets/                       # Images, icons, fonts
│   ├── icon.png
│   └── splash.png
│
├── global.css                    # ✅ NativeWind entry
├── tailwind.config.js            # ✅ Tailwind + brand colors
├── babel.config.js               # ✅ NativeWind babel
├── metro.config.js               # ✅ NativeWind metro
├── nativewind-env.d.ts           # ✅ ClassName types
├── app.json                      # ✅ Expo config
├── package.json                  # ✅ SDK 55 dependencies
└── MILESTONES.md                 # ✅ Build tracker