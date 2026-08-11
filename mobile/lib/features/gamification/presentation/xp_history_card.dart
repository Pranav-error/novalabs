import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../../auth/presentation/auth_controller.dart';

final xpHistoryProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
      try {
        final res = await ref.read(apiClientProvider).dio.get('/me/xp');
        return ((res.data['recent_events'] as List?) ?? [])
            .cast<Map<String, dynamic>>()
            .take(8)
            .toList();
      } on DioException {
        return [];
      }
    });

/// Human labels for the XP reasons the backend emits.
const _reasonLabels = <String, String>{
  'daily_login': 'Daily login',
  'day_complete': 'Day completed',
  'quiz_pass': 'Quiz passed',
  'perfect_quiz': 'Perfect quiz',
  'assignment_submit': 'Assignment submitted',
  'community_post': 'Community post',
  'doubt_reply': 'Helped with a doubt',
  'referral_convert': 'Referral converted',
  'streak_bonus': 'Streak bonus',
};

class XpHistoryCard extends ConsumerWidget {
  const XpHistoryCard({super.key});

  String _ago(String? iso) {
    final t = DateTime.tryParse(iso ?? '');
    if (t == null) return '';
    final d = DateTime.now().difference(t.toLocal());
    if (d.inMinutes < 60) return '${d.inMinutes}m ago';
    if (d.inHours < 24) return '${d.inHours}h ago';
    if (d.inDays < 7) return '${d.inDays}d ago';
    return '${t.day}/${t.month}';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final events = ref.watch(xpHistoryProvider).valueOrNull ?? [];
    if (events.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 24),
        Text('Recent activity', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        BrandCard(
          child: Column(
            children: [
              for (final (i, e) in events.indexed) ...[
                if (i > 0) const Divider(height: 18, color: Brand.cardBorder),
                Row(
                  children: [
                    const Icon(
                      Icons.star_rounded,
                      size: 16,
                      color: Brand.primary,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _reasonLabels[e['reason']] ??
                            (e['reason'] ?? 'XP earned').toString().replaceAll(
                              '_',
                              ' ',
                            ),
                        style: const TextStyle(
                          fontSize: 13.5,
                          color: Brand.navy,
                        ),
                      ),
                    ),
                    Text(
                      '+${(e['amount'] as num?)?.toInt() ?? 0}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: Brand.primary,
                      ),
                    ),
                    const SizedBox(width: 10),
                    SizedBox(
                      width: 58,
                      child: Text(
                        _ago(e['created_at'] as String?),
                        textAlign: TextAlign.right,
                        style: const TextStyle(
                          color: Brand.textMuted,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
