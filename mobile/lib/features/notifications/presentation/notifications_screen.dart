import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../../auth/presentation/auth_controller.dart';

/// Unread count for the bell badge. Refreshed on demand rather than polled,
/// so a backgrounded app isn't hitting the API on a timer.
final unreadNotificationsProvider = FutureProvider.autoDispose<int>((ref) async {
  try {
    final res = await ref
        .read(apiClientProvider)
        .dio
        .get('/me/notifications', queryParameters: {'limit': 1});
    return (res.data['unread_count'] as num?)?.toInt() ?? 0;
  } on DioException {
    return 0; // a failed badge fetch must never surface as an error
  }
});

class AppNotification {
  AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.isRead,
    required this.createdAt,
  });

  final String id;
  final String type;
  final String title;
  final String? body;
  final bool isRead;
  final DateTime? createdAt;

  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
        id: j['id'] as String,
        type: (j['type'] ?? '').toString(),
        title: (j['title'] ?? '').toString(),
        body: j['body'] as String?,
        isRead: j['is_read'] == true,
        createdAt: DateTime.tryParse((j['created_at'] ?? '').toString()),
      );
}

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  bool _loading = true;
  String? _error;
  List<AppNotification> _items = [];
  int _unread = 0;

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
      final res = await ref
          .read(apiClientProvider)
          .dio
          .get('/me/notifications', queryParameters: {'limit': 50});
      setState(() {
        _items = ((res.data['notifications'] as List?) ?? [])
            .map((n) => AppNotification.fromJson(n as Map<String, dynamic>))
            .toList();
        _unread = (res.data['unread_count'] as num?)?.toInt() ?? 0;
      });
    } on DioException catch (e) {
      setState(() => _error = e.response?.data?['detail']?.toString() ??
          'Could not load notifications.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markAllRead() async {
    try {
      await ref.read(apiClientProvider).dio.patch('/me/notifications/read', data: {});
      setState(() {
        _items = _items
            .map((n) => AppNotification(
                  id: n.id,
                  type: n.type,
                  title: n.title,
                  body: n.body,
                  isRead: true,
                  createdAt: n.createdAt,
                ))
            .toList();
        _unread = 0;
      });
      ref.invalidate(unreadNotificationsProvider);
    } on DioException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not mark as read')),
      );
    }
  }

  String _ago(DateTime? t) {
    if (t == null) return '';
    final d = DateTime.now().difference(t.toLocal());
    if (d.inMinutes < 1) return 'just now';
    if (d.inMinutes < 60) return '${d.inMinutes}m ago';
    if (d.inHours < 24) return '${d.inHours}h ago';
    if (d.inDays < 7) return '${d.inDays}d ago';
    return '${t.day}/${t.month}';
  }

  IconData _iconFor(String type) {
    if (type.contains('submission')) return Icons.assignment_turned_in_rounded;
    if (type.contains('referral')) return Icons.card_giftcard_rounded;
    if (type.contains('certificate')) return Icons.workspace_premium_rounded;
    if (type.contains('admin')) return Icons.campaign_rounded;
    return Icons.notifications_rounded;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (_unread > 0)
            TextButton(
              onPressed: _markAllRead,
              child: const Text('Mark all read'),
            ),
        ],
      ),
      body: RefreshIndicator(
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
                : _items.isEmpty
                    ? ListView(
                        padding: const EdgeInsets.all(20),
                        children: const [
                          SizedBox(height: 60),
                          Icon(Icons.notifications_none_rounded,
                              size: 48, color: Brand.textMuted),
                          SizedBox(height: 12),
                          Text('Nothing yet',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                  color: Brand.navy,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 15)),
                          SizedBox(height: 6),
                          Text(
                            'Updates about your submissions, certificates and\nannouncements will show up here.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Brand.textMuted, fontSize: 13),
                          ),
                        ],
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _items.length,
                        itemBuilder: (context, i) {
                          final n = _items[i];
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: BrandCard(
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    width: 34,
                                    height: 34,
                                    decoration: BoxDecoration(
                                      color: Brand.primary.withValues(
                                          alpha: n.isRead ? 0.06 : 0.14),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Icon(_iconFor(n.type),
                                        size: 18, color: Brand.primary),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          n.title,
                                          style: TextStyle(
                                            fontWeight: n.isRead
                                                ? FontWeight.w500
                                                : FontWeight.w700,
                                            color: Brand.navy,
                                            fontSize: 14,
                                          ),
                                        ),
                                        if (n.body != null && n.body!.isNotEmpty) ...[
                                          const SizedBox(height: 3),
                                          Text(n.body!,
                                              style: const TextStyle(
                                                  color: Brand.textMuted,
                                                  fontSize: 13)),
                                        ],
                                        const SizedBox(height: 4),
                                        Text(_ago(n.createdAt),
                                            style: const TextStyle(
                                                color: Brand.textMuted,
                                                fontSize: 11)),
                                      ],
                                    ),
                                  ),
                                  if (!n.isRead)
                                    Container(
                                      margin: const EdgeInsets.only(top: 4, left: 6),
                                      width: 8,
                                      height: 8,
                                      decoration: const BoxDecoration(
                                        color: Brand.primary,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
