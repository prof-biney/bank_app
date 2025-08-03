# BankApp - Mobile Banking Application

![BankApp Logo](/assets/images/logo.png)

BankApp is a modern, feature-rich mobile banking application built with React Native and Expo. It provides users with a seamless banking experience, allowing them to manage their accounts, cards, and transactions on the go.

## 📱 Features

- **User Authentication**: Secure sign-in and sign-up functionality
- **Dashboard Overview**: View account balances and recent transactions at a glance
- **Card Management**: View and manage multiple bank cards
- **Transaction History**: Track and filter transaction history
- **Money Transfers**: Send money to saved recipients
- **Payment Processing**: Make payments using Paystack integration
- **Profile Management**: Update user profile and settings

## 🛠️ Technologies Used

- **React Native**: Cross-platform mobile development framework
- **Expo**: Development platform for React Native
- **TypeScript**: Type-safe JavaScript
- **NativeWind/TailwindCSS**: Utility-first CSS framework for styling
- **Expo Router**: File-based routing for navigation
- **Zustand**: State management library
- **React Native Appwrite**: Backend integration with Appwrite
- **React Native Paystack Webview**: Payment processing with Paystack
- **AsyncStorage**: Local data persistence

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- iOS Simulator or Android Emulator (optional for mobile testing)

## 🚀 Getting Started

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/bank_app.git
   cd bank_app
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Start the development server:
   ```bash
   npx expo start
   ```

4. Run on your preferred platform:
   - Press `i` to run on iOS Simulator
   - Press `a` to run on Android Emulator
   - Scan the QR code with the Expo Go app on your physical device

## 📱 App Structure

- **Authentication**: Sign-in and sign-up screens
- **Home**: Dashboard with account overview and quick actions
- **Cards**: View and manage bank cards
- **Activity**: Transaction history with filtering options
- **Profile**: User profile and settings
- **Transfer**: Money transfer functionality
- **Settings**: App settings and preferences

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
EXPO_PUBLIC_APPWRITE_PLATFORM=com.profbiney.vault
EXPO_PUBLIC_APPWRITE_DATABASE_ID=your_database_id
EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID=your_user_collection_id

# Paystack Configuration
EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY=your_paystack_public_key
EXPO_PUBLIC_PAYSTACK_DEFAULT_EMAIL=your_email@example.com
EXPO_PUBLIC_PAYSTACK_CURRENCY=GHS

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
   - Enter the package name: `com.profbiney.vault`
   - Save the platform

3. **Create Database and Collections**:
   - Create a new database or use an existing one
   - Note the Database ID
   - Create a user collection or use an existing one
   - Note the Collection ID

4. **Update Your .env File**:
   - Set `EXPO_PUBLIC_APPWRITE_PROJECT_ID` to your actual Project ID
   - Set `EXPO_PUBLIC_APPWRITE_DATABASE_ID` to your Database ID
   - Set `EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID` to your User Collection ID

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

### Troubleshooting Common Errors

#### Appwrite Project ID Error

If you see this error:
```
[AppwriteException: Project with the requested ID could not be found]
```

This means your Appwrite Project ID is incorrect or not properly set. Check that:
- You've replaced the placeholder in `.env` with your actual Project ID
- The Project ID is correctly copied from your Appwrite dashboard
- There are no extra spaces or characters in the ID

#### Invalid Origin Error

If you see this error:
```
[AppwriteException: Invalid Origin. Register your new client (com.profbiney.vault) as a new Android platform on your project console dashboard]
```

This means the Android platform isn't registered in your Appwrite project:
- Go to your Appwrite dashboard > Project Settings > Platforms
- Add a new Android platform with the package name `com.profbiney.vault`
- Make sure the package name matches exactly what's in your `.env` file

## 🧪 Testing

Run tests using the following command:

```bash
npm test
# or
yarn test
```

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

## 🙏 Acknowledgements

- [Expo](https://expo.dev/)
- [React Native](https://reactnative.dev/)
- [Appwrite](https://appwrite.io/)
- [Paystack](https://paystack.com/)
- [NativeWind](https://www.nativewind.dev/)