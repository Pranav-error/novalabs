import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../../../core/storage/token_storage.dart';
import '../domain/user.dart';

class AuthRepository {
  AuthRepository(this._client);

  final ApiClient _client;

  TokenStorage get _tokenStorage => _client.tokenStorage;

  Future<void> login({required String email, required String password}) async {
    final response = await _client.dio.post(
      '/auth/login',
      data: {'email': email, 'password': password},
    );
    await _saveTokens(response);
  }

  Future<void> signup({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
  }) async {
    final response = await _client.dio.post(
      '/auth/signup',
      data: {
        'email': email,
        'password': password,
        'first_name': firstName,
        'last_name': lastName,
      },
    );
    await _saveTokens(response);
  }

  Future<void> loginWithGoogleIdToken(String idToken) async {
    final response = await _client.dio.post(
      '/auth/google',
      data: {'credential': idToken},
    );
    await _saveTokens(response);
  }

  Future<void> logout() async {
    final refreshToken = await _tokenStorage.readRefreshToken();
    try {
      await _client.dio.post(
        '/auth/logout',
        data: {'refresh_token': refreshToken},
      );
    } on DioException {
      // Best-effort server-side revoke; local wipe below is what actually
      // logs the device out.
    }
    await _tokenStorage.clear();
  }

  Future<bool> hasStoredSession() async {
    return (await _tokenStorage.readAccessToken()) != null;
  }

  Future<LearnerProfile> fetchProfile() async {
    final response = await _client.dio.get('/me');
    return LearnerProfile.fromJson(response.data as Map<String, dynamic>);
  }

  /// The backend applies PATCH /me with `exclude_unset=True`, so omitted keys
  /// are left untouched — unlike assignment submission, sending `null` here
  /// would actively clear that field. Only include what actually changed.
  Future<void> updateProfile({
    String? bio,
    String? githubUrl,
    String? linkedinUrl,
  }) async {
    await _client.dio.patch(
      '/me',
      data: {
        'bio': ?bio,
        'github_url': ?githubUrl,
        'linkedin_url': ?linkedinUrl,
      },
    );
  }

  Future<void> _saveTokens(Response response) async {
    final data = response.data as Map<String, dynamic>;
    await _tokenStorage.saveTokens(
      accessToken: data['access_token'] as String,
      refreshToken: data['refresh_token'] as String?,
    );
  }
}
