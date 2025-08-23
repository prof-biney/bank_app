# Changelog

All notable changes to the BankApp project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Server: DUMMY_MODE flag with stricter card validation (reject repeated 4-digit chunks), randomized fingerprint, and dev-only /v1/dev/seed-transactions endpoint.
- App: store server-issued card token and use it as payment source; auto-seed demo transactions on sign-in/login when server is in dummy mode.
- Docs: Dummy mode & seeding docs; CORS guidance; /v1/diag mention; optimization tips (Expo patches, pinned Bun, bun install --ci, Idempotency-Key).
- Updated server Dockerfile: pin Bun version and copy server/scripts into image.

## [1.0.0] - 2025-08-02

### Added
- Initial release of BankApp
- User authentication (sign-in, sign-up)
- Dashboard with account overview
- Card management functionality
- Transaction history with filtering
- Money transfer functionality
- Payment processing with Paystack
- Profile management
- Settings screen

### Technical Features
- React Native with Expo framework
- TypeScript for type safety
- NativeWind/TailwindCSS for styling
- Expo Router for navigation
- Zustand for state management
- AsyncStorage for local data persistence
- Mock data for demonstration purposes

## Types of changes
- `Added` for new features.
- `Changed` for changes in existing functionality.
- `Deprecated` for soon-to-be removed features.
- `Removed` for now removed features.
- `Fixed` for any bug fixes.
- `Security` in case of vulnerabilities.