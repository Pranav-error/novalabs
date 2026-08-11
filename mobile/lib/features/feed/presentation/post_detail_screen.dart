import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../../auth/presentation/auth_controller.dart';
import '../data/feed_repository.dart';
import '../domain/feed_post.dart';
import 'feed_screen.dart' show relativeTime;

class PostDetailScreen extends ConsumerStatefulWidget {
  const PostDetailScreen({super.key, required this.postId});

  final String postId;

  @override
  ConsumerState<PostDetailScreen> createState() => _PostDetailScreenState();
}

class _PostDetailScreenState extends ConsumerState<PostDetailScreen> {
  final _replyController = TextEditingController();
  FeedPost? _post;
  List<FeedReply> _replies = [];
  bool _loading = true;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _replyController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final (post, replies) =
          await ref.read(feedRepositoryProvider).detail(widget.postId);
      setState(() {
        _post = post;
        _replies = replies;
      });
    } on DioException catch (e) {
      setState(() => _error = e.response?.statusCode == 404
          ? 'This post has been removed.'
          : 'Could not load this post.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _sendReply() async {
    final text = _replyController.text.trim();
    if (text.isEmpty) return;
    setState(() => _sending = true);
    try {
      await ref.read(feedRepositoryProvider).reply(widget.postId, text);
      _replyController.clear();
      await _load();
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(e.response?.statusCode == 429
            ? 'Too many replies just now. Try again shortly.'
            : 'Could not post your reply.'),
      ));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _report() async {
    const reasons = {
      'spam': 'Spam',
      'harassment': 'Harassment',
      'off_topic': 'Off topic',
      'inappropriate': 'Inappropriate',
    };
    final reason = await showModalBottomSheet<String>(
      context: context,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Report this post',
                  style: TextStyle(fontWeight: FontWeight.w600, color: Brand.navy)),
            ),
            ...reasons.entries.map((e) => ListTile(
                  title: Text(e.value),
                  onTap: () => Navigator.of(context).pop(e.key),
                )),
          ],
        ),
      ),
    );
    if (reason == null) return;
    try {
      await ref.read(feedRepositoryProvider).report(widget.postId, 'post', reason);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Reported — an admin will review it')),
      );
    } on DioException {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Could not report this post')));
    }
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete post?'),
        content: const Text('This cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Delete')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(feedRepositoryProvider).deletePost(widget.postId);
      if (mounted) Navigator.of(context).pop();
    } on DioException {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Could not delete the post')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final myId = authState is AuthAuthenticated ? authState.profile.id : null;
    final isMine = _post != null && _post!.authorId == myId;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Post'),
        actions: [
          if (_post != null)
            PopupMenuButton<String>(
              onSelected: (v) => v == 'delete' ? _delete() : _report(),
              itemBuilder: (_) => [
                if (isMine)
                  const PopupMenuItem(value: 'delete', child: Text('Delete'))
                else
                  const PopupMenuItem(value: 'report', child: Text('Report')),
              ],
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(_error!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Brand.textMuted)),
                  ),
                )
              : Column(
                  children: [
                    Expanded(
                      child: RefreshIndicator(
                        onRefresh: _load,
                        child: ListView(
                          padding: const EdgeInsets.all(20),
                          children: [
                            BrandCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      CircleAvatar(
                                        radius: 16,
                                        backgroundColor:
                                            Brand.primary.withValues(alpha: 0.12),
                                        child: Text(_post!.authorInitials,
                                            style: const TextStyle(
                                                color: Brand.primary,
                                                fontSize: 11,
                                                fontWeight: FontWeight.bold)),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(isMine ? 'You' : _post!.authorName,
                                                style: const TextStyle(
                                                    fontWeight: FontWeight.w600,
                                                    fontSize: 13.5,
                                                    color: Brand.navy)),
                                            Text(
                                              [
                                                feedCategories[_post!.category] ??
                                                    _post!.category,
                                                if (_post!.dayNumber != null)
                                                  'Day ${_post!.dayNumber}',
                                                relativeTime(_post!.createdAt),
                                              ].join(' · '),
                                              style: const TextStyle(
                                                  color: Brand.textMuted, fontSize: 11),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  Text(_post!.content,
                                      style: const TextStyle(
                                          fontSize: 14.5,
                                          height: 1.45,
                                          color: Brand.navy)),
                                ],
                              ),
                            ),
                            const SizedBox(height: 20),
                            Text('${_replies.length} repl${_replies.length == 1 ? 'y' : 'ies'}',
                                style: Theme.of(context).textTheme.titleLarge),
                            const SizedBox(height: 12),
                            if (_replies.isEmpty)
                              const BrandCard(
                                child: Text('No replies yet — be the first.',
                                    style: TextStyle(
                                        color: Brand.textMuted, fontSize: 13.5)),
                              )
                            else
                              ..._replies.map((r) => Padding(
                                    padding: const EdgeInsets.only(bottom: 10),
                                    child: BrandCard(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              CircleAvatar(
                                                radius: 12,
                                                backgroundColor: Brand.cardBorder,
                                                child: Text(r.authorInitials,
                                                    style: const TextStyle(
                                                        fontSize: 9,
                                                        fontWeight: FontWeight.bold,
                                                        color: Brand.navy)),
                                              ),
                                              const SizedBox(width: 8),
                                              Text(
                                                  r.authorId == myId
                                                      ? 'You'
                                                      : r.authorName,
                                                  style: const TextStyle(
                                                      fontWeight: FontWeight.w600,
                                                      fontSize: 12.5,
                                                      color: Brand.navy)),
                                              const SizedBox(width: 6),
                                              Text(relativeTime(r.createdAt),
                                                  style: const TextStyle(
                                                      color: Brand.textMuted,
                                                      fontSize: 11)),
                                            ],
                                          ),
                                          const SizedBox(height: 8),
                                          Text(r.content,
                                              style: const TextStyle(
                                                  fontSize: 13.5,
                                                  height: 1.4,
                                                  color: Brand.navy)),
                                        ],
                                      ),
                                    ),
                                  )),
                          ],
                        ),
                      ),
                    ),
                    SafeArea(
                      top: false,
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          border: Border(top: BorderSide(color: Brand.cardBorder)),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _replyController,
                                minLines: 1,
                                maxLines: 4,
                                decoration:
                                    const InputDecoration(hintText: 'Write a reply…'),
                              ),
                            ),
                            const SizedBox(width: 8),
                            IconButton.filled(
                              onPressed: _sending ? null : _sendReply,
                              icon: _sending
                                  ? const SizedBox(
                                      height: 18,
                                      width: 18,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2, color: Colors.white))
                                  : const Icon(Icons.send_rounded, size: 18),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }
}
