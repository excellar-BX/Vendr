# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a monorepo containing three distinct projects:

1. **vendr** - React Native/Expo mobile application (buyer-facing)
2. **vendr-backend** - Node.js/Fastify REST API backend
3. **waitlist** - Static HTML email templates (verification, password reset)

---

## Mobile App (vendr/)

### Tech Stack
- Expo SDK 55, React Native 0.83, React 19
- Expo Router (file-based routing)
- TypeScript
- NativeWind (Tailwind CSS for React Native)
- Zustand (state management)
- Supabase (database, auth)
- Paystack/Monnify (payments)
- React Native Maps, Reanimated, Worklets

### Common Commands

```bash
# Navigate to mobile directory
cd vendr

# Start Expo development server
npm start

# Run on specific platform
npm run android   # Android emulator/device
npm run ios       # iOS simulator
npm run web       # Web browser

# Install dependencies
npm install

# Type checking
npx tsc --noEmit
```

### Architecture

**Navigation**: Expo Router with file-based routing in `app/`:
- `app/(auth)/` - Authentication screens (welcome, login, register, verify-email, forgot-password)
- `app/(tabs)/` - Main app tabs (home, search, reels, chat, profile)
- `app/vendor/` - Vendor profile and onboarding
- `app/product/` - Product details
- `app/chat/` - Chat rooms
- `app/order/` - Order tracking and confirmation
- `app/settings/` - User settings

**State Management**: Zustand stores in `stores/`:
- `authStore.ts` - Session and user state
- `locationStore.ts` - User coordinates
- `vendorStore.ts` - Nearby vendors cache
- `chatStore.ts` - Active conversations

**Key Utilities**:
- `lib/supabase.ts` - Supabase client configuration
- `lib/paystack.ts` - Payment helpers
- `lib/location.ts` - Geolocation and reverse geocoding
- `lib/utils.ts` - Formatting utilities

**Styling**: NativeWind with Tailwind classes (`tailwind.config.js`) and brand colors (`constants/colors.ts`)

**Configuration**:
- `app.json` - Expo app configuration (bundle IDs, permissions, plugins)
- `eas.json` - EAS build profiles (development, preview, production)
- `babel.config.js`, `metro.config.js` - Build configuration

### Environment Variables

Copy `.env.example` to `.env` with required values. Key variables:
- `EXPO_PUBLIC_API_BASE_URL` - Backend API URL
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY`
- `EXPO_PUBLIC_MONNIFY_*` - Monnify payment config
- `EXPO_PUBLIC_CF_*` - Cloudflare R2 storage config
- `EXPO_PUBLIC_SENTRY_DSN`

### Important Notes
- Expo Router uses file-based routing - screen components in `app/`
- NativeWind requires `nativewind-env.d.ts` for TypeScript support
- `structure.md` contains detailed file structure documentation
- Google services file (`google-services.json`) is present for FCM
- Sentry error tracking configured via plugin

---

## Backend (vendr-backend/)

### Tech Stack
- Node.js with Fastify
- TypeScript
- Prisma ORM (PostgreSQL on Neon)
- JWT authentication
- Google OAuth (google-auth-library)
- Resend (email)
- Zod (validation)

### Common Commands

```bash
# Navigate to backend directory
cd vendr-backend

# Development with hot reload
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start

# Prisma commands (from backend directory)
npx prisma generate   # Generate client from schema
npx prisma studio     # Open Prisma Studio GUI
npx prisma migrate dev  # Create and apply migration
npx prisma db push    # Sync schema without migrations

# Database seed (if exists)
npx prisma db seed
```

### Architecture

**Entry Point**: `src/app.ts` - Loads env, validates config, builds server

**Server Setup**: `src/server.ts` - Fastify configuration with CORS and route registration

**Routing**: Routes organized in `src/services/[domain]/`:
- Each domain has: `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.schema.ts`
- Current: Auth service at `src/services/auth/`
- Routes prefixed with `/api`

**Middleware**: `src/middlewares/authenticate.ts` - JWT authentication guard

**Configuration**: `src/config/env.ts` - Environment variable validation and defaults

**Database**: `src/lib/prisma.ts` - Prisma client singleton
- Schema: `prisma/schema.prisma`
- Models: User, Vendor, Product, RefreshToken, EmailVerificationToken, PasswordResetToken

**Generated Client**: `src/generated/prisma/` - Auto-generated Prisma client (custom output path)

### Environment Variables

Required in `.env`:
- `DATABASE_URL` - Neon PostgreSQL connection
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
- `GOOGLE_CLIENT_ID` - Google OAuth
- `PORT`, `NODE_ENV`

Payment and Storage:
- `MONNIFY_API_KEY`, `MONNIFY_SECRET_KEY`, `MONNIFY_CONTRACT_CODE`, `MONNIFY_BASE_URL`, `MONNIFY_WALLET_ACCOUNT`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`

Notifications:
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

Email:
- `RESEND_API_KEY`, `FROM_EMAIL`

### Important Notes
- Prisma client configured to output to `src/generated/prisma/` (non-standard)
- Fastify with CORS enabled for all origins (development-friendly)
- Health check endpoint at `/health`
- All auth routes under `/api` prefix (e.g., `/api/auth/login`)
- Uses `ts-node-dev` for development with transpile-only mode
- Zod schemas used for request validation

---

## Waitlist (Static HTML)

Static email templates:
- `index.html` - Waitlist landing page
- `verify-email.html` - Email verification page
- `reset-password.html` - Password reset page
- `sitemap.xml` - SEO sitemap
- `vendr-logo.png` - Brand logo

No build process - deploy as static files.

---

## Cross-Project Notes

### Database Integration
- Backend uses Prisma with PostgreSQL (Neon)
- Mobile app uses Supabase for direct database queries and real-time features
- Likely Supabase PostgREST/Functions integration with custom backend

### Authentication Flow
1. Mobile app: Supabase auth for email/password, Google OAuth
2. Backend: JWT-based for API auth, refresh tokens stored in DB
3. Google OAuth implemented on backend side as well (google-auth-library)
4. Email verification and password reset tokens managed via Prisma

### File Storage
- Cloudflare R2 for media (product images, vendor logos, chat attachments)
- Public URL: `EXPO_PUBLIC_CF_PUBLIC_URL` / `R2_PUBLIC_URL`

### Payments
- Paystack (frontend SDK)
- Monnify (backend integration for wallet funding)

### Notifications
- Firebase Cloud Messaging for push notifications
- Expo notifications module configured

### Error Tracking
- Sentry integrated in mobile app
- Backend uses Fastify's built-in logging

### Development Workflow
1. Start backend: `vendr-backend npm run dev` (port 3000)
2. Start mobile: `vendr npm start` (Expo dev server)
3. Configure mobile `.env` to point to local backend (`EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api`)
4. For physical device testing, use machine's LAN IP instead of localhost

---

## TypeScript Configuration

**Mobile (`vendr/tsconfig.json`)**:
- Standard Expo/React Native config
- JSX support, strict mode

**Backend (`vendr-backend/tsconfig.json`)**:
- Target ES2020, CommonJS
- Strict mode with declaration maps
- Output to `dist/`

---

## Code Quality

No formal linting/testing setup detected:
- No ESLint configs in repo (only in node_modules)
- No Jest/Vitest configuration
- No test files in src directories
- No CI/CD workflows (.github/ absent)

Prettier likely used (prettier-plugin-tailwindcss in mobile devDependencies).

---

## Deployment Notes

**Mobile**:
- EAS Build configured (`eas.json`)
- Development, preview, and production profiles
- Android APK for development, distribution for preview/prod
- Platforms: iOS, Android

**Backend**:
- Built with `npm run build` → `dist/app.js`
- Start with `node dist/app.js`
- Deploy to any Node.js host (Railway, Render, Fly.io, etc.)
- Ensure PostgreSQL (Neon) and env vars configured

**Static Assets**:
- Waitlist HTML can be deployed to any static host (Vercel, Netlify, Cloudflare Pages, S3)

---

## Key Files to Know

### Mobile
- `app/_layout.tsx` - Root layout, auth guard, providers
- `app/(auth)/welcome.tsx` - Onboarding carousel
- `app/(tabs)/index.tsx` - Home feed
- `stores/authStore.ts` - Authentication state
- `lib/supabase.ts` - Database client
- `components/ui/` - Reusable UI components

### Backend
- `src/app.ts` - Entry point
- `src/server.ts` - Fastify setup
- `src/services/auth/auth.*` - Complete auth implementation
- `src/middlewares/authenticate.ts` - Auth middleware
- `prisma/schema.prisma` - Database schema
- `src/config/env.ts` - Config validation

---

## Environment Setup Checklist

### Backend
- [ ] Copy `.env` with all required variables (DATABASE_URL, JWT secrets, etc.)
- [ ] Run `npx prisma generate`
- [ ] Run `npx prisma migrate dev` to create DB tables
- [ ] Start with `npm run dev`

### Mobile
- [ ] Copy `.env` from `.env.example` and update all EXPO_PUBLIC_* values
- [ ] Ensure backend is running and accessible
- [ ] Run `npm install` then `npm start`
- [ ] For emulator: use `EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api`
- [ ] For physical device: use LAN IP (e.g., `http://192.168.x.x:3000/api`)

---

## Migration and Database Changes

1. Update `vendr-backend/prisma/schema.prisma`
2. Run `npx prisma migrate dev --name descriptive_name`
3. Generated Prisma client updates automatically
4. Commit both `schema.prisma` and migration files in `prisma/migrations/`

---

## When Working on This Codebase

- **Two separate runtimes**: mobile runs in Expo/React Native, backend runs Node.js
- **Database split**: Supabase for mobile direct access, Prisma for backend
- **Port conventions**: Backend uses 3000 by default
- **No tests yet**: Focus on functionality; testing infrastructure would need to be added
- **TypeScript everywhere**: Respect types; avoid `any`
- **Env vars**: Mobile uses `EXPO_PUBLIC_*` prefix to expose to runtime
- **No build step for mobile** (babel/metro transpilation handled by Expo)
