import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../../auth/presentation/auth_controller.dart';

/// Latest announcements. Failures resolve to an empty list rather than an
/// error, so a flaky fetch can't put a red banner on the dashboard.
final announcementsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
      try {
        final res = await ref.read(apiClientProvider).dio.get('/announcements');
        return ((res.data['announcements'] as List?) ?? [])
            .cast<Map<String, dynamic>>()
            .take(3)
            .toList();
      } on DioException {
        return [];
      }
    });

class AnnouncementsCard extends ConsumerWidget {
  const AnnouncementsCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(announcementsProvider).valueOrNull ?? [];
    if (items.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.campaign_rounded, size: 18, color: Brand.primary),
            const SizedBox(width: 8),
            Text(
              'Announcements',
              style: Theme.of(context).textTheme.titleLarge,
            ),
          ],
        ),
        const SizedBox(height: 12),
        ...items.map((a) {
          final critical = a['urgency'] == 'critical';
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: BrandCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 3,
                    height: 34,
                    decoration: BoxDecoration(
                      color: critical ? Brand.pink : Brand.primary,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          (a['title'] ?? '').toString(),
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                            color: Brand.navy,
                          ),
                        ),
                        if ((a['body'] ?? '').toString().isNotEmpty) ...[
                          const SizedBox(height: 3),
                          Text(
                            a['body'].toString(),
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Brand.textMuted,
                              fontSize: 13,
                              height: 1.35,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (critical)
                    const BrandBadge(
                      'Important',
                      background: Color(0xFFFEE2E2),
                      foreground: Color(0xFFB91C1C),
                    ),
                ],
              ),
            ),
          );
        }),
        const SizedBox(height: 12),
      ],
    );
  }
}
