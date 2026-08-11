import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../data/gamification_repository.dart';

class LeaderboardScreen extends StatelessWidget {
  const LeaderboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Leaderboard'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'This week'),
              Tab(text: 'All time'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            _LeaderboardList(weekly: true),
            _LeaderboardList(weekly: false),
          ],
        ),
      ),
    );
  }
}

class _LeaderboardList extends ConsumerWidget {
  const _LeaderboardList({required this.weekly});
  final bool weekly;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final leaderboardFuture = ref.watch(_leaderboardProvider(weekly));

    return leaderboardFuture.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => ErrorView(
        error: error,
        title: 'Could not load the leaderboard',
        onRetry: () => ref.invalidate(_leaderboardProvider),
      ),
      data: (data) {
        final leaders = (data['leaderboard'] as List)
            .cast<Map<String, dynamic>>();
        final myRank = data['my_rank'] as int?;
        final myXp = data['my_xp'] as int;

        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(_leaderboardProvider(weekly)),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            children: [
              BrandCard(
                gradient: Brand.heroGradient,
                padding: const EdgeInsets.all(20),
                child: Row(
                  children: [
                    const Icon(
                      Icons.emoji_events_rounded,
                      color: Brand.cyan,
                      size: 34,
                    ),
                    const SizedBox(width: 14),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          myRank != null
                              ? 'Your rank: #$myRank'
                              : 'Not ranked yet',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 17,
                          ),
                        ),
                        Text(
                          '$myXp XP ${weekly ? 'this week' : 'all time'}',
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              if (leaders.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: Center(
                    child: Text(
                      'No activity yet — be the first!',
                      style: TextStyle(color: Brand.textMuted),
                    ),
                  ),
                ),
              for (final entry in leaders) ...[
                _LeaderTile(entry: entry),
                const SizedBox(height: 8),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _LeaderTile extends StatelessWidget {
  const _LeaderTile({required this.entry});
  final Map<String, dynamic> entry;

  static const _podium = {
    1: (Color(0xFFFEF3C7), Color(0xFFB45309)), // gold
    2: (Color(0xFFF1F5F9), Color(0xFF475569)), // silver
    3: (Color(0xFFFFEDD5), Color(0xFFC2410C)), // bronze
  };

  @override
  Widget build(BuildContext context) {
    final rank = entry['rank'] as int;
    final isMe = entry['is_me'] == true;
    final (chipBg, chipFg) =
        _podium[rank] ?? (Brand.primary.withValues(alpha: 0.08), Brand.primary);

    return Container(
      decoration: BoxDecoration(
        color: isMe ? Brand.primary.withValues(alpha: 0.07) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isMe ? Brand.primary.withValues(alpha: 0.4) : Brand.cardBorder,
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: chipBg, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: rank <= 3
                ? Icon(Icons.emoji_events_rounded, size: 18, color: chipFg)
                : Text(
                    '$rank',
                    style: TextStyle(
                      color: chipFg,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              '${entry['name']}${isMe ? '  (you)' : ''}',
              style: TextStyle(
                fontWeight: isMe ? FontWeight.w700 : FontWeight.w600,
                fontSize: 14,
                color: Brand.navy,
              ),
            ),
          ),
          BrandBadge(
            '${entry['xp']} XP',
            background: Brand.cyan.withValues(alpha: 0.15),
            foreground: Brand.deepBlue,
          ),
        ],
      ),
    );
  }
}

final _leaderboardProvider = FutureProvider.family<Map<String, dynamic>, bool>((
  ref,
  weekly,
) {
  return ref
      .watch(gamificationRepositoryProvider)
      .fetchLeaderboard(weekly: weekly);
});
