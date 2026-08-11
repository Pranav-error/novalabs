import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../data/interview_repository.dart';
import 'interview_results_screen.dart';

/// One question at a time, with answers held locally until submit.
///
/// The backend scores the whole session in a single call, so partial progress
/// is deliberately not persisted — leaving mid-session simply abandons it,
/// which is what the "Not finished" state in history reflects.
class InterviewSessionScreen extends ConsumerStatefulWidget {
  const InterviewSessionScreen({super.key, required this.session});

  final InterviewSessionStart session;

  @override
  ConsumerState<InterviewSessionScreen> createState() =>
      _InterviewSessionScreenState();
}

class _InterviewSessionScreenState
    extends ConsumerState<InterviewSessionScreen> {
  final _controller = TextEditingController();
  final Map<String, String> _answers = {};
  int _index = 0;
  bool _submitting = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  List<InterviewQuestion> get _questions => widget.session.questions;
  InterviewQuestion get _current => _questions[_index];

  void _stashAnswer() => _answers[_current.id] = _controller.text.trim();

  void _go(int delta) {
    _stashAnswer();
    setState(() {
      _index = (_index + delta).clamp(0, _questions.length - 1);
      _controller.text = _answers[_current.id] ?? '';
    });
  }

  Future<void> _confirmLeave() async {
    final leave = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Leave the interview?'),
        content: const Text(
          'Your answers will be lost — the session is only scored on submit.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Stay'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Leave'),
          ),
        ],
      ),
    );
    if (leave == true && mounted) Navigator.of(context).pop();
  }

  Future<void> _submit() async {
    _stashAnswer();
    final unanswered = _questions
        .where((q) => (_answers[q.id] ?? '').isEmpty)
        .length;
    if (unanswered > 0) {
      final proceed = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          title: Text(
            '$unanswered question${unanswered == 1 ? '' : 's'} unanswered',
          ),
          content: const Text('Blank answers score zero. Submit anyway?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Go back'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Submit'),
            ),
          ],
        ),
      );
      if (proceed != true) return;
    }

    setState(() => _submitting = true);
    try {
      final (score, xp) = await ref
          .read(interviewRepositoryProvider)
          .submit(widget.session.sessionId, _answers);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Scored $score/100 · +$xp XP')));
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) =>
              InterviewResultsScreen(sessionId: widget.session.sessionId),
        ),
      );
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.response?.data?['detail']?.toString() ??
                'Could not submit your answers.',
          ),
        ),
      );
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLast = _index == _questions.length - 1;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmLeave();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.session.topicName),
          leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: _confirmLeave,
          ),
        ),
        body: SafeArea(
          child: Column(
            children: [
              LinearProgressIndicator(
                value: (_index + 1) / _questions.length,
                backgroundColor: Brand.cardBorder,
                minHeight: 3,
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    Text(
                      'Question ${_index + 1} of ${_questions.length}',
                      style: const TextStyle(
                        color: Brand.textMuted,
                        fontSize: 12.5,
                      ),
                    ),
                    const SizedBox(height: 10),
                    BrandCard(
                      child: Text(
                        _current.question,
                        style: const TextStyle(
                          fontSize: 15.5,
                          height: 1.45,
                          fontWeight: FontWeight.w600,
                          color: Brand.navy,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _controller,
                      maxLines: 9,
                      decoration: const InputDecoration(
                        hintText:
                            'Type your answer as you would say it in an interview…',
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Answers are scored on the concepts they cover, so mention the '
                      'key terms you would use out loud.',
                      style: TextStyle(color: Brand.textMuted, fontSize: 11.5),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: Brand.cardBorder)),
                ),
                child: Row(
                  children: [
                    if (_index > 0)
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _submitting ? null : () => _go(-1),
                          child: const Text('Back'),
                        ),
                      ),
                    if (_index > 0) const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: _submitting
                            ? null
                            : isLast
                            ? _submit
                            : () => _go(1),
                        child: _submitting
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : Text(isLast ? 'Submit answers' : 'Next'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
