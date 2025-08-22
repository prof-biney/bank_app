# BankApp - Mobile Banking Application

![BankApp Logo](/assets/images/logo.png)

BankApp is a modern, feature-rich mobile banking application built with React Native and Expo. It provides users with a seamless banking experience, allowing them to manage their accounts, cards, and transactions on the go. The application uses Appwrite for backend services and a lightweight server (Bun + Hono) for card storage and payment flows (deployable to Fly.io or run locally).

## 📱 Features

- **User Authentication**
  - Secure sign-in and sign-up functionality
  - Email validation and password strength requirements
  - Persistent sessions with AsyncStorage
  - Comprehensive error handling with user-friendly messages

- **Dashboard Overview**
  - View account balances and recent transactions at a glance
  - Quick access to frequently used features
  - Personalized user experience

- **Card Management**
  - View and manage multiple bank cards
  - Card activation/deactivation
  - View card details and transaction history

- **Transaction History**
  - Track and filter transaction history
  - Categorized transactions for better financial management
  - Detailed transaction information

- **Money Transfers**
  - Send money to saved recipients
  - Add and manage recipient information
  - Secure transfer process

- **Payments and Cards**
  - Add cards and simulate/execute authorization via the server API
  - Server-side tokenization; only last4/brand/expiry are stored
  - Authenticated via Appwrite JWT

- **Alert System**
  - Real-time feedback for user actions
  - Different alert types (success, error, warning, info)
  - Animated alerts with auto-dismissal
  - Consistent error handling across the application

- **Profile Management**
  - Update user profile and settings
  - Manage security preferences
  - View account information

## 🛠️ Technologies Used

- **React Native**: Cross-platform mobile development framework
- **Expo**: Development platform for React Native
- **TypeScript**: Type-safe JavaScript
- **NativeWind/TailwindCSS**: Utility-first CSS framework for styling
- **Expo Router**: File-based routing for navigation
- **Zustand**: State management library
- **React Native Appwrite**: Backend integration with Appwrite
- **Fly.io**: Hosting for the mock server API (cards/payments)
- **AsyncStorage**: Local data persistence
- **React Native Reanimated**: Animation library for smooth UI interactions

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/) or [bun](https://bun.sh/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- iOS Simulator or Android Emulator (optional for mobile testing)
- [Appwrite Account](https://appwrite.io/) (for backend services)

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

3. Set up environment variables:
   - Copy the `.env.example` file to create your own `.env` file:
     ```bash
     cp .env.example .env
     ```
   - Edit the `.env` file with your configuration values (see [Configuration](#-configuration) section)

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
# Appwrite Configuration
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=your_actual_project_id
EXPO_PUBLIC_APPWRITE_PLATFORM=com.user.extension
EXPO_PUBLIC_APPWRITE_DATABASE_ID=your_database_id
EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID=your_user_collection_id

# API Base
# Preferred: set AWS_ENDPOINT_URL_S3 to your Fly.io URL
AWS_ENDPOINT_URL_S3=https://your-app.fly.dev
# Alternatively, you can set EXPO_PUBLIC_AWS_ENDPOINT_URL_S3 or EXPO_PUBLIC_FLY_API_URL or EXPO_PUBLIC_API_BASE_URL

# Application Environment
EXPO_PUBLIC_APP_ENV=development
```

> **Important:** Replace all placeholder values with your actual API keys and configuration values.

### Appwrite Setup

To properly configure Appwrite for this application:

1. **Create an Appwrite Project**:
   - Go to your [Appwrite Console](https://cloud.appwrite.io/console)
   - Create a new project or select an existing one
   - Copy the Project ID from Project Settings > General

2. **Register the Android Platform**:
   - Go to Project Settings > Platforms
   - Click "Add Platform" > Select "Android"
   - Enter the package name: `com.user.extension`
   - Save the platform

3. **Create Database and Collections**:
   - Create a new database or use an existing one
   - Note the Database ID
   - Create a user collection or use an existing one
   - Note the Collection ID
   - Set up the appropriate attributes and indexes for each collection

4. **Update Your .env File**:
   - Set `EXPO_PUBLIC_APPWRITE_PROJECT_ID` to your actual Project ID
   - Set `EXPO_PUBLIC_APPWRITE_DATABASE_ID` to your Database ID
   - Set `EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID` to your User Collection ID

For more detailed information about the Appwrite setup, refer to the [API Documentation](API.md).

## Server API (cards/payments)

Use a Fly.io-hosted mock server that handles card storage and payment flows:

- Configure the app to use it by setting in your .env:
  - EXPO_PUBLIC_API_BASE_URL=https://your-app.fly.dev
    or
  - EXPO_PUBLIC_FLY_API_URL=https://your-app.fly.dev

- What it provides:
  - POST /v1/cards (adds a card; requires Authorization: Bearer <Appwrite JWT>)
  - GET /v1/cards
  - DELETE /v1/cards/:id
  - Payments endpoints (authorize, capture, refund) and Notifications endpoints

Note: The local server directory (server/) is deprecated and kept only for reference. Do not run it locally.

### Verifying Environment Variables

You can verify that your environment variables are set up correctly by running:

```bash
npm run test-env
# or
yarn test-env
```

This will display all the configured environment variables and help you identify any issues with your setup.

### Testing Appwrite Connection

To verify that your Appwrite configuration is correct and that you can connect to Appwrite:

```bash
npm run test-appwrite
# or
yarn test-appwrite
```

This test script will:
- Check your Appwrite configuration
- Attempt to connect to Appwrite
- Provide specific troubleshooting tips if there are any issues

If you see the "Project with the requested ID could not be found" or "Invalid Origin" errors, this test will help you diagnose and fix the problems.


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
