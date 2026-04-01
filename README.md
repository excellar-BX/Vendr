# Vendr 🛒

A modern mobile marketplace application built with React Native and Fastify, connecting local vendors with customers in Nigeria.

## 📱 Overview

Vendr is a comprehensive marketplace platform that enables local businesses to showcase their products through short-form video content (reels) and manage their online presence. Customers can discover vendors, browse products, and make purchases through an intuitive mobile interface.

## 🚀 Features

### For Customers
- **Vendor Discovery**: Browse local vendors by category and location
- **Product Catalog**: View detailed product information and pricing
- **Video Reels**: Engaging short-form content showcasing products
- **Chat System**: Direct communication with vendors
- **Order Management**: Track orders and purchase history
- **Reviews & Ratings**: Share feedback on vendor experiences

### For Vendors
- **Store Management**: Complete vendor dashboard for business operations
- **Product Management**: Add, edit, and remove products
- **Video Content**: Create and manage promotional reels
- **Customer Chat**: Real-time communication with buyers
- **Order Processing**: Manage incoming orders and fulfillment
- **Analytics**: Track sales, reviews, and customer engagement

## 🏗️ Architecture

### Frontend (React Native)
- **Framework**: Expo with React Native
- **Navigation**: Expo Router
- **State Management**: Zustand
- **UI Components**: Custom component library with Tailwind CSS
- **Authentication**: JWT-based auth with refresh tokens
- **Real-time**: WebSocket integration for chat and notifications

### Backend (Fastify)
- **Framework**: Fastify with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with refresh token rotation
- **File Storage**: AWS S3 for images and videos
- **Email Service**: Nodemailer with SMTP
- **Real-time**: WebSocket support for chat

### Infrastructure
- **Frontend Hosting**: Expo Development Build
- **Backend Hosting**: Render
- **Database**: Neon PostgreSQL
- **File Storage**: AWS S3
- **Email**: SMTP service

## 📁 Project Structure

```
vendr/
├── vendr/                          # React Native mobile app
│   ├── app/                        # Expo Router screens
│   ├── components/                 # Reusable UI components
│   ├── lib/                        # Utilities and API client
│   ├── stores/                     # Zustand state management
│   └── assets/                     # Images and fonts
├── vendr-backend/                  # Fastify API server
│   ├── src/
│   │   ├── routes/                 # API endpoints
│   │   ├── middleware/             # Auth and validation
│   │   ├── lib/                    # Utilities and services
│   │   └── server.ts               # Server entry point
│   ├── prisma/                     # Database schema and migrations
│   └── .env                        # Environment variables
├── waitlist/                       # Landing page for early access and Web fallback pages
```

## 🛠️ Tech Stack

### Mobile App
- **React Native** with Expo
- **TypeScript** for type safety
- **Expo Router** for navigation
- **Zustand** for state management
- **Tailwind CSS** for styling
- **React Native Webview** for map integration
- **Expo Image Picker** for media handling

### Backend API
- **Fastify** web framework
- **TypeScript** for type safety
- **Prisma** ORM with PostgreSQL
- **JWT** for authentication
- **bcryptjs** for password hashing
- **AWS SDK** for file storage
- **Nodemailer** for email services

### Database
- **PostgreSQL** (Neon hosting)
- **Prisma** for schema management
- **Migrations** for version control

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- npm or yarn
- Expo CLI
- PostgreSQL database
- AWS S3 bucket (for production)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/vendr.git
   cd vendr
   ```

2. **Install dependencies**
   ```bash
   # Backend
   cd vendr-backend
   npm install
   
   # Frontend
   cd ../vendr
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Backend environment
   cd vendr-backend
   cp .env.example .env
   # Edit .env with your database and service credentials
   
   # Database setup
   npx prisma migrate dev
   npx prisma generate
   ```

4. **Start Development Servers**
   ```bash
   # Backend (port 3000)
   cd vendr-backend
   npm run dev
   
   # Frontend (Expo)
   cd ../vendr
   npx expo start
   ```

## 🔧 Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL="postgresql://..."

# JWT
JWT_SECRET="your-jwt-secret"
JWT_REFRESH_SECRET="your-refresh-secret"

# AWS S3
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="..."
AWS_S3_BUCKET="..."

# Email
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Frontend URL
FRONTEND_URL="http://localhost:19006"
```

## 📱 Mobile App Setup

### Development Build
```bash
# Install Expo CLI
npm install -g @expo/cli

# Start development server
npx expo start

# Run on device
npx expo run:android    # Android
npx expo run:ios        # iOS
```

### Production Build
```bash
# Build for production
npx expo build:android
npx expo build:ios
```

## 🗄️ Database Schema

The application uses PostgreSQL with the following main entities:
- **Users**: Customer and vendor accounts
- **Vendors**: Business profiles and information
- **Products**: Vendor product listings
- **Orders**: Purchase transactions
- **Conversations**: Chat between buyers and vendors
- **Reels**: Short-form video content
- **Reviews**: Customer feedback

See `vendr-backend/prisma/schema.prisma` for complete schema.

## 🔐 Authentication

The app uses JWT-based authentication with:
- Access tokens (15 minutes)
- Refresh tokens (7 days)
- Automatic token rotation
- Secure storage in AsyncStorage

## 📧 API Documentation

### Authentication Endpoints
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Token refresh
- `POST /auth/logout` - User logout

### Vendor Endpoints
- `GET /vendors` - List nearby vendors
- `GET /vendors/:id` - Get vendor details
- `POST /vendors` - Create vendor profile

### Product Endpoints
- `GET /vendors/:id/products` - List vendor products
- `POST /products` - Create product
- `PUT /products/:id` - Update product
- `DELETE /products/:id` - Delete product

## 🚀 Deployment

### Backend (Render)
1. Connect repository to Render
2. Set environment variables
3. Configure PostgreSQL database
4. Deploy with automatic builds

### Mobile App (Expo)
1. Configure app.json with production settings
2. Build with Expo Application Services (EAS)
3. Submit to app stores

### Database (Neon)
1. Create Neon PostgreSQL database
2. Set connection string in environment
3. Run migrations with `npx prisma migrate deploy`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and inquiries:
- Email: support@vendr.ng
- WhatsApp: +234 800 000 0000
- GitHub Issues: [Create an issue](https://github.com/yourusername/vendr/issues)

## 🌟 Acknowledgments

- Built with [Expo](https://expo.dev/)
- Backend powered by [Fastify](https://fastify.dev/)
- Database by [Prisma](https://prisma.io/)
- Hosted on [Render](https://render.com/)

---

**Vendr** - Connecting local businesses with customers, one reel at a time. 🛒📱
