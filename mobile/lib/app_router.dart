import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/widgets/brand_widgets.dart';

import 'features/auth/presentation/auth_controller.dart';
import 'features/auth/presentation/forgot_password_screen.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/auth/presentation/signup_screen.dart';
import 'features/dashboard/presentation/home_shell.dart';
import 'features/dashboard/presentation/phase_days_screen.dart';
import 'features/day/presentation/day_detail_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: _AuthStateListenable(ref),
    redirect: (context, state) {
      final authState = ref.read(authControllerProvider);
      final location = state.matchedLocation;
      // Password reset belongs here too — a locked-out learner is by
      // definition unauthenticated and must be able to reach it.
      final isAuthRoute = location == '/login' ||
          location == '/signup' ||
          location == '/forgot-password';
      final isSplash = location == '/splash';

      // Park on the splash while restoring the session so no authed screen
      // (and none of its data fetches) builds before auth is known.
      if (authState is AuthLoading) return isSplash ? null : '/splash';
      if (authState is AuthUnauthenticated) return isAuthRoute ? null : '/login';
      if (authState is AuthAuthenticated && (isAuthRoute || isSplash)) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (context, state) => const _SplashScreen()),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(path: '/signup', builder: (context, state) => const SignupScreen()),
      GoRoute(
        path: '/forgot-password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(path: '/', builder: (context, state) => const HomeShell()),
      GoRoute(
        path: '/phase/:phaseId',
        builder: (context, state) => PhaseDaysScreen(
          phaseId: state.pathParameters['phaseId']!,
          phaseName: state.extra as String? ?? 'Phase',
        ),
      ),
      GoRoute(
        path: '/day/:dayNumber',
        builder: (context, state) => DayDetailScreen(
          dayNumber: int.parse(state.pathParameters['dayNumber']!),
        ),
      ),
    ],
  );
});

/// Branded holding screen shown only while the stored session is restored.
class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            BrandLogoTile(),
            SizedBox(height: 24),
            SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2.5),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bridges Riverpod's authControllerProvider to go_router's Listenable-based
/// refresh mechanism, so a login/logout re-evaluates the `redirect` above.
class _AuthStateListenable extends ChangeNotifier {
  _AuthStateListenable(this._ref) {
    _subscription = _ref.listen(authControllerProvider, (_, _) => notifyListeners());
  }

  final Ref _ref;
  late final ProviderSubscription _subscription;

  @override
  void dispose() {
    _subscription.close();
    super.dispose();
  }
}
