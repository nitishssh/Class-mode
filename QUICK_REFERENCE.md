# PersonalLearningPro (EduAI) - Quick Reference Card

## 🚀 Quick Start

### Web App
```bash
npm install
cp .env.example .env  # Configure Firebase, MongoDB, OpenAI
npm run dev           # http://localhost:5001
```

### Mobile App
```bash
cd mobile
npm install
cp .env.example .env  # Configure Firebase, API URL
npm start             # Press 'i' for iOS, 'a' for Android
```

## 📋 Essential Commands

### Web Development
| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (port 5001) |
| `npm test` | Run tests |
| `npm run lint` | Check code style |
| `npm run format` | Format code |
| `npm run check` | TypeScript check |
| `npm run build` | Production build |

### Mobile Development
| Command | Purpose |
|---------|---------|
| `npm start` | Start Expo |
| `npm run android` | Run Android |
| `npm run ios` | Run iOS |
| `npm run type-check` | TypeScript check |
| `npx expo start --clear` | Clear cache |

## 🏗️ Project Structure

```
PersonalLearningPro/
├── client/          # Web (React + Vite)
├── mobile/          # Mobile (React Native + Expo) ✅
├── server/          # Backend (Express)
├── shared/          # Shared types/schemas
├── .agent/          # AI agent context
└── docs/            # Documentation
```

## 🔑 Environment Variables

### Web (.env)
```env
MONGODB_URL=mongodb+srv://...
VITE_FIREBASE_API_KEY=...
OPENAI_API_KEY=...
SMTP_HOST=smtp.gmail.com
```

### Mobile (mobile/.env)
```env
EXPO_PUBLIC_API_URL=http://localhost:5001
EXPO_PUBLIC_FIREBASE_API_KEY=...
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Web** | React 18, Vite, TypeScript, Tailwind |
| **Mobile** | React Native 0.81, Expo 54, NativeWind |
| **Backend** | Express, TypeScript, Zod |
| **Database** | MongoDB, Cassandra, AsyncStorage |
| **Auth** | Firebase Authentication |
| **AI** | OpenAI GPT-4o |
| **Real-time** | WebSockets |

## 📱 Mobile Features (100% Complete)

- ✅ Authentication (Firebase)
- ✅ AI Tutor Chat
- ✅ Task Management
- ✅ Real-time Messaging
- ✅ Test Taking
- ✅ Analytics Dashboard
- ✅ Study Plans
- ✅ Push Notifications
- ✅ OCR Scanning
- ✅ Offline Support

## 🎯 Key Roles

| Role | Dashboard | Key Features |
|------|-----------|--------------|
| **Student** | `/student-dashboard` | AI Tutor, Tests, Progress |
| **Teacher** | `/dashboard` | Create Tests, Analytics, Live Classes |
| **Principal** | `/principal-dashboard` | School Analytics, Staff Overview |
| **Admin** | `/admin-dashboard` | User Management, Reports |

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [AGENTS.md](AGENTS.md) | AI agent instructions |
| [README.md](README.md) | Project overview |
| [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md) | Setup guide |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Contribution guide |
| [mobile/README.md](mobile/README.md) | Mobile app docs |
| [MOBILE_MIGRATION_STATUS.md](MOBILE_MIGRATION_STATUS.md) | Mobile status |

## 🐛 Common Issues

### Port 5001 in use
```bash
# Change port in server/index.ts
const port = 5002;
```

### Firebase not working
- Check all `VITE_FIREBASE_*` variables in `.env`
- Enable Google Auth in Firebase Console

### Mobile can't connect
- Use local IP instead of localhost on physical devices
- Example: `EXPO_PUBLIC_API_URL=http://192.168.1.100:5001`

### Clear mobile cache
```bash
cd mobile
npx expo start --clear
```

## 🔗 Important Links

- **Repository:** https://github.com/StarkNitish/PersonalLearningPro
- **Discord:** https://discord.gg/ewHtFk9G
- **License:** MIT

## 📊 Project Status

- **Web App:** ✅ Production Ready
- **Mobile App:** ✅ 100% Complete
- **Backend:** ✅ Production Ready
- **Documentation:** ✅ Up to Date

---

**Last Updated:** April 13, 2026  
**Version:** 1.1.0
