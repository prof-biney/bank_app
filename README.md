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

Create a `.env` file in the root directory with the following variables:

```
APPWRITE_ENDPOINT=your_appwrite_endpoint
APPWRITE_PROJECT_ID=your_appwrite_project_id
PAYSTACK_PUBLIC_KEY=your_paystack_public_key
```

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