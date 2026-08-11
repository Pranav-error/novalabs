import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config.dart';
import '../../../core/screen_protection.dart';
import '../../../core/theme.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../../dashboard/data/content_repository.dart';
import '../../payments/presentation/checkout_screen.dart';
import 'assignment_screen.dart';
import 'quiz_screen.dart';

MarkdownStyleSheet _brandMarkdown(BuildContext context) {
  const body = TextStyle(color: Brand.navy, fontSize: 14.5, height: 1.65);
  return MarkdownStyleSheet(
    p: body,
    listBullet: body,
    h1: const TextStyle(
      color: Brand.navy,
      fontSize: 22,
      fontWeight: FontWeight.w700,
      height: 2,
    ),
    h2: const TextStyle(
      color: Brand.navy,
      fontSize: 18,
      fontWeight: FontWeight.w700,
      height: 2,
    ),
    h3: const TextStyle(
      color: Brand.navy,
      fontSize: 16,
      fontWeight: FontWeight.w600,
      height: 1.8,
    ),
    strong: const TextStyle(fontWeight: FontWeight.w700, color: Brand.navy),
    code: const TextStyle(
      fontFamily: 'monospace',
      fontSize: 13,
      color: Brand.deepBlue,
      backgroundColor: Color(0xFFF1F5F9),
    ),
    codeblockDecoration: BoxDecoration(
      color: const Color(0xFF0F172A),
      borderRadius: BorderRadius.circular(12),
    ),
    codeblockPadding: const EdgeInsets.all(14),
  );
}

class DayDetailScreen extends ConsumerWidget {
  const DayDetailScreen({super.key, required this.dayNumber});

  final int dayNumber;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dayFuture = ref.watch(_dayProvider(dayNumber));

    return Scaffold(
      appBar: AppBar(title: Text('Day $dayNumber')),
      body: dayFuture.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorView(
          error: error,
          title: 'Could not load this day',
          onRetry: () => ref.invalidate(_dayProvider(dayNumber)),
        ),
        data: (day) {
          // A locked day returns only {day_number, title, is_locked,
          // lesson_content: null}. Rendering the normal layout from that gave
          // a blank lesson with no explanation and no way to pay.
          if (day['is_locked'] == true) {
            return _LockedDay(
              dayNumber: dayNumber,
              title: (day['title'] as String?) ?? 'Day $dayNumber',
            );
          }

          final videos = (day['videos'] as List? ?? [])
              .cast<Map<String, dynamic>>();
          final materials = (day['materials'] as List? ?? [])
              .cast<Map<String, dynamic>>();
          final canDownload = day['can_download_materials'] == true;
          final mcqs = (day['mcqs'] as List? ?? [])
              .cast<Map<String, dynamic>>();
          final progress = day['progress'] as Map<String, dynamic>?;
          final quizAttempts = progress?['quiz_attempts'] as int? ?? 0;
          final bestScore = progress?['best_quiz_score'] as int? ?? 0;
          final lessonRead = progress?['scroll_completed'] == true;
          final dayComplete = progress?['status'] == 'completed';

          // Paid lesson content: hidden while an iOS recording is running, and
          // watermarked with the learner's account the rest of the time.
          // Android needs neither — FLAG_SECURE blocks capture outright.
          return ProtectedContent(
            watermark: (day['watermark'] as String?) ?? '',
            protection: ref.watch(screenProtectionProvider),
            child: Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                    children: [
                      Text(
                        day['title'] as String,
                        style: Theme.of(context).textTheme.headlineSmall,
                      ).animate().fadeIn(duration: 300.ms),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          if (day['estimated_time'] != null)
                            BrandBadge(
                              '⏱ ${day['estimated_time']}',
                              background: Brand.primary.withValues(alpha: 0.08),
                              foreground: Brand.deepBlue,
                            ),
                          if (quizAttempts > 0)
                            BrandBadge(
                              'Best quiz: $bestScore/${mcqs.length}',
                              background: const Color(0xFFD1FAE5),
                              foreground: const Color(0xFF047857),
                            ),
                        ],
                      ),
                      if (videos.isNotEmpty) ...[
                        const SizedBox(height: 22),
                        const _SectionHeader(
                          icon: Icons.play_circle_outline,
                          title: 'Class videos',
                        ),
                        const SizedBox(height: 10),
                        for (final (i, video) in videos.indexed) ...[
                          _VideoTile(video: video)
                              .animate(delay: (i * 60).ms)
                              .fadeIn(duration: 280.ms)
                              .slideX(begin: 0.03),
                          const SizedBox(height: 8),
                        ],
                      ],
                      if (materials.isNotEmpty) ...[
                        const SizedBox(height: 22),
                        _SectionHeader(
                          icon: Icons.description_outlined,
                          title: 'Notes & materials',
                          trailing: canDownload
                              ? null
                              : const Text(
                                  'Unlock to download',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Brand.textMuted,
                                  ),
                                ),
                        ),
                        const SizedBox(height: 10),
                        for (final material in materials) ...[
                          _MaterialTile(
                            material: material,
                            canDownload: canDownload,
                          ),
                          const SizedBox(height: 8),
                        ],
                      ],
                      const SizedBox(height: 20),
                      const _SectionHeader(
                        icon: Icons.menu_book_outlined,
                        title: 'Lesson',
                      ),
                      const SizedBox(height: 10),
                      BrandCard(
                        child: MarkdownBody(
                          data: (day['lesson_content'] as String?) ?? '',
                          styleSheet: _brandMarkdown(context),
                        ),
                      ).animate().fadeIn(duration: 350.ms),
                      if (day['assignment_prompt'] != null) ...[
                        const SizedBox(height: 20),
                        const _SectionHeader(
                          icon: Icons.assignment_outlined,
                          title: 'Assignment',
                        ),
                        const SizedBox(height: 10),
                        BrandCard(
                          child: MarkdownBody(
                            data: day['assignment_prompt'] as String,
                            styleSheet: _brandMarkdown(context),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                // What this day still needs. Without it a learner finishes the
                // lesson, sees nothing move, and has no idea why.
                _CompletionBar(
                  dayNumber: dayNumber,
                  lessonRead: lessonRead,
                  quizDone: quizAttempts > 0,
                  dayComplete: dayComplete,
                  bestScore: bestScore,
                  totalQuestions: mcqs.length,
                  onChanged: () => ref.invalidate(_dayProvider(dayNumber)),
                ),
                // Sticky action bar: the day's two key actions are always a
                // thumb-reach away instead of buried at the end of the lesson.
                if (day['assignment_prompt'] != null || mcqs.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.06),
                          blurRadius: 14,
                          offset: const Offset(0, -4),
                        ),
                      ],
                    ),
                    child: SafeArea(
                      top: false,
                      child: Row(
                        children: [
                          if (day['assignment_prompt'] != null)
                            Expanded(
                              child: OutlinedButton.icon(
                                icon: const Icon(
                                  Icons.assignment_outlined,
                                  size: 18,
                                ),
                                label: const Text('Assignment'),
                                onPressed: () => Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (context) => AssignmentScreen(
                                      dayNumber: dayNumber,
                                      assignmentType:
                                          day['assignment_type'] as String,
                                      starterCode:
                                          day['starter_code'] as String?,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          if (day['assignment_prompt'] != null &&
                              mcqs.isNotEmpty)
                            const SizedBox(width: 12),
                          if (mcqs.isNotEmpty)
                            Expanded(
                              child: FilledButton.icon(
                                icon: const Icon(Icons.quiz_outlined, size: 18),
                                label: Text(
                                  quizAttempts > 0
                                      ? 'Retake quiz'
                                      : 'Take quiz',
                                ),
                                onPressed: () => Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (context) => QuizScreen(
                                      dayNumber: dayNumber,
                                      mcqs: mcqs,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.icon,
    required this.title,
    this.trailing,
  });

  final IconData icon;
  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: Brand.primary),
        const SizedBox(width: 8),
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        if (trailing != null) ...[const Spacer(), trailing!],
      ],
    );
  }
}

class _VideoTile extends StatelessWidget {
  const _VideoTile({required this.video});

  final Map<String, dynamic> video;

  Future<void> _open() async {
    final url = video['video_url'] as String?;
    if (url == null) return;
    final uri = Uri.tryParse(url);
    if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return BrandCard(
      padding: EdgeInsets.zero,
      onTap: _open,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: Brand.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.play_arrow_rounded,
                color: Brand.primary,
                size: 26,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    video['title'] as String? ?? 'Lesson video',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      color: Brand.navy,
                    ),
                  ),
                  if (video['duration_minutes'] != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      '${video['duration_minutes']} min',
                      style: const TextStyle(
                        color: Brand.textMuted,
                        fontSize: 12.5,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const Icon(Icons.open_in_new, size: 16, color: Brand.textMuted),
          ],
        ),
      ),
    );
  }
}

final _dayProvider = FutureProvider.family<Map<String, dynamic>, int>((
  ref,
  dayNumber,
) {
  return ref.watch(contentRepositoryProvider).fetchDay(dayNumber);
});

/// A note/PPT/PDF attached to the day.
///
/// Everyone entitled to see the day can open the file; only learners the
/// server issued a `download_url` to (i.e. who have paid) get the save action.
class _MaterialTile extends StatelessWidget {
  const _MaterialTile({required this.material, required this.canDownload});

  final Map<String, dynamic> material;
  final bool canDownload;

  IconData get _icon {
    final type = (material['file_type'] as String? ?? '').toLowerCase();
    if (type == 'ppt' || type == 'pptx') return Icons.slideshow_rounded;
    if (type == 'zip') return Icons.folder_zip_outlined;
    if (type == 'pdf') return Icons.picture_as_pdf_outlined;
    return Icons.description_outlined;
  }

  String get _size {
    final bytes = (material['file_size_bytes'] as num?)?.toInt() ?? 0;
    if (bytes >= 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    if (bytes >= 1024) return '${(bytes / 1024).round()} KB';
    return '$bytes B';
  }

  Future<void> _open(BuildContext context, String? path) async {
    if (path == null) return;
    final base = apiBaseUrl;
    final uri = Uri.parse(path.startsWith('/') ? '$base$path' : path);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open this file')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final downloadUrl = material['download_url'] as String?;
    return BrandCard(
      onTap: () => _open(context, material['file_url'] as String?),
      child: Row(
        children: [
          Icon(_icon, size: 20, color: Brand.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  material['title'] as String? ?? 'Material',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: Brand.navy,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${(material['file_type'] as String? ?? '').toUpperCase()} · $_size',
                  style: const TextStyle(
                    color: Brand.textMuted,
                    fontSize: 11.5,
                  ),
                ),
              ],
            ),
          ),
          if (downloadUrl != null)
            IconButton(
              tooltip: 'Download',
              onPressed: () => _open(context, downloadUrl),
              icon: const Icon(Icons.download_rounded, size: 20),
              color: Brand.primary,
            )
          else
            const Icon(
              Icons.lock_outline_rounded,
              size: 17,
              color: Brand.textMuted,
            ),
        ],
      ),
    );
  }
}

/// The two requirements for completing a day, and a control for the one the
/// learner can act on directly.
///
/// The backend completes a day only when `scroll_completed` AND at least one
/// quiz attempt are both true. `scroll_completed` is set solely by
/// /days/{n}/mark-viewed, which no client ever called — so this bar is what
/// makes completion reachable on mobile at all.
class _CompletionBar extends ConsumerStatefulWidget {
  const _CompletionBar({
    required this.dayNumber,
    required this.lessonRead,
    required this.quizDone,
    required this.dayComplete,
    required this.bestScore,
    required this.totalQuestions,
    required this.onChanged,
  });

  final int dayNumber;
  final bool lessonRead;
  final bool quizDone;
  final bool dayComplete;
  final int bestScore;
  final int totalQuestions;
  final VoidCallback onChanged;

  @override
  ConsumerState<_CompletionBar> createState() => _CompletionBarState();
}

class _CompletionBarState extends ConsumerState<_CompletionBar> {
  bool _saving = false;

  Future<void> _markRead() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      await ref.read(contentRepositoryProvider).markViewed(widget.dayNumber);
      widget.onChanged();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(friendlyError(error))),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.dayComplete) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
        color: const Color(0xFFD1FAE5),
        child: Row(
          children: [
            const Icon(Icons.check_circle, size: 18, color: Color(0xFF047857)),
            const SizedBox(width: 8),
            Text(
              'Day ${widget.dayNumber} complete — nice work!',
              style: const TextStyle(
                color: Color(0xFF047857),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
      color: const Color(0xFFF8FAFC),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Finish Day ${widget.dayNumber}',
            style: const TextStyle(
              color: Brand.navy,
              fontWeight: FontWeight.w700,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _Tick(done: widget.lessonRead, label: 'Read the lesson'),
              const Spacer(),
              if (!widget.lessonRead)
                TextButton(
                  onPressed: _saving ? null : _markRead,
                  child: Text(_saving ? 'Saving…' : 'Mark as read'),
                ),
            ],
          ),
          _Tick(
            done: widget.quizDone,
            label: widget.quizDone && widget.totalQuestions > 0
                ? 'Attempt the quiz — best ${widget.bestScore}/${widget.totalQuestions}'
                : 'Attempt the quiz',
          ),
        ],
      ),
    );
  }
}

class _Tick extends StatelessWidget {
  const _Tick({required this.done, required this.label});

  final bool done;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Icon(
            done ? Icons.check_circle : Icons.circle_outlined,
            size: 16,
            color: done ? const Color(0xFF047857) : Colors.black26,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                color: done ? const Color(0xFF047857) : Colors.black87,
              ),
            ),
          ),
        ],
      ),
    );
  }
}


/// Paywall for a day the learner has not unlocked.
class _LockedDay extends StatelessWidget {
  const _LockedDay({required this.dayNumber, required this.title});

  final int dayNumber;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.lock_outline, size: 44, color: Colors.black26),
            const SizedBox(height: 16),
            BrandBadge(
              'Day $dayNumber',
              background: Brand.primary.withValues(alpha: 0.08),
              foreground: Brand.deepBlue,
            ),
            const SizedBox(height: 10),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 10),
            const Text(
              'Unlock all 30 days to open this lesson, its quiz and the assignment.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Brand.textMuted, fontSize: 13.5),
            ),
            const SizedBox(height: 22),
            FilledButton.icon(
              icon: const Icon(Icons.lock_open_outlined, size: 18),
              label: const Text('Unlock all 30 days'),
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const CheckoutScreen()),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
