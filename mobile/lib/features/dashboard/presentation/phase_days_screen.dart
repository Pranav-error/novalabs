import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../payments/presentation/checkout_screen.dart';
import '../data/content_repository.dart';
import '../domain/phase.dart';

class PhaseDaysScreen extends ConsumerWidget {
  const PhaseDaysScreen({
    super.key,
    required this.phaseId,
    required this.phaseName,
  });

  final String phaseId;
  final String phaseName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final daysFuture = ref.watch(_phaseDaysProvider(phaseId));
    final authState = ref.watch(authControllerProvider);
    final isPaid = authState is AuthAuthenticated && authState.profile.isPaid;

    return Scaffold(
      appBar: AppBar(title: Text(phaseName)),
      body: daysFuture.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorView(
          error: error,
          title: 'Could not load this module',
          onRetry: () => ref.invalidate(_phaseDaysProvider(phaseId)),
        ),
        data: (days) {
          // The API reports any unstarted day as "locked" — payment state is
          // what decides whether that means "pay to unlock" or just "not
          // started". Day 1 is always free.
          final hasPayLockedDays =
              !isPaid &&
              days.any((d) => d.status == 'locked' && d.dayNumber > 1);
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            children: [
              if (hasPayLockedDays) ...[
                _UnlockBanner(
                  onUnlocked: () => ref.invalidate(_phaseDaysProvider(phaseId)),
                ).animate().fadeIn(duration: 300.ms).slideY(begin: 0.05),
                const SizedBox(height: 18),
              ],
              for (final (index, day) in days.indexed)
                _TimelineDay(
                      day: day,
                      isFirst: index == 0,
                      isLast: index == days.length - 1,
                      phaseId: phaseId,
                      isPayLocked:
                          !isPaid &&
                          day.status == 'locked' &&
                          day.dayNumber > 1,
                    )
                    .animate(delay: (index * 60).ms)
                    .fadeIn(duration: 300.ms)
                    .slideX(begin: 0.04, curve: Curves.easeOut),
            ],
          );
        },
      ),
    );
  }
}

class _UnlockBanner extends StatelessWidget {
  const _UnlockBanner({required this.onUnlocked});
  final VoidCallback onUnlocked;

  @override
  Widget build(BuildContext context) {
    return BrandCard(
      gradient: Brand.premiumGradient,
      padding: const EdgeInsets.all(18),
      child: Row(
        children: [
          const Icon(Icons.lock_open_rounded, color: Colors.white, size: 28),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Unlock all 30 days',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'One payment. Lifetime access.',
                  style: TextStyle(color: Colors.white70, fontSize: 12.5),
                ),
              ],
            ),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: Brand.purple,
              minimumSize: const Size(0, 40),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              elevation: 0,
            ),
            onPressed: () async {
              final paid = await Navigator.of(context).push<bool>(
                MaterialPageRoute(builder: (context) => const CheckoutScreen()),
              );
              if (paid == true) onUnlocked();
            },
            child: const Text('Unlock'),
          ),
        ],
      ),
    );
  }
}

/// One row of the vertical journey timeline: a status node on a connecting
/// rail, with the day card beside it.
class _TimelineDay extends ConsumerWidget {
  const _TimelineDay({
    required this.day,
    required this.isFirst,
    required this.isLast,
    required this.phaseId,
    required this.isPayLocked,
  });

  final PhaseDay day;
  final bool isFirst;
  final bool isLast;
  final String phaseId;
  final bool isPayLocked;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isLocked = isPayLocked;
    final isCompleted = day.status == 'completed';
    final isInProgress = day.status == 'in_progress';

    final nodeColor = isCompleted
        ? const Color(0xFF10B981)
        : isInProgress
        ? Brand.primary
        : isLocked
        ? const Color(0xFFD1D5DB)
        : Brand.primary;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 40,
            child: Column(
              children: [
                // Rail above the node
                Expanded(
                  flex: 0,
                  child: Container(
                    width: 2.5,
                    height: 8,
                    color: isFirst
                        ? Colors.transparent
                        : const Color(0xFFE5E7EB),
                  ),
                ),
                Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isCompleted ? nodeColor : Colors.white,
                    border: Border.all(color: nodeColor, width: 2.5),
                  ),
                  child: isCompleted
                      ? const Icon(Icons.check, size: 15, color: Colors.white)
                      : isLocked
                      ? const Icon(
                          Icons.lock,
                          size: 12,
                          color: Color(0xFF9CA3AF),
                        )
                      : null,
                ),
                Expanded(
                  child: Container(
                    width: 2.5,
                    color: isLast
                        ? Colors.transparent
                        : const Color(0xFFE5E7EB),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Opacity(
                opacity: isLocked ? 0.65 : 1,
                child: BrandCard(
                  padding: EdgeInsets.zero,
                  onTap: isLocked
                      ? () async {
                          final paid = await Navigator.of(context).push<bool>(
                            MaterialPageRoute(
                              builder: (context) => const CheckoutScreen(),
                            ),
                          );
                          if (paid == true) {
                            ref.invalidate(_phaseDaysProvider(phaseId));
                          }
                        }
                      : () => context.push('/day/${day.dayNumber}'),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'DAY ${day.dayNumber}',
                                style: TextStyle(
                                  color: nodeColor,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 11,
                                  letterSpacing: 0.8,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                day.title,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 14.5,
                                  color: Brand.navy,
                                ),
                              ),
                              if (day.estimatedTime.isNotEmpty) ...[
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    const Icon(
                                      Icons.schedule,
                                      size: 13,
                                      color: Brand.textMuted,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      day.estimatedTime,
                                      style: const TextStyle(
                                        color: Brand.textMuted,
                                        fontSize: 12.5,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                        if (isCompleted)
                          const BrandBadge(
                            'Done',
                            background: Color(0xFFD1FAE5),
                            foreground: Color(0xFF047857),
                          )
                        else if (isInProgress)
                          BrandBadge(
                            'In progress',
                            background: Brand.primary.withValues(alpha: 0.1),
                            foreground: Brand.primary,
                          )
                        else if (!isLocked)
                          const Icon(
                            Icons.chevron_right,
                            color: Brand.textMuted,
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

final _phaseDaysProvider = FutureProvider.family<List<PhaseDay>, String>((
  ref,
  phaseId,
) {
  return ref.watch(contentRepositoryProvider).fetchPhaseDays(phaseId);
});
