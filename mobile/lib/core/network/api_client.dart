import 'dart:async';

import 'package:dio/dio.dart';

import '../config.dart';
import '../storage/token_storage.dart';

/// Thrown when a request fails auth and the refresh flow also fails —
/// the app should treat this as a forced logout.
class SessionExpiredException implements Exception {}

/// Dio client wired for the NOVA LABS API: attaches the bearer access token,
/// identifies itself as a mobile client (so /auth/* returns refresh_token in
/// the body instead of only setting a cookie), and transparently refreshes
/// an expired access token once before giving up.
class ApiClient {
  ApiClient({required this.tokenStorage, VoidCallback? onSessionExpired})
      : _onSessionExpired = onSessionExpired,
        dio = Dio(BaseOptions(baseUrl: apiBaseUrl, headers: {'X-Client-Type': 'mobile'})) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await tokenStorage.readAccessToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final isUnauthorized = error.response?.statusCode == 401;
          final isRefreshCall = error.requestOptions.path.contains('/auth/refresh');
          if (!isUnauthorized || isRefreshCall) {
            return handler.next(error);
          }

          // A 401 with no stored refresh token is just "not logged in" —
          // don't start a refresh/logout storm, let the caller see the 401.
          if (await tokenStorage.readRefreshToken() == null) {
            return handler.next(error);
          }

          try {
            await _refreshAccessToken();
          } catch (_) {
            await tokenStorage.clear();
            try {
              _onSessionExpired?.call();
            } catch (_) {
              // Listener errors must never break the interceptor contract
              // (each handler may be completed exactly once).
            }
            return handler.next(error);
          }

          try {
            final retryResponse = await dio.fetch(error.requestOptions);
            handler.resolve(retryResponse);
          } on DioException catch (retryError) {
            handler.next(retryError);
          }
        },
      ),
    );
  }

  final Dio dio;
  final TokenStorage tokenStorage;
  final VoidCallback? _onSessionExpired;

  Completer<void>? _refreshInFlight;

  /// Refreshes the access token, coalescing concurrent callers into a single
  /// in-flight request so a burst of 401s doesn't trigger a refresh storm.
  Future<void> _refreshAccessToken() async {
    if (_refreshInFlight != null) return _refreshInFlight!.future;

    final completer = Completer<void>();
    // The creator handles errors via rethrow below; without listeners the
    // completer's error would otherwise surface as an unhandled async error.
    completer.future.ignore();
    _refreshInFlight = completer;
    try {
      final refreshToken = await tokenStorage.readRefreshToken();
      if (refreshToken == null) throw SessionExpiredException();

      final response = await dio.post(
        '/auth/refresh',
        data: {'refresh_token': refreshToken},
      );
      await tokenStorage.saveTokens(
        accessToken: response.data['access_token'] as String,
        refreshToken: response.data['refresh_token'] as String?,
      );
      completer.complete();
    } catch (e) {
      completer.completeError(e);
      rethrow;
    } finally {
      _refreshInFlight = null;
    }
  }
}

typedef VoidCallback = void Function();
