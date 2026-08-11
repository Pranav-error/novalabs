import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../gamification/data/gamification_repository.dart';
import '../data/content_repository.dart';
import '../domain/phase.dart';
import 'announcements_card.dart';
import '../../notifications/presentation/notifications_screen.dart';

/// Bell with an unread badge, opening the notifications list.
class _NotificationBell extends ConsumerWidget {
  const _NotificationBell();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(unreadNotificationsProvider).valueOrNull ?? 0;
    return IconButton(
      tooltip: 'Notifications',
      onPressed: () async {
        await Navigator.of(
          context,
        ).push(MaterialPageRoute(builder: (_) => const NotificationsScreen()));
        ref.invalidate(unreadNotificationsProvider);
      },
      icon: Badge(
        isLabelVisible: unread > 0,
        label: Text(unread > 9 ? '9+' : '$unread'),
        child: const Icon(Icons.notifications_none_rounded, color: Brand.navy),
      ),
    );
  }
}

String _greeting() {
  final hour = DateTime.now().hour;
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final profile = authState is AuthAuthenticated ? authState.profile : null;

    if (profile == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            await ref.read(authControllerProvider.notifier).refreshProfile();
            ref.invalidate(_phasesProvider);
            ref.invalidate(_streakProvider);
            ref.invalidate(_progressProvider);
            ref.invalidate(announcementsProvider);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            children: [
              const Align(
                alignment: Alignment.centerRight,
                child: _NotificationBell(),
              ),
              const SizedBox(height: 4),
              _WelcomeCard(
                    firstName: profile.firstName,
                    daysCompleted: profile.daysCompleted,
                    totalXp: profile.totalXp,
                  )
                  .animate()
                  .fadeIn(duration: 350.ms)
                  .slideY(begin: 0.06, curve: Curves.easeOut),
              const SizedBox(height: 14),
              _ContinueCard(daysCompleted: profile.daysCompleted)
                  .animate(delay: 90.ms)
                  .fadeIn(duration: 350.ms)
                  .slideY(begin: 0.06, curve: Curves.easeOut),
              const SizedBox(height: 26),
              const AnnouncementsCard(),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Your journey',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          '6 phases · 30 days · job-ready skills',
                          style: TextStyle(
                            color: Brand.textMuted,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    '${profile.daysCompleted}/30',
                    style: const TextStyle(
                      color: Brand.primary,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                ],
              ).animate(delay: 150.ms).fadeIn(duration: 300.ms),
              const SizedBox(height: 14),
              const _PhaseList(),
            ],
          ),
        ),
      ),
    );
  }
}

class _WelcomeCard extends ConsumerWidget {
  const _WelcomeCard({
    required this.firstName,
    required this.daysCompleted,
    required this.totalXp,
  });

  final String firstName;
  final int daysCompleted;
  final int totalXp;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final streakAsync = ref.watch(_streakProvider);
    final streak = streakAsync.valueOrNull?['current_streak'] as int? ?? 0;
    final currentDay = (daysCompleted + 1).clamp(1, 30);

    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: Container(
        decoration: const BoxDecoration(gradient: Brand.heroGradient),
        child: Stack(
          children: [
            // Decorative orbs, echoing the site's auth-panel background.
            Positioned(
              top: -40,
              right: -30,
              child: _Orb(color: Brand.cyan.withValues(alpha: 0.25), size: 140),
            ),
            Positioned(
              bottom: -50,
              left: -20,
              child: _Orb(
                color: Brand.purple.withValues(alpha: 0.3),
                size: 120,
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${_greeting()}, $firstName!',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    "You're on Day $currentDay of 30",
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.7),
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      _HeroStat(
                        icon: Icons.local_fire_department,
                        value: '$streak',
                        label: 'streak',
                      ),
                      const SizedBox(width: 10),
                      _HeroStat(
                        icon: Icons.star_rounded,
                        value: '$totalXp',
                        label: 'XP',
                      ),
                      const SizedBox(width: 10),
                      _HeroStat(
                        icon: Icons.check_circle_outline,
                        value: '$daysCompleted',
                        label: 'done',
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  BrandProgressBar(value: daysCompleted / 30),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Orb extends StatelessWidget {
  const _Orb({required this.color, required this.size});
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(colors: [color, color.withValues(alpha: 0)]),
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({
    required this.icon,
    required this.value,
    required this.label,
  });

  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(icon, color: Brand.cyan, size: 17),
          const SizedBox(width: 6),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
              fontSize: 14,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.65),
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

/// The single most important action: jump back into the next unfinished day.
class _ContinueCard extends ConsumerWidget {
  const _ContinueCard({required this.daysCompleted});
  final int daysCompleted;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final nextDay = (daysCompleted + 1).clamp(1, 30);
    final dayFuture = ref.watch(_nextDayPreviewProvider(nextDay));
    final title = dayFuture.valueOrNull?['title'] as String?;

    return BrandCard(
      padding: EdgeInsets.zero,
      onTap: () => context.push('/day/$nextDay'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                gradient: Brand.progressGradient,
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(
                Icons.play_arrow_rounded,
                color: Colors.white,
                size: 28,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    daysCompleted == 0
                        ? 'Start Day 1'
                        : 'Continue Day $nextDay',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      color: Brand.navy,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    title ?? 'Pick up where you left off',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Brand.textMuted,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_rounded, color: Brand.primary),
          ],
        ),
      ),
    );
  }
}

// Only the title is needed for the preview; failures degrade to a static line.
final _nextDayPreviewProvider =
    FutureProvider.family<Map<String, dynamic>, int>((ref, dayNumber) {
      return ref.watch(contentRepositoryProvider).fetchDay(dayNumber);
    });

class _PhaseList extends ConsumerWidget {
  const _PhaseList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final phasesFuture = ref.watch(_phasesProvider);
    final progress = ref.watch(_progressProvider).valueOrNull ?? const [];
    final completedDays = {
      for (final p in progress)
        if (p['status'] == 'completed') p['day_number'] as int,
    };

    return phasesFuture.when(
      loading: () => const _PhaseSkeletons(),
      error: (error, _) => _ErrorRetry(
        message: 'Could not load phases',
        onRetry: () => ref.invalidate(_phasesProvider),
      ),
      data: (phases) => Column(
        children: [
          for (final (index, phase) in phases.indexed) ...[
            _PhaseCard(
                  index: index + 1,
                  phase: phase,
                  // Content is 5 days per phase, in order (site does the same
                  // day-range mapping in its PHASES constant).
                  completedInPhase: [
                    for (var d = index * 5 + 1; d <= index * 5 + 5; d++)
                      if (completedDays.contains(d)) d,
                  ].length,
                )
                .animate(delay: (200 + index * 70).ms)
                .fadeIn(duration: 320.ms)
                .slideY(begin: 0.08, curve: Curves.easeOut),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}

class _PhaseCard extends StatelessWidget {
  const _PhaseCard({
    required this.index,
    required this.phase,
    required this.completedInPhase,
  });

  final int index;
  final Phase phase;
  final int completedInPhase;

  @override
  Widget build(BuildContext context) {
    final accent = accentColorFrom(phase.accentColor);
    final isDone = completedInPhase >= 5;

    return BrandCard(
      padding: EdgeInsets.zero,
      onTap: () => context.push('/phase/${phase.id}', extra: phase.name),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(13),
              ),
              alignment: Alignment.center,
              child: isDone
                  ? Icon(Icons.check_rounded, color: accent, size: 24)
                  : Text(
                      '$index',
                      style: TextStyle(
                        color: accent,
                        fontWeight: FontWeight.w700,
                        fontSize: 18,
                      ),
                    ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    phase.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      color: Brand.navy,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    phase.tagline,
                    style: const TextStyle(
                      color: Brand.textMuted,
                      fontSize: 12.5,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(3),
                          child: LinearProgressIndicator(
                            value: completedInPhase / 5,
                            minHeight: 5,
                            backgroundColor: const Color(0xFFF3F4F6),
                            valueColor: AlwaysStoppedAnimation(accent),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        '$completedInPhase/5',
                        style: TextStyle(
                          color: accent,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right, color: Brand.textMuted),
          ],
        ),
      ),
    );
  }
}

class _PhaseSkeletons extends StatelessWidget {
  const _PhaseSkeletons();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < 4; i++) ...[
          Container(
                height: 92,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Brand.cardBorder),
                ),
                padding: const EdgeInsets.all(18),
                child: Row(
                  children: [
                    const _SkeletonBox(width: 46, height: 46, radius: 13),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: const [
                          _SkeletonBox(width: 160, height: 14, radius: 6),
                          SizedBox(height: 8),
                          _SkeletonBox(width: 100, height: 10, radius: 5),
                        ],
                      ),
                    ),
                  ],
                ),
              )
              .animate(onPlay: (c) => c.repeat())
              .shimmer(
                duration: 1200.ms,
                color: Colors.white.withValues(alpha: 0.6),
              ),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

class _SkeletonBox extends StatelessWidget {
  const _SkeletonBox({
    required this.width,
    required this.height,
    required this.radius,
  });

  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: const Color(0xFFEDEFF3),
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

class _ErrorRetry extends StatelessWidget {
  const _ErrorRetry({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          const Icon(Icons.wifi_off_rounded, color: Brand.textMuted, size: 36),
          const SizedBox(height: 10),
          Text(message, style: const TextStyle(color: Brand.textMuted)),
          const SizedBox(height: 12),
          TextButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh, size: 18),
            label: const Text('Try again'),
          ),
        ],
      ),
    );
  }
}

final _streakProvider = FutureProvider((ref) {
  return ref.watch(gamificationRepositoryProvider).fetchStreak();
});

final _progressProvider = FutureProvider((ref) {
  return ref.watch(contentRepositoryProvider).fetchMyProgress();
});

final _phasesProvider = FutureProvider<List<Phase>>((ref) {
  return ref.watch(contentRepositoryProvider).fetchPhases();
});
