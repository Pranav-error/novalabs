import 'dart:async';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists access/refresh tokens in the platform secure store
/// (Keychain on iOS, EncryptedSharedPreferences/Keystore on Android).
///
/// Reads are served from an in-memory cache once populated: several tabs
/// fire their first request concurrently right after login (the bottom-nav
/// shell builds all tabs at once), and issuing that many simultaneous
/// platform-channel reads against the OS keychain has been observed to
/// intermittently return a stale/missing value on macOS. Caching avoids the
/// concurrent-read race entirely and cuts platform-channel calls on every
/// other platform too.
class TokenStorage {
  TokenStorage({FlutterSecureStorage? storage}) : _storage = storage ?? const FlutterSecureStorage();

  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';

  // Ignored on iOS/Android/Windows/Linux; on macOS this avoids the
  // data-protection Keychain API, which 401s with errSecMissingEntitlement
  // (-34018) unless the app has a signed keychain-access-groups entitlement.
  static const _macOsOptions = MacOsOptions(useDataProtectionKeyChain: false);

  final FlutterSecureStorage _storage;

  String? _cachedAccessToken;
  String? _cachedRefreshToken;
  bool _hydrated = false;
  Completer<void>? _hydrateInFlight;

  /// Coalesces concurrent callers into a single read pair, so the burst of
  /// requests fired when the bottom-nav shell first builds all its tabs
  /// doesn't race the OS keychain with parallel reads.
  Future<void> _hydrateOnce() async {
    if (_hydrated) return;
    if (_hydrateInFlight != null) return _hydrateInFlight!.future;

    final completer = Completer<void>();
    _hydrateInFlight = completer;
    _cachedAccessToken = await _storage.read(key: _accessTokenKey, mOptions: _macOsOptions);
    _cachedRefreshToken = await _storage.read(key: _refreshTokenKey, mOptions: _macOsOptions);
    _hydrated = true;
    _hydrateInFlight = null;
    completer.complete();
  }

  Future<String?> readAccessToken() async {
    await _hydrateOnce();
    return _cachedAccessToken;
  }

  Future<String?> readRefreshToken() async {
    await _hydrateOnce();
    return _cachedRefreshToken;
  }

  Future<void> saveTokens({required String accessToken, String? refreshToken}) async {
    _hydrated = true;
    _cachedAccessToken = accessToken;
    await _storage.write(key: _accessTokenKey, value: accessToken, mOptions: _macOsOptions);
    if (refreshToken != null) {
      _cachedRefreshToken = refreshToken;
      await _storage.write(key: _refreshTokenKey, value: refreshToken, mOptions: _macOsOptions);
    }
  }

  Future<void> clear() async {
    _hydrated = true;
    _cachedAccessToken = null;
    _cachedRefreshToken = null;
    await _storage.delete(key: _accessTokenKey, mOptions: _macOsOptions);
    await _storage.delete(key: _refreshTokenKey, mOptions: _macOsOptions);
  }
}
