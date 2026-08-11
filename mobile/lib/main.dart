import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_router.dart';
import 'core/theme.dart';

void main() {
  runApp(const ProviderScope(child: NovaLabsApp()));
}

class NovaLabsApp extends ConsumerWidget {
  const NovaLabsApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'NOVA LABS',
      theme: buildBrandTheme(),
      routerConfig: router,
    );
  }
}
