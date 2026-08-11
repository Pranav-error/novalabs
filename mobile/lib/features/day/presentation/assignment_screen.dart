import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../../progress/data/progress_repository.dart';

class AssignmentScreen extends ConsumerStatefulWidget {
  const AssignmentScreen({
    super.key,
    required this.dayNumber,
    required this.assignmentType,
    this.starterCode,
  });

  final int dayNumber;
  final String assignmentType; // "code" | "text" | "project"
  final String? starterCode;

  @override
  ConsumerState<AssignmentScreen> createState() => _AssignmentScreenState();
}

class _AssignmentScreenState extends ConsumerState<AssignmentScreen> {
  late final _contentController = TextEditingController(
    text: widget.assignmentType == 'code' ? widget.starterCode : null,
  );
  final _githubController = TextEditingController();
  final _liveController = TextEditingController();
  final _descriptionController = TextEditingController();

  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _errorMessage;
  String? _existingStatus;

  @override
  void initState() {
    super.initState();
    _loadExisting();
  }

  Future<void> _loadExisting() async {
    try {
      final existing = await ref
          .read(progressRepositoryProvider)
          .fetchAssignment(widget.dayNumber);
      if (existing != null && mounted) {
        setState(() {
          _existingStatus = existing['status'] as String?;
          _contentController.text =
              existing['content'] as String? ?? _contentController.text;
          _githubController.text = existing['github_url'] as String? ?? '';
          _liveController.text = existing['live_url'] as String? ?? '';
        });
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _submit() async {
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    try {
      await ref
          .read(progressRepositoryProvider)
          .submitAssignment(
            widget.dayNumber,
            submissionType: widget.assignmentType,
            content: _contentController.text.trim().isEmpty
                ? null
                : _contentController.text,
            githubUrl: _githubController.text.trim().isEmpty
                ? null
                : _githubController.text,
            liveUrl: _liveController.text.trim().isEmpty
                ? null
                : _liveController.text,
            description: _descriptionController.text.trim().isEmpty
                ? null
                : _descriptionController.text,
          );
      if (mounted) Navigator.of(context).pop(true);
    } on DioException catch (e) {
      setState(() {
        _errorMessage =
            e.response?.data?['detail']?.toString() ?? 'Could not submit.';
      });
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  void dispose() {
    _contentController.dispose();
    _githubController.dispose();
    _liveController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Day ${widget.dayNumber} assignment')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              children: [
                if (_existingStatus != null) ...[
                  Row(
                    children: [
                      const Text(
                        'Status: ',
                        style: TextStyle(
                          color: Brand.textMuted,
                          fontSize: 13.5,
                        ),
                      ),
                      BrandBadge(
                        _existingStatus!,
                        background: _existingStatus == 'pending'
                            ? const Color(0xFFFEF3C7)
                            : const Color(0xFFD1FAE5),
                        foreground: _existingStatus == 'pending'
                            ? const Color(0xFFB45309)
                            : const Color(0xFF047857),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                ],
                BrandCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (widget.assignmentType == 'code') ...[
                        const _FieldLabel('Your code'),
                        TextField(
                          controller: _contentController,
                          maxLines: 16,
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 13,
                            color: Brand.navy,
                          ),
                          decoration: const InputDecoration(
                            alignLabelWithHint: true,
                          ),
                        ),
                      ] else if (widget.assignmentType == 'project') ...[
                        const _FieldLabel('GitHub URL'),
                        TextField(
                          controller: _githubController,
                          decoration: const InputDecoration(
                            hintText: 'https://github.com/you/project',
                          ),
                        ),
                        const SizedBox(height: 16),
                        const _FieldLabel('Live URL'),
                        TextField(
                          controller: _liveController,
                          decoration: const InputDecoration(
                            hintText: 'https://yourproject.app',
                          ),
                        ),
                        const SizedBox(height: 16),
                        const _FieldLabel('Description'),
                        TextField(
                          controller: _descriptionController,
                          maxLines: 4,
                          decoration: const InputDecoration(
                            hintText: 'What did you build? What stack?',
                          ),
                        ),
                      ] else ...[
                        const _FieldLabel('Your answer'),
                        TextField(
                          controller: _contentController,
                          maxLines: 10,
                          decoration: const InputDecoration(
                            hintText: 'Write your answer here',
                          ),
                        ),
                      ],
                      if (_errorMessage != null) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF2F2),
                            border: Border.all(color: const Color(0xFFFECACA)),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            _errorMessage!,
                            style: const TextStyle(
                              color: Color(0xFFB91C1C),
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: 18),
                      FilledButton(
                        onPressed: _isSubmitting ? null : _submit,
                        child: _isSubmitting
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text('Submit assignment'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: Brand.navy,
        ),
      ),
    );
  }
}
