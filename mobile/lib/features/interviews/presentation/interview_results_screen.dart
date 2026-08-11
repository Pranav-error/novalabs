import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../data/interview_repository.dart';

class InterviewResultsScreen extends ConsumerStatefulWidget {
  const InterviewResultsScreen({super.key, required this.sessionId});

  final String sessionId;

  @override
  ConsumerState<InterviewResultsScreen> createState() =>
      _InterviewResultsScreenState();
}

class _InterviewResultsScreenState
    extends ConsumerState<InterviewResultsScreen> {
  bool _loading = true;
  String? _error;
  InterviewResults? _results;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await ref
          .read(interviewRepositoryProvider)
          .results(widget.sessionId);
      setState(() => _results = r);
    } on DioException catch (e) {
      setState(
        () => _error =
            e.response?.data?['detail']?.toString() ??
            'Could not load these results.',
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Color _colorFor(int outOfTen) {
    if (outOfTen >= 7) return const Color(0xFF059669);
    if (outOfTen >= 4) return const Color(0xFFD97706);
    return const Color(0xFFB91C1C);
  }

  @override
  Widget build(BuildContext context) {
    final r = _results;
    return Scaffold(
      appBar: AppBar(title: const Text('Results')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Brand.textMuted),
                ),
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                BrandCard(
                  gradient: Brand.brandingGradient,
                  padding: const EdgeInsets.all(22),
                  child: Column(
                    children: [
                      Text(
                        r!.topicName,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.75),
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${r.totalScore}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 42,
                          fontWeight: FontWeight.w800,
                          height: 1,
                        ),
                      ),
                      Text(
                        'out of 100',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.7),
                          fontSize: 12.5,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 22),
                Text(
                  'Question breakdown',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                ...r.results.map(
                  (q) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: BrandCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Text(
                                  q.question,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                    color: Brand.navy,
                                    height: 1.35,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              BrandBadge(
                                '${q.score}/10',
                                background: _colorFor(
                                  q.score,
                                ).withValues(alpha: 0.12),
                                foreground: _colorFor(q.score),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Text(
                            q.feedback,
                            style: const TextStyle(
                              color: Brand.textMuted,
                              fontSize: 12.5,
                              height: 1.4,
                            ),
                          ),
                          if (q.keywordsHit.isNotEmpty ||
                              q.keywordsMissed.isNotEmpty) ...[
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: [
                                ...q.keywordsHit.map(
                                  (k) => BrandBadge(
                                    '✓ $k',
                                    background: const Color(0xFFD1FAE5),
                                    foreground: const Color(0xFF047857),
                                  ),
                                ),
                                ...q.keywordsMissed.map(
                                  (k) => BrandBadge(
                                    k,
                                    background: const Color(0xFFF3F4F6),
                                    foreground: Brand.textMuted,
                                  ),
                                ),
                              ],
                            ),
                          ],
                          const SizedBox(height: 12),
                          _Collapsible(
                            title: 'Your answer',
                            body: q.yourAnswer.isEmpty
                                ? '(left blank)'
                                : q.yourAnswer,
                          ),
                          const SizedBox(height: 6),
                          _Collapsible(
                            title: 'Model answer',
                            body: q.modelAnswer,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}

class _Collapsible extends StatefulWidget {
  const _Collapsible({required this.title, required this.body});
  final String title;
  final String body;

  @override
  State<_Collapsible> createState() => _CollapsibleState();
}

class _CollapsibleState extends State<_Collapsible> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: () => setState(() => _open = !_open),
          child: Row(
            children: [
              Text(
                widget.title,
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: Brand.primary,
                ),
              ),
              Icon(
                _open ? Icons.expand_less : Icons.expand_more,
                size: 17,
                color: Brand.primary,
              ),
            ],
          ),
        ),
        if (_open)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              widget.body,
              style: const TextStyle(
                fontSize: 13,
                height: 1.45,
                color: Brand.navy,
              ),
            ),
          ),
      ],
    );
  }
}
