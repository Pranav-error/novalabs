import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../../progress/data/progress_repository.dart';

/// Stepped quiz: one question per screen with a progress rail on top,
/// then a score screen with per-question review.
class QuizScreen extends ConsumerStatefulWidget {
  const QuizScreen({super.key, required this.dayNumber, required this.mcqs});

  final int dayNumber;
  final List<Map<String, dynamic>> mcqs;

  @override
  ConsumerState<QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends ConsumerState<QuizScreen> {
  final Map<String, int> _answers = {};
  int _currentIndex = 0;
  bool _isSubmitting = false;
  Map<String, dynamic>? _result;
  String? _errorMessage;

  int get _total => widget.mcqs.length;
  Map<String, dynamic> get _currentMcq => widget.mcqs[_currentIndex];
  String get _currentId => _currentMcq['id'] as String;

  void _select(int option) {
    HapticFeedback.selectionClick();
    setState(() => _answers[_currentId] = option);
  }

  void _next() {
    if (_currentIndex < _total - 1) {
      HapticFeedback.lightImpact();
      setState(() => _currentIndex++);
    } else {
      _submit();
    }
  }

  void _previous() {
    if (_currentIndex > 0) setState(() => _currentIndex--);
  }

  Future<void> _submit() async {
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    try {
      final result = await ref
          .read(progressRepositoryProvider)
          .submitQuiz(widget.dayNumber, _answers);
      HapticFeedback.mediumImpact();
      setState(() => _result = result);
    } on DioException catch (e) {
      setState(() {
        _errorMessage =
            e.response?.data?['detail']?.toString() ?? 'Could not submit quiz.';
      });
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;
    if (result != null) {
      return _ResultsView(
        dayNumber: widget.dayNumber,
        mcqs: widget.mcqs,
        answers: _answers,
        result: result,
      );
    }

    final selected = _answers[_currentId];
    final options = (_currentMcq['options'] as List).cast<String>();

    return Scaffold(
      appBar: AppBar(
        title: Text('Question ${_currentIndex + 1} of $_total'),
        leading: _currentIndex > 0
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: _previous,
              )
            : null,
      ),
      body: Column(
        children: [
          // Progress rail
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: TweenAnimationBuilder<double>(
                tween: Tween(end: (_currentIndex + 1) / _total),
                duration: 300.ms,
                curve: Curves.easeOut,
                builder: (context, value, _) => LinearProgressIndicator(
                  value: value,
                  minHeight: 6,
                  backgroundColor: const Color(0xFFF3F4F6),
                  valueColor: const AlwaysStoppedAnimation(Brand.primary),
                ),
              ),
            ),
          ),
          Expanded(
            child: AnimatedSwitcher(
              duration: 250.ms,
              switchInCurve: Curves.easeOut,
              transitionBuilder: (child, animation) => FadeTransition(
                opacity: animation,
                child: SlideTransition(
                  position: Tween(
                    begin: const Offset(0.06, 0),
                    end: Offset.zero,
                  ).animate(animation),
                  child: child,
                ),
              ),
              child: ListView(
                key: ValueKey(_currentIndex),
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
                children: [
                  Text(
                    _currentMcq['question_text'] as String,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 19,
                      color: Brand.navy,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 20),
                  for (var i = 0; i < options.length; i++) ...[
                    _OptionTile(
                      label: options[i],
                      isSelected: selected == i,
                      onTap: () => _select(i),
                    ),
                    const SizedBox(height: 10),
                  ],
                  if (_errorMessage != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(
                          color: Color(0xFFB91C1C),
                          fontSize: 13.5,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 12,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: FilledButton(
                onPressed: (selected == null || _isSubmitting) ? null : _next,
                child: _isSubmitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(
                        _currentIndex == _total - 1 ? 'Submit quiz' : 'Next',
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile({
    required this.label,
    required this.isSelected,
    this.onTap,
    this.state = _OptionState.neutral,
  });

  final String label;
  final bool isSelected;
  final VoidCallback? onTap;
  final _OptionState state;

  @override
  Widget build(BuildContext context) {
    final (background, border, foreground) = switch (state) {
      _OptionState.correct => (
        const Color(0xFFD1FAE5),
        const Color(0xFF6EE7B7),
        const Color(0xFF047857),
      ),
      _OptionState.wrong => (
        const Color(0xFFFEE2E2),
        const Color(0xFFFCA5A5),
        const Color(0xFFB91C1C),
      ),
      _OptionState.neutral when isSelected => (
        Brand.primary.withValues(alpha: 0.08),
        Brand.primary,
        Brand.primary,
      ),
      _OptionState.neutral => (
        Colors.white,
        const Color(0xFFE5E7EB),
        Brand.navy,
      ),
    };

    return AnimatedContainer(
      duration: 150.ms,
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: border, width: isSelected ? 1.8 : 1),
        boxShadow: isSelected
            ? [
                BoxShadow(
                  color: Brand.primary.withValues(alpha: 0.12),
                  blurRadius: 10,
                  offset: const Offset(0, 3),
                ),
              ]
            : null,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
            child: Row(
              children: [
                Icon(
                  switch (state) {
                    _OptionState.correct => Icons.check_circle_rounded,
                    _OptionState.wrong => Icons.cancel_rounded,
                    _OptionState.neutral when isSelected =>
                      Icons.radio_button_checked,
                    _OptionState.neutral => Icons.radio_button_off,
                  },
                  size: 20,
                  color: foreground,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      color: foreground,
                      fontSize: 14.5,
                      height: 1.4,
                      fontWeight: isSelected
                          ? FontWeight.w600
                          : FontWeight.w400,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

enum _OptionState { neutral, correct, wrong }

class _ResultsView extends StatelessWidget {
  const _ResultsView({
    required this.dayNumber,
    required this.mcqs,
    required this.answers,
    required this.result,
  });

  final int dayNumber;
  final List<Map<String, dynamic>> mcqs;
  final Map<String, int> answers;
  final Map<String, dynamic> result;

  @override
  Widget build(BuildContext context) {
    final score = result['score'] as int;
    final total = result['total'] as int;
    final xp = result['xp_awarded'] as int;
    final fraction = total == 0 ? 0.0 : score / total;
    final isGood = fraction >= 0.8;
    final results = (result['results'] as List).cast<Map<String, dynamic>>();

    return Scaffold(
      appBar: AppBar(title: Text('Day $dayNumber quiz')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        children: [
          // Score ring
          Center(
            child: SizedBox(
              width: 150,
              height: 150,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: fraction),
                    duration: 900.ms,
                    curve: Curves.easeOutCubic,
                    builder: (context, value, _) => CircularProgressIndicator(
                      value: value,
                      strokeWidth: 10,
                      strokeCap: StrokeCap.round,
                      backgroundColor: const Color(0xFFF3F4F6),
                      valueColor: AlwaysStoppedAnimation(
                        isGood ? const Color(0xFF10B981) : Brand.primary,
                      ),
                    ),
                  ),
                  Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          '$score/$total',
                          style: const TextStyle(
                            fontSize: 30,
                            fontWeight: FontWeight.w800,
                            color: Brand.navy,
                          ),
                        ),
                        Text(
                          '+$xp XP',
                          style: const TextStyle(
                            color: Brand.primary,
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ).animate().scale(
            begin: const Offset(0.8, 0.8),
            duration: 400.ms,
            curve: Curves.easeOutBack,
          ),
          const SizedBox(height: 12),
          Center(
            child: Text(
              isGood
                  ? 'Excellent work! 🎉'
                  : score >= total / 2
                  ? 'Good effort — review the misses below.'
                  : 'Keep going — revisit the lesson and retry.',
              style: const TextStyle(color: Brand.textMuted, fontSize: 14),
            ),
          ),
          const SizedBox(height: 24),
          Text('Review', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          for (final (i, mcq) in mcqs.indexed) ...[
            _ReviewCard(
                  index: i + 1,
                  mcq: mcq,
                  selected: answers[mcq['id'] as String],
                  resultForQuestion: results.firstWhere(
                    (r) => r['question_id'] == mcq['id'],
                    orElse: () => const {},
                  ),
                )
                .animate(delay: (i * 50).ms)
                .fadeIn(duration: 280.ms)
                .slideY(begin: 0.04),
            const SizedBox(height: 12),
          ],
          FilledButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Back to lesson'),
          ),
        ],
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({
    required this.index,
    required this.mcq,
    required this.selected,
    required this.resultForQuestion,
  });

  final int index;
  final Map<String, dynamic> mcq;
  final int? selected;
  final Map<String, dynamic> resultForQuestion;

  @override
  Widget build(BuildContext context) {
    final options = (mcq['options'] as List).cast<String>();
    final correctIndex = resultForQuestion['correct'] as int?;
    final isCorrect = resultForQuestion['is_correct'] == true;

    return BrandCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                isCorrect ? Icons.check_circle_rounded : Icons.cancel_rounded,
                size: 19,
                color: isCorrect
                    ? const Color(0xFF10B981)
                    : const Color(0xFFEF4444),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '$index. ${mcq['question_text']}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: Brand.navy,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          for (var i = 0; i < options.length; i++)
            if (i == correctIndex || i == selected)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _OptionTile(
                  label: options[i],
                  isSelected: i == selected,
                  state: i == correctIndex
                      ? _OptionState.correct
                      : _OptionState.wrong,
                ),
              ),
          if (resultForQuestion['explanation'] != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Brand.cyan.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.lightbulb_outline,
                    size: 16,
                    color: Brand.deepBlue,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      resultForQuestion['explanation'] as String,
                      style: const TextStyle(
                        color: Brand.deepBlue,
                        fontSize: 12.5,
                        height: 1.5,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
