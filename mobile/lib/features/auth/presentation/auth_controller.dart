import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../../core/config.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/token_storage.dart';
import '../data/auth_repository.dart';
import '../domain/user.dart';

/// Thrown when Google Sign-In needs a GOOGLE_SERVER_CLIENT_ID (or the user
/// cancels the picker) — the caller should just leave the login screen as-is.
class GoogleSignInUnavailable implements Exception {}

final tokenStorageProvider = Provider((ref) => TokenStorage());

/// Bumped to force ApiClient (and its session-expired callback) to rebuild
/// after a forced logout, so a fresh login gets a clean interceptor state.
final _sessionEpochProvider = StateProvider((ref) => 0);

final apiClientProvider = Provider<ApiClient>((ref) {
  ref.watch(_sessionEpochProvider);
  return ApiClient(
    tokenStorage: ref.watch(tokenStorageProvider),
    onSessionExpired: () {
      ref.read(authControllerProvider.notifier).forceLoggedOut();
    },
  );
});

final authRepositoryProvider = Provider(
  (ref) => AuthRepository(ref.watch(apiClientProvider)),
);

sealed class AuthState {
  const AuthState();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated();
}

class AuthAuthenticated extends AuthState {
  const AuthAuthenticated(this.profile);
  final LearnerProfile profile;
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._ref) : super(const AuthLoading()) {
    _restoreSession();
  }

  final Ref _ref;
  AuthRepository get _repository => _ref.read(authRepositoryProvider);

  Future<void> _restoreSession() async {
    if (await _repository.hasStoredSession()) {
      await _loadProfile();
    } else {
      state = const AuthUnauthenticated();
    }
  }

  Future<void> _loadProfile() async {
    try {
      final profile = await _repository.fetchProfile();
      state = AuthAuthenticated(profile);
    } catch (_) {
      state = const AuthUnauthenticated();
    }
  }

  Future<void> login({required String email, required String password}) async {
    await _repository.login(email: email, password: password);
    await _loadProfile();
  }

  Future<void> signup({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
  }) async {
    await _repository.signup(
      email: email,
      password: password,
      firstName: firstName,
      lastName: lastName,
    );
    await _loadProfile();
  }

  Future<void> loginWithGoogle() async {
    if (googleServerClientId.isEmpty) throw GoogleSignInUnavailable();

    final googleSignIn = GoogleSignIn(serverClientId: googleServerClientId);
    final account = await googleSignIn.signIn();
    if (account == null) throw GoogleSignInUnavailable(); // user cancelled

    final idToken = (await account.authentication).idToken;
    if (idToken == null) throw GoogleSignInUnavailable();

    await _repository.loginWithGoogleIdToken(idToken);
    await _loadProfile();
  }

  /// Re-fetches the profile in place, e.g. after payment unlocks `is_paid`.
  Future<void> refreshProfile() => _loadProfile();

  Future<void> logout() async {
    await _repository.logout();
    state = const AuthUnauthenticated();
    _ref.read(_sessionEpochProvider.notifier).state++;
  }

  void forceLoggedOut() {
    // Concurrent 401s can all trigger this; only the first transition should
    // bump the epoch, or the ApiClient rebuild re-fires every watching
    // provider and causes a request storm.
    if (state is AuthUnauthenticated) return;
    state = const AuthUnauthenticated();
    _ref.read(_sessionEpochProvider.notifier).state++;
  }
}

final authControllerProvider = StateNotifierProvider<AuthController, AuthState>(
  (ref) => AuthController(ref),
);
