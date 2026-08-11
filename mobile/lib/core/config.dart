import 'package:flutter/foundation.dart';

/// Base URL for the NOVA LABS API.
///
/// Override at build/run time for a physical device or a deployed backend:
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.42:8000
///
/// With no override, the default is picked per platform, because "your dev
/// machine" has a different address on each one:
///   * Android emulator  -> 10.0.2.2 (its alias for the host's localhost)
///   * iOS simulator     -> localhost (it shares the host's network stack)
/// A physical device on either platform can reach neither, so it needs the
/// --dart-define above with your machine's LAN IP.
///
/// This deliberately uses `defaultTargetPlatform` rather than `dart:io`'s
/// `Platform`, which does not exist on web.
const String _apiBaseUrlOverride = String.fromEnvironment('API_BASE_URL');

String get apiBaseUrl {
  if (_apiBaseUrlOverride.isNotEmpty) return _apiBaseUrlOverride;
  if (kIsWeb) return 'http://localhost:8000';
  return defaultTargetPlatform == TargetPlatform.android
      ? 'http://10.0.2.2:8000'
      : 'http://localhost:8000';
}

/// The backend's GOOGLE_CLIENT_ID (a *web* OAuth client). Passing it as
/// `serverClientId` makes google_sign_in request an ID token audienced to
/// that client, matching what `/auth/google` on the backend checks for —
/// this is Google's documented pattern for a mobile app + shared backend.
/// Requires Google Cloud Console setup (iOS/Android OAuth clients under the
/// same project as this web client) before Google Sign-In will work.
///
///   flutter run --dart-define=GOOGLE_SERVER_CLIENT_ID=xxx.apps.googleusercontent.com
const String googleServerClientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');
