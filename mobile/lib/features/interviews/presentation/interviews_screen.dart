import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../data/interview_repository.dart';
import 'interview_session_screen.dart';
import 'interview_results_screen.dart';

/// Entry point: pick a topic to practise, or revisit a past session.
class InterviewsScreen extends ConsumerStatefulWidget {
  const InterviewsScreen({super.key});

  @override
  ConsumerState<InterviewsScreen> createState() => _InterviewsScreenState();
}

class _InterviewsScreenState extends ConsumerState<InterviewsScreen> {
  bool _loading = true;
  String? _error;
  List<InterviewTopic> _topics = [];
  List<PastSession> _history = [];
  String? _starting;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(interviewRepositoryProvider);
      final topics = await repo.topics();
      final history = await repo.history();
      setState(() {
        _topics = topics;
        _history = history;
      });
    } on DioException catch (e) {
      setState(
        () => _error =
            e.response?.data?['detail']?.toString() ??
            'Could not load mock interviews.',
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _start(InterviewTopic topic) async {
    setState(() => _starting = topic.id);
    try {
      final session = await ref
          .read(interviewRepositoryProvider)
          .start(topic.id);
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => InterviewSessionScreen(session: session),
        ),
      );
      _load(); // history changes once a session completes
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.response?.data?['detail']?.toString() ??
                'Could not start the interview.',
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _starting = null);
    }
  }

  Color _scoreColor(int score) {
    if (score >= 70) return const Color(0xFF059669);
    if (score >= 40) return const Color(0xFFD97706);
    return const Color(0xFFB91C1C);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mock interviews')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  if (_error != null)
                    BrandCard(
                      child: Column(
                        children: [
                          Text(
                            _error!,
                            style: const TextStyle(
                              color: Brand.textMuted,
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(height: 12),
                          FilledButton(
                            onPressed: _load,
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    )
                  else ...[
                    const Text(
                      'Practise real interview questions and get instant feedback '
                      'on what your answer covered.',
                      style: TextStyle(color: Brand.textMuted, fontSize: 13.5),
                    ),
                    const SizedBox(height: 18),
                    Text(
                      'Choose a topic',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 12),
                    ..._topics.map(
                      (t) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: BrandCard(
                          onTap: _starting == null ? () => _start(t) : null,
                          child: Row(
                            children: [
                              Container(
                                width: 38,
                                height: 38,
                                decoration: BoxDecoration(
                                  color: Brand.primary.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(11),
                                ),
                                child: const Icon(
                                  Icons.record_voice_over_outlined,
                                  size: 19,
                                  color: Brand.primary,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      t.name,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 14,
                                        color: Brand.navy,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '${t.questionCount} questions in the bank',
                                      style: const TextStyle(
                                        color: Brand.textMuted,
                                        fontSize: 11.5,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (_starting == t.id)
                                const SizedBox(
                                  height: 18,
                                  width: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              else
                                const Icon(
                                  Icons.chevron_right,
                                  color: Brand.textMuted,
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    if (_history.isNotEmpty) ...[
                      const SizedBox(height: 22),
                      Text(
                        'Past sessions',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 12),
                      ..._history.map(
                        (s) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: BrandCard(
                            onTap: s.status == 'completed'
                                ? () => Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (_) => InterviewResultsScreen(
                                        sessionId: s.sessionId,
                                      ),
                                    ),
                                  )
                                : null,
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        s.topicName,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                          fontSize: 13.5,
                                          color: Brand.navy,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        s.status == 'completed'
                                            ? 'Completed'
                                            : 'Not finished',
                                        style: const TextStyle(
                                          color: Brand.textMuted,
                                          fontSize: 11.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                if (s.totalScore != null)
                                  BrandBadge(
                                    '${s.totalScore}/100',
                                    background: _scoreColor(
                                      s.totalScore!,
                                    ).withValues(alpha: 0.12),
                                    foreground: _scoreColor(s.totalScore!),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ],
              ),
      ),
    );
  }
}
