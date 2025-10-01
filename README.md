# BankApp - Mobile Banking Application

![BankApp Logo](/assets/images/logo.png)

BankApp is a modern, feature-rich mobile banking application built with React Native and Expo. It provides users with a seamless banking experience, allowing them to manage their accounts, cards, and transactions on the go. The application uses Firebase for backend services and a lightweight server (Bun + Hono) for card storage and payment flows (deployable to Fly.io or run locally).

## 📱 Features

- **User Authentication**
  - Secure sign-in and sign-up with Firebase Auth
  - Email validation and password strength requirements
  - Persistent sessions with AsyncStorage
  - Comprehensive error handling with user-friendly messages

- **Dashboard Overview**
  - View account balances and recent transactions at a glance
  - Quick access to frequently used features
  - Real-time data updates with Firestore

- **Card Management**
  - View and manage multiple bank cards
  - Card activation/deactivation
  - View card details and transaction history

- **Transaction History**
  - Track and filter transaction history
  - Categorized transactions for better financial management
  - Real-time transaction updates

- **Money Transfers**
  - Send money to saved recipients
  - Add and manage recipient information
  - Secure transfer process with Firebase security rules

- **Payments and Cards**
  - Add cards and simulate/execute authorization via the server API
  - Server-side tokenization; only last4/brand/expiry are stored
  - Authenticated via Firebase Auth tokens

- **Alert System**
  - Real-time feedback for user actions
  - Different alert types (success, error, warning, info)
  - Animated alerts with auto-dismissal
  - Consistent error handling across the application

- **Profile Management**
  - Update user profile and settings
  - Manage security preferences
  - Profile picture upload with Firebase Storage
  - View account information

## 🛠️ Technologies Used

- **React Native**: Cross-platform mobile development framework
- **Expo**: Development platform for React Native
- **TypeScript**: Type-safe JavaScript
- **NativeWind/TailwindCSS**: Utility-first CSS framework for styling
- **Expo Router**: File-based routing for navigation
- **Zustand**: State management library
- **Firebase**: Backend services (Auth, Firestore, Storage)
- **React Native Firebase**: Firebase SDK for React Native
- **Fly.io**: Hosting for the mock server API (cards/payments)
- **AsyncStorage**: Local data persistence
- **React Native Reanimated**: Animation library for smooth UI interactions

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/) or [bun](https://bun.sh/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- iOS Simulator or Android Emulator (optional for mobile testing)
- [Firebase Project](https://console.firebase.google.com/) (for backend services)

## 🚀 Getting Started

### Installation

1. Clone the repository:

```bash
git clone https://github.com/CharaD7/bank_app.git
cd bank_app
```

2. Install dependencies:

```bash
npm install
# or
yarn install
# or
bun install
```

3. Set up Firebase:
   - Follow the [Firebase Setup Guide](FIREBASE_SETUP.md) to create and configure your project
   - Once configured, copy `.env.example` to create your `.env` file:
   
   ```bash
   cp .env.example .env
   ```

4. Configure environment variables:
   - Edit the `.env` file with your Firebase configuration (see [Configuration](#-configuration) section)
   - Add your Firebase config values obtained from the Firebase Console

4. Start the development server:
   ```bash
   npx expo start
   ```

5. Run on your preferred platform:
   - Press `i` to run on iOS Simulator
   - Press `a` to run on Android Emulator
   - Scan the QR code with the Expo Go app on your physical device

## 📱 App Structure

### Screens

- **Authentication**: Sign-in and sign-up screens with validation
- **Home**: Dashboard with account overview and quick actions
- **Cards**: View and manage bank cards
- **Activity**: Transaction history with filtering options
- **Profile**: User profile and settings
- **Transfer**: Money transfer functionality
- **Settings**: App settings and preferences

### Project Structure

```
bank_app/
├── app/                  # Main application screens and navigation
│   ├── (auth)/           # Authentication screens
│   ├── (tabs)/           # Main tab screens
│   └── _layout.tsx       # Root layout
├── assets/               # Static assets (images, fonts, icons)
├── components/           # Reusable components
├── constants/            # Constants and types
├── context/              # React context providers
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions and API clients
├── scripts/              # Utility scripts
├── store/                # State management
└── types/                # TypeScript type definitions
```

## 🔧 Configuration

### Environment Variables

A `.env.example` file is provided in the repository as a template. Copy this file to create your own `.env` file:

```bash
cp .env.example .env
```

Then edit the `.env` file and replace the placeholder values with your actual configuration:

```
# Firebase Configuration (add these to your .env)
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id

# API Base
AWS_ENDPOINT_URL_S3=https://your-app.fly.dev

# Application Environment
EXPO_PUBLIC_APP_ENV=development
```

> **Important:** Replace all placeholder values with your actual API keys and configuration values.

### Firebase Setup

To configure Firebase for this application:

1. Create a Firebase project:
   - Go to the Firebase Console: https://console.firebase.google.com/
   - Create a new project or select an existing one

2. Add a Web App (to obtain SDK config values used by Expo):
   - In Project Settings > Your apps, click "Add app" and choose Web
   - Register the app and copy the Firebase SDK config (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId)
   - Add these values to your `.env` file using the EXPO_PUBLIC_FIREBASE_* keys shown above

3. Enable Firebase services used by the app:
   - Authentication > Sign-in method > Enable Email/Password
   - Firestore > Create a Firestore database (start in test mode for development)
   - Storage > Create a storage bucket (default is fine)

4. (Optional) Configure security rules for Firestore and Storage.
   - Rules are located in the repository as `firestore.rules` and `storage.rules`
   - To deploy rules locally, install the Firebase CLI and run the provided script: `./scripts/deploy-firebase.sh`

For more detailed information about the app backend and client helpers, refer to the [API Documentation](API.md).

## Server API (cards/payments)

Use a Fly.io-hosted mock server that handles card storage and payment flows.

### Dummy Mode & Seeding
- Set DUMMY_MODE=true on the server to enable safe demo behavior.
- Card creation rules:
  - Luhn-valid card numbers are required
  - In dummy mode, numbers with repeated 4-digit chunks are rejected (e.g., 4242 4242 4242 4242)
- Server generates a random token; the app stores this token on the card and uses it as the payment source.
- Fingerprint is randomized in dummy mode (not derived from the PAN).
- Seeding: POST /v1/dev/seed-transactions to generate demo payments and adjust balances.

- Configure the app to use it by setting in your .env:
  - EXPO_PUBLIC_API_BASE_URL=https://your-app.fly.dev
    or
  - EXPO_PUBLIC_FLY_API_URL=https://your-app.fly.dev

CORS
- Browsers must match exact origins. Examples:
  - Dev: http://localhost:19006,http://localhost:8081
  - Snack (optional): https://snack.expo.dev
  - Prod: https://app.yourdomain.com
- React Native (device/emulator) generally has no Origin header; CORS is primarily for web/Snack.

401/CORS troubleshooting
- 401: Verify your client obtains an Appwrite JWT (account.createJWT()) and includes Authorization: Bearer <JWT>
- CORS error: Ensure the browser origin is listed in CORS_ORIGINS exactly (scheme, no trailing slash)

- What it provides:
  - POST /v1/cards (adds a card; requires Authorization: Bearer <Appwrite JWT>)
  - GET /v1/cards
  - DELETE /v1/cards/:id
  - Payments endpoints (authorize, capture, refund) and Notifications endpoints

Note: The local server directory (server/) is deprecated and kept only for reference. Do not run it locally.

### Optimization Tips
- Use Idempotency-Key on POST requests to avoid duplicates when retrying.
- Keep Expo packages on expected patch versions (Expo CLI suggests versions at startup).
- In server Dockerfile, pin Bun version and prefer `bun install --ci` for reproducible builds.
- Use tunnel mode for easy device testing: bunx expo start --tunnel.

### Verifying Environment Variables

You can verify that your environment variables are set up correctly by running:

```bash
npm run test-env
# or
yarn test-env
```

This will display all the configured environment variables and help you identify any issues with your setup.

### Verifying Firebase Configuration

This repo includes a small helper script to validate that your Firebase environment variables are populated and alert you to any missing values. Run:

```bash
node ./scripts/ensure-firebase-prereqs.js
```

To deploy Firestore / Storage rules after installing the Firebase CLI and logging in, run:

```bash
./scripts/deploy-firebase.sh
```

If you see errors about missing env vars, open the Firebase Console > Project Settings > Your apps and copy the SDK config values into your `.env` file.


## 💡 Usage Examples

### Authentication

The application provides a secure authentication system with email/password login:

1. **Sign Up**:
   - Navigate to the Sign Up screen
   - Enter your name, email, phone number, password, and confirm password
   - The system validates your input (email format, password strength)
   - Upon successful registration, you'll be redirected to the onboarding screen

2. **Sign In**:
   - Navigate to the Sign In screen
   - Enter your email and password
   - Upon successful authentication, you'll be redirected to the home screen

### Adding a Card

1. Navigate to the Cards screen
2. Tap on "+ Add Card"
3. Enter your card details
4. The app will call your server at /v1/cards using your Appwrite JWT (Bearer token)
5. On success, a masked card (•••• •••• •••• last4) will be added to your list

### Using the Alert System

The application includes a comprehensive alert system for user feedback:

```javascript
// Import the useAlert hook
import { useAlert } from '@/context/AlertContext';

// Inside your component
const { showAlert } = useAlert();

// Show a success alert
showAlert('success', 'Your payment was processed successfully.', 'Payment Successful');

// Show an error alert
showAlert('error', 'Payment failed. Please try again.', 'Payment Error');

// Show a warning alert
showAlert('warning', 'Your account balance is low.', 'Low Balance');

// Show an info alert
showAlert('info', 'New features are available.', 'Information');
```

## 🧪 Testing

Run tests using the following command:

```bash
npm test
# or
yarn test
```

## 🚀 Deployment

### Building for Production

To build the application for production:

1. Update the environment variables for production:
   ```
   EXPO_PUBLIC_APP_ENV=production
   ```

2. Build the application:
   ```bash
   npx expo build:android  # For Android
   # or
   npx expo build:ios      # For iOS
   ```

3. Follow the Expo build instructions to complete the process

### Publishing to App Stores

1. **Google Play Store**:
   - Create a Google Play Developer account
   - Create a new application in the Google Play Console
   - Upload the APK or AAB file
   - Fill in the store listing information
   - Submit for review

2. **Apple App Store**:
   - Create an Apple Developer account
   - Create a new application in App Store Connect
   - Upload the IPA file using Transporter
   - Fill in the store listing information
   - Submit for review

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please check out our [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

If you have any questions or need help, please open an issue or contact the maintainers.

## 🔮 Roadmap

Future plans for the BankApp include:

- **Biometric Authentication**: Add fingerprint and face recognition for secure login
- **Dark Mode**: Implement a dark theme option for better user experience
- **Push Notifications**: Add real-time notifications for transactions and account updates
- **Expense Analytics**: Add charts and graphs for visualizing spending patterns
- **Multiple Languages**: Add support for multiple languages
- **Offline Mode**: Implement offline functionality for basic features

## 🔒 Security Considerations

- All sensitive information is stored in environment variables, not hardcoded in the source code
- Authentication is handled securely through Appwrite's authentication system
- Passwords are validated for strength during registration
- Payment processing is handled by the server API; PAN/CVC never touch the app and only masked/metadata are stored
- Session management includes proper timeout and cleanup

## 🙏 Acknowledgements

- [Expo](https://expo.dev/)
- [React Native](https://reactnative.dev/)
- [Appwrite](https://appwrite.io/)
- [Hono](https://hono.dev/)
- [Fly.io](https://fly.io/)
- [NativeWind](https://www.nativewind.dev/)
- [Zustand](https://github.com/pmndrs/zustand)
- [Lucide Icons](https://lucide.dev/)
