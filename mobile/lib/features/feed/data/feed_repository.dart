import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_controller.dart';
import '../domain/feed_post.dart';

class FeedRepository {
  FeedRepository(this._client);
  final dynamic _client;

  /// One page of posts. `offset` pagination, matching the backend.
  Future<List<FeedPost>> list({
    String? category,
    int offset = 0,
    int limit = 20,
  }) async {
    final res = await _client.dio.get('/feed', queryParameters: {
      'category': ?category,
      'offset': offset,
      'limit': limit,
    });
    return ((res.data['posts'] as List?) ?? [])
        .map((p) => FeedPost.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  Future<FeedPost> create({
    required String content,
    required String category,
    int? dayNumber,
  }) async {
    final res = await _client.dio.post('/feed', data: {
      'content': content,
      'category': category,
      'day_number': ?dayNumber,
    });
    return FeedPost.fromJson(res.data['post'] as Map<String, dynamic>);
  }

  /// Returns (liked, likesCount) as reported by the server.
  Future<(bool, int)> toggleLike(String postId) async {
    final res = await _client.dio.post('/feed/$postId/like');
    return (res.data['liked'] == true, (res.data['likes_count'] as num).toInt());
  }

  Future<(FeedPost, List<FeedReply>)> detail(String postId) async {
    final res = await _client.dio.get('/feed/$postId');
    // The detail endpoint nests everything under "post", unlike the list
    // endpoint which returns them flat under "posts".
    final data = (res.data['post'] ?? res.data) as Map<String, dynamic>;
    final replies = ((data['replies'] as List?) ?? [])
        .map((r) => FeedReply.fromJson(r as Map<String, dynamic>))
        .toList();
    return (FeedPost.fromJson(data), replies);
  }

  Future<void> reply(String postId, String content) async {
    await _client.dio.post('/feed/$postId/replies', data: {'content': content});
  }

  Future<void> deletePost(String postId) async {
    await _client.dio.delete('/feed/$postId');
  }

  Future<void> report(String targetId, String targetType, String reason) async {
    await _client.dio.post('/feed/report', data: {
      'target_id': targetId,
      'target_type': targetType,
      'reason': reason,
    });
  }
}

final feedRepositoryProvider =
    Provider((ref) => FeedRepository(ref.watch(apiClientProvider)));
