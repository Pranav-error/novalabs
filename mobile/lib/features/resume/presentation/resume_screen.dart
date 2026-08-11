import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/theme.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../data/resume_repository.dart';

/// Resume builder.
///
/// The auto section (XP, days, projects, skills) is derived from challenge
/// progress and read-only; everything below it is the learner's own and saved
/// with a partial PATCH.
class ResumeScreen extends ConsumerStatefulWidget {
  const ResumeScreen({super.key});

  @override
  ConsumerState<ResumeScreen> createState() => _ResumeScreenState();
}

class _ResumeScreenState extends ConsumerState<ResumeScreen> {
  final _headline = TextEditingController();
  final _summary = TextEditingController();
  final _skills = TextEditingController();

  bool _loading = true;
  bool _saving = false;
  bool _analyzing = false;
  bool _exporting = false;
  String? _error;
  ResumeAuto? _auto;
  List<Map<String, String>> _experience = [];
  List<Map<String, String>> _education = [];
  ResumeAnalysis? _analysis;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _headline.dispose();
    _summary.dispose();
    _skills.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final (auto, editable) = await ref.read(resumeRepositoryProvider).fetch();
      setState(() {
        _auto = auto;
        _headline.text = editable.headline;
        _summary.text = editable.summary;
        _skills.text = editable.customSkills.join(', ');
        _experience = List.of(editable.experience);
        _education = List.of(editable.education);
      });
    } on DioException catch (e) {
      setState(
        () => _error =
            e.response?.data?['detail']?.toString() ??
            'Could not load your resume.',
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref.read(resumeRepositoryProvider).save({
        'headline': _headline.text.trim(),
        'summary': _summary.text.trim(),
        'experience': _experience,
        'education': _education,
        'custom_skills': _skills.text
            .split(',')
            .map((s) => s.trim())
            .where((s) => s.isNotEmpty)
            .toList(),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Resume saved')));
      // The score depends on what was just saved, so refresh it if shown.
      if (_analysis != null) _analyze();
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.response?.data?['detail']?.toString() ??
                'Could not save your resume.',
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  /// Exports the resume as JSON and hands it to the OS share sheet, so it can
  /// go to Files, email or anywhere else. Saving directly to disk would need a
  /// storage permission on Android for no real gain.
  Future<void> _export() async {
    setState(() => _exporting = true);
    try {
      final data = await ref.read(resumeRepositoryProvider).exportJson();
      final pretty = const JsonEncoder.withIndent('  ').convert(data);
      await Share.share(pretty, subject: 'My NOVA LABS resume (JSON)');
    } on DioException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not export your resume')),
      );
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _analyze() async {
    setState(() => _analyzing = true);
    try {
      final a = await ref.read(resumeRepositoryProvider).analyze();
      setState(() => _analysis = a);
    } on DioException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not analyse your resume')),
      );
    } finally {
      if (mounted) setState(() => _analyzing = false);
    }
  }

  Future<void> _editEntry({
    required String title,
    required List<String> fields,
    Map<String, String>? existing,
    required void Function(Map<String, String>) onSave,
  }) async {
    final controllers = {
      for (final f in fields)
        f: TextEditingController(text: existing?[f] ?? ''),
    };
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 14),
            for (final f in fields) ...[
              Text(
                _label(f),
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Brand.textMuted,
                ),
              ),
              const SizedBox(height: 4),
              TextField(
                controller: controllers[f],
                maxLines: f == 'description' ? 3 : 1,
              ),
              const SizedBox(height: 12),
            ],
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Done'),
            ),
          ],
        ),
      ),
    );
    if (saved == true) {
      onSave({for (final f in fields) f: controllers[f]!.text.trim()});
    }
    for (final c in controllers.values) {
      c.dispose();
    }
  }

  String _label(String field) =>
      field[0].toUpperCase() + field.substring(1).replaceAll('_', ' ');

  Color _scoreColor(int s) {
    if (s >= 70) return const Color(0xFF059669);
    if (s >= 40) return const Color(0xFFD97706);
    return const Color(0xFFB91C1C);
  }

  @override
  Widget build(BuildContext context) {
    final auto = _auto;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Resume'),
        actions: [
          TextButton(
            onPressed: _saving || _loading ? null : _save,
            child: Text(_saving ? 'Saving…' : 'Save'),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Brand.textMuted),
                    ),
                    const SizedBox(height: 12),
                    FilledButton(onPressed: _load, child: const Text('Retry')),
                  ],
                ),
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                // ── Analysis ───────────────────────────────────────────
                if (_analysis != null) ...[
                  BrandCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              'Resume score',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const Spacer(),
                            BrandBadge(
                              '${_analysis!.score}/100',
                              background: _scoreColor(
                                _analysis!.score,
                              ).withValues(alpha: 0.12),
                              foreground: _scoreColor(_analysis!.score),
                            ),
                          ],
                        ),
                        if (_analysis!.strengths.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          ..._analysis!.strengths.map(
                            (s) => Padding(
                              padding: const EdgeInsets.only(bottom: 4),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(
                                    Icons.check_circle,
                                    size: 15,
                                    color: Color(0xFF059669),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      s,
                                      style: const TextStyle(
                                        fontSize: 12.5,
                                        color: Brand.navy,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                        if (_analysis!.suggestions.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          const Text(
                            'To improve',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Brand.textMuted,
                            ),
                          ),
                          const SizedBox(height: 6),
                          ..._analysis!.suggestions.map(
                            (s) => Padding(
                              padding: const EdgeInsets.only(bottom: 4),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(
                                    Icons.arrow_right,
                                    size: 16,
                                    color: Brand.textMuted,
                                  ),
                                  Expanded(
                                    child: Text(
                                      s,
                                      style: const TextStyle(
                                        fontSize: 12.5,
                                        color: Brand.textMuted,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _analyzing ? null : _analyze,
                        icon: const Icon(Icons.insights_rounded, size: 18),
                        label: Text(
                          _analyzing
                              ? 'Analysing…'
                              : _analysis == null
                              ? 'Analyse'
                              : 'Re-analyse',
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _exporting ? null : _export,
                        icon: const Icon(Icons.ios_share_rounded, size: 18),
                        label: Text(_exporting ? 'Exporting…' : 'Export JSON'),
                      ),
                    ),
                  ],
                ),

                // ── Auto section ───────────────────────────────────────
                const SizedBox(height: 24),
                Text(
                  'From your challenge',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 4),
                const Text(
                  'Filled in automatically as you progress.',
                  style: TextStyle(color: Brand.textMuted, fontSize: 12.5),
                ),
                const SizedBox(height: 12),
                BrandCard(
                  child: Column(
                    children: [
                      Row(
                        children: [
                          _Stat(label: 'XP', value: '${auto!.totalXp}'),
                          _Stat(
                            label: 'Days done',
                            value: '${auto.daysCompleted}',
                          ),
                          _Stat(
                            label: 'Avg quiz',
                            value: '${auto.avgQuizScore}%',
                          ),
                        ],
                      ),
                      if (auto.skillsLearned.isNotEmpty) ...[
                        const Divider(height: 22, color: Brand.cardBorder),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: auto.skillsLearned
                                .map(
                                  (s) => BrandBadge(
                                    s,
                                    background: Brand.primary.withValues(
                                      alpha: 0.08,
                                    ),
                                    foreground: Brand.deepBlue,
                                  ),
                                )
                                .toList(),
                          ),
                        ),
                      ],
                      if (auto.projects.isNotEmpty) ...[
                        const Divider(height: 22, color: Brand.cardBorder),
                        ...auto.projects.map(
                          (p) => Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.folder_outlined,
                                  size: 15,
                                  color: Brand.textMuted,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    (p['title'] ??
                                            p['description'] ??
                                            'Project')
                                        .toString(),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 12.5,
                                      color: Brand.navy,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

                // ── Editable ───────────────────────────────────────────
                const SizedBox(height: 24),
                Text(
                  'Your details',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                BrandCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const _FieldLabel('Headline'),
                      TextField(
                        controller: _headline,
                        decoration: const InputDecoration(
                          hintText: 'e.g. Full-Stack Developer',
                        ),
                      ),
                      const SizedBox(height: 14),
                      const _FieldLabel('Summary'),
                      TextField(
                        controller: _summary,
                        maxLines: 4,
                        decoration: const InputDecoration(
                          hintText: 'A couple of sentences about you',
                        ),
                      ),
                      const SizedBox(height: 14),
                      const _FieldLabel('Skills (comma separated)'),
                      TextField(
                        controller: _skills,
                        decoration: const InputDecoration(
                          hintText: 'React, FastAPI, PostgreSQL',
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),
                _EntryList(
                  title: 'Experience',
                  entries: _experience,
                  primaryField: 'title',
                  secondaryFields: const ['company', 'duration'],
                  onAdd: () => _editEntry(
                    title: 'Add experience',
                    fields: const [
                      'title',
                      'company',
                      'duration',
                      'description',
                    ],
                    onSave: (e) => setState(() => _experience.add(e)),
                  ),
                  onEdit: (i) => _editEntry(
                    title: 'Edit experience',
                    fields: const [
                      'title',
                      'company',
                      'duration',
                      'description',
                    ],
                    existing: _experience[i],
                    onSave: (e) => setState(() => _experience[i] = e),
                  ),
                  onDelete: (i) => setState(() => _experience.removeAt(i)),
                ),

                const SizedBox(height: 20),
                _EntryList(
                  title: 'Education',
                  entries: _education,
                  primaryField: 'degree',
                  secondaryFields: const ['institution', 'year'],
                  onAdd: () => _editEntry(
                    title: 'Add education',
                    fields: const ['degree', 'institution', 'year'],
                    onSave: (e) => setState(() => _education.add(e)),
                  ),
                  onEdit: (i) => _editEntry(
                    title: 'Edit education',
                    fields: const ['degree', 'institution', 'year'],
                    existing: _education[i],
                    onSave: (e) => setState(() => _education[i] = e),
                  ),
                  onDelete: (i) => setState(() => _education.removeAt(i)),
                ),

                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _saving ? null : _save,
                  child: Text(_saving ? 'Saving…' : 'Save resume'),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Changes are only stored once you save.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Brand.textMuted, fontSize: 11.5),
                ),
              ],
            ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 19,
            color: Brand.primary,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(color: Brand.textMuted, fontSize: 11.5),
        ),
      ],
    ),
  );
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 5),
    child: Text(
      text,
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: Brand.textMuted,
      ),
    ),
  );
}

class _EntryList extends StatelessWidget {
  const _EntryList({
    required this.title,
    required this.entries,
    required this.primaryField,
    required this.secondaryFields,
    required this.onAdd,
    required this.onEdit,
    required this.onDelete,
  });

  final String title;
  final List<Map<String, String>> entries;
  final String primaryField;
  final List<String> secondaryFields;
  final VoidCallback onAdd;
  final void Function(int) onEdit;
  final void Function(int) onDelete;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const Spacer(),
            TextButton.icon(
              onPressed: onAdd,
              icon: const Icon(Icons.add, size: 17),
              label: const Text('Add'),
            ),
          ],
        ),
        if (entries.isEmpty)
          const BrandCard(
            child: Text(
              'Nothing added yet.',
              style: TextStyle(color: Brand.textMuted, fontSize: 13),
            ),
          )
        else
          ...entries.indexed.map(
            (pair) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: BrandCard(
                onTap: () => onEdit(pair.$1),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            pair.$2[primaryField]?.isNotEmpty == true
                                ? pair.$2[primaryField]!
                                : 'Untitled',
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 13.5,
                              color: Brand.navy,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            secondaryFields
                                .map((f) => pair.$2[f] ?? '')
                                .where((v) => v.isNotEmpty)
                                .join(' · '),
                            style: const TextStyle(
                              color: Brand.textMuted,
                              fontSize: 11.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => onDelete(pair.$1),
                      icon: const Icon(Icons.delete_outline, size: 19),
                      color: Brand.textMuted,
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
