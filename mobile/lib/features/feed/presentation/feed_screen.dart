import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../../auth/presentation/auth_controller.dart';
import '../data/feed_repository.dart';
import '../domain/feed_post.dart';
import 'post_detail_screen.dart';

String relativeTime(DateTime? t) {
  if (t == null) return '';
  final d = DateTime.now().difference(t.toLocal());
  if (d.inMinutes < 1) return 'just now';
  if (d.inMinutes < 60) return '${d.inMinutes}m';
  if (d.inHours < 24) return '${d.inHours}h';
  if (d.inDays < 7) return '${d.inDays}d';
  return '${t.day}/${t.month}';
}

class FeedScreen extends ConsumerStatefulWidget {
  const FeedScreen({super.key});

  @override
  ConsumerState<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends ConsumerState<FeedScreen> {
  static const _pageSize = 20;

  final _scrollController = ScrollController();
  final List<FeedPost> _posts = [];
  String? _category;
  bool _loading = true;
  bool _loadingMore = false;
  bool _reachedEnd = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _load();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_loadingMore || _reachedEnd || _loading) return;
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 400) {
      _loadMore();
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _reachedEnd = false;
    });
    try {
      final posts = await ref
          .read(feedRepositoryProvider)
          .list(category: _category, offset: 0, limit: _pageSize);
      setState(() {
        _posts
          ..clear()
          ..addAll(posts);
        _reachedEnd = posts.length < _pageSize;
      });
    } on DioException catch (e) {
      setState(() => _error =
          e.response?.data?['detail']?.toString() ?? 'Could not load the community feed.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    setState(() => _loadingMore = true);
    try {
      final more = await ref
          .read(feedRepositoryProvider)
          .list(category: _category, offset: _posts.length, limit: _pageSize);
      setState(() {
        _posts.addAll(more);
        if (more.length < _pageSize) _reachedEnd = true;
      });
    } on DioException {
      setState(() => _reachedEnd = true); // stop hammering a failing endpoint
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  Future<void> _toggleLike(int index) async {
    final post = _posts[index];
    // Optimistic, reverted if the server disagrees.
    setState(() => _posts[index] = post.withLike(
          !post.isLiked,
          post.likesCount + (post.isLiked ? -1 : 1),
        ));
    try {
      final (liked, count) = await ref.read(feedRepositoryProvider).toggleLike(post.id);
      setState(() => _posts[index] = post.withLike(liked, count));
    } on DioException {
      setState(() => _posts[index] = post);
    }
  }

  Future<void> _compose() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _ComposeSheet(),
    );
    if (created == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final myId = ref.watch(authControllerProvider) is AuthAuthenticated
        ? (ref.watch(authControllerProvider) as AuthAuthenticated).profile.id
        : null;

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: _compose,
        child: const Icon(Icons.edit_rounded),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Row(
                children: [
                  Text('Community', style: Theme.of(context).textTheme.titleLarge),
                ],
              ),
            ),
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                children: [
                  _CategoryChip(
                    label: 'All',
                    selected: _category == null,
                    onTap: () {
                      setState(() => _category = null);
                      _load();
                    },
                  ),
                  ...feedCategories.entries.map((e) => _CategoryChip(
                        label: e.value,
                        selected: _category == e.key,
                        onTap: () {
                          setState(() => _category = e.key);
                          _load();
                        },
                      )),
                ],
              ),
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _load,
                child: _loading
                    ? const Center(child: CircularProgressIndicator())
                    : _error != null
                        ? ListView(
                            padding: const EdgeInsets.all(20),
                            children: [
                              BrandCard(
                                child: Column(
                                  children: [
                                    Text(_error!,
                                        style: const TextStyle(
                                            color: Brand.textMuted, fontSize: 13)),
                                    const SizedBox(height: 12),
                                    FilledButton(
                                        onPressed: _load, child: const Text('Retry')),
                                  ],
                                ),
                              ),
                            ],
                          )
                        : _posts.isEmpty
                            ? ListView(
                                padding: const EdgeInsets.all(20),
                                children: const [
                                  SizedBox(height: 60),
                                  Icon(Icons.forum_outlined,
                                      size: 44, color: Brand.textMuted),
                                  SizedBox(height: 12),
                                  Text('No posts yet',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                          color: Brand.navy,
                                          fontWeight: FontWeight.w600,
                                          fontSize: 15)),
                                  SizedBox(height: 6),
                                  Text('Be the first to share your progress.',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                          color: Brand.textMuted, fontSize: 13)),
                                ],
                              )
                            : ListView.builder(
                                controller: _scrollController,
                                padding: const EdgeInsets.fromLTRB(20, 8, 20, 90),
                                itemCount: _posts.length + (_loadingMore ? 1 : 0),
                                itemBuilder: (context, i) {
                                  if (i >= _posts.length) {
                                    return const Padding(
                                      padding: EdgeInsets.symmetric(vertical: 20),
                                      child: Center(
                                          child: SizedBox(
                                              height: 22,
                                              width: 22,
                                              child: CircularProgressIndicator(
                                                  strokeWidth: 2))),
                                    );
                                  }
                                  return _PostCard(
                                    post: _posts[i],
                                    isMine: _posts[i].authorId == myId,
                                    onLike: () => _toggleLike(i),
                                    onOpen: () async {
                                      await Navigator.of(context).push(
                                        MaterialPageRoute(
                                          builder: (_) =>
                                              PostDetailScreen(postId: _posts[i].id),
                                        ),
                                      );
                                      _load();
                                    },
                                  );
                                },
                              ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: ChoiceChip(
          label: Text(label),
          selected: selected,
          onSelected: (_) => onTap(),
          labelStyle: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : Brand.textMuted,
          ),
          selectedColor: Brand.primary,
          backgroundColor: Colors.white,
          side: BorderSide(color: selected ? Brand.primary : Brand.cardBorder),
        ),
      );
}

class _PostCard extends StatelessWidget {
  const _PostCard({
    required this.post,
    required this.isMine,
    required this.onLike,
    required this.onOpen,
  });

  final FeedPost post;
  final bool isMine;
  final VoidCallback onLike;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: BrandCard(
        onTap: onOpen,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 16,
                  backgroundColor: Brand.primary.withValues(alpha: 0.12),
                  child: Text(post.authorInitials,
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
                      Text(isMine ? 'You' : post.authorName,
                          style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 13.5,
                              color: Brand.navy)),
                      Text(
                        [
                          feedCategories[post.category] ?? post.category,
                          if (post.dayNumber != null) 'Day ${post.dayNumber}',
                          relativeTime(post.createdAt),
                        ].join(' · '),
                        style: const TextStyle(color: Brand.textMuted, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(post.content,
                maxLines: 6,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 14, height: 1.4, color: Brand.navy)),
            const SizedBox(height: 12),
            Row(
              children: [
                InkWell(
                  onTap: onLike,
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                    child: Row(
                      children: [
                        Icon(
                          post.isLiked ? Icons.favorite : Icons.favorite_border,
                          size: 17,
                          color: post.isLiked ? Brand.pink : Brand.textMuted,
                        ),
                        const SizedBox(width: 5),
                        Text('${post.likesCount}',
                            style: TextStyle(
                                fontSize: 12.5,
                                color: post.isLiked ? Brand.pink : Brand.textMuted)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                const Icon(Icons.mode_comment_outlined,
                    size: 16, color: Brand.textMuted),
                const SizedBox(width: 5),
                Text('${post.repliesCount}',
                    style: const TextStyle(fontSize: 12.5, color: Brand.textMuted)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ComposeSheet extends ConsumerStatefulWidget {
  const _ComposeSheet();

  @override
  ConsumerState<_ComposeSheet> createState() => _ComposeSheetState();
}

class _ComposeSheetState extends ConsumerState<_ComposeSheet> {
  final _controller = TextEditingController();
  String _category = 'general';
  bool _posting = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final text = _controller.text.trim();
    if (text.isEmpty) {
      setState(() => _error = 'Write something first');
      return;
    }
    setState(() {
      _posting = true;
      _error = null;
    });
    try {
      await ref
          .read(feedRepositoryProvider)
          .create(content: text, category: _category);
      if (mounted) Navigator.of(context).pop(true);
    } on DioException catch (e) {
      setState(() {
        _error = e.response?.statusCode == 429
            ? 'You have posted a lot recently. Try again shortly.'
            : e.response?.data?['detail']?.toString() ?? 'Could not post.';
      });
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
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
          Text('New post', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            children: feedCategories.entries
                .map((e) => ChoiceChip(
                      label: Text(e.value),
                      selected: _category == e.key,
                      onSelected: (_) => setState(() => _category = e.key),
                      labelStyle: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: _category == e.key ? Colors.white : Brand.textMuted,
                      ),
                      selectedColor: Brand.primary,
                      backgroundColor: Colors.white,
                      side: BorderSide(
                          color: _category == e.key ? Brand.primary : Brand.cardBorder),
                    ))
                .toList(),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _controller,
            maxLines: 5,
            maxLength: 2000,
            autofocus: true,
            decoration: const InputDecoration(
              hintText: 'Share progress, a project, or ask a doubt…',
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 13)),
          ],
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _posting ? null : _submit,
            child: _posting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Text('Post'),
          ),
        ],
      ),
    );
  }
}
