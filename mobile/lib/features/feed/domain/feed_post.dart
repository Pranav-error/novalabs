class FeedPost {
  FeedPost({
    required this.id,
    required this.authorId,
    required this.authorName,
    required this.authorInitials,
    required this.content,
    required this.category,
    required this.dayNumber,
    required this.likesCount,
    required this.repliesCount,
    required this.isLiked,
    required this.createdAt,
  });

  final String id;
  final String authorId;
  final String authorName;
  final String authorInitials;
  final String content;
  final String category;
  final int? dayNumber;
  final int likesCount;
  final int repliesCount;
  final bool isLiked;
  final DateTime? createdAt;

  factory FeedPost.fromJson(Map<String, dynamic> j) => FeedPost(
        id: j['id'] as String,
        authorId: (j['author_id'] ?? '').toString(),
        authorName: (j['author_name'] ?? 'Learner').toString(),
        authorInitials: (j['author_initials'] ?? '?').toString(),
        content: (j['content'] ?? '').toString(),
        category: (j['category'] ?? 'general').toString(),
        dayNumber: (j['day_number'] as num?)?.toInt(),
        likesCount: (j['likes_count'] as num?)?.toInt() ?? 0,
        repliesCount: (j['replies_count'] as num?)?.toInt() ?? 0,
        isLiked: j['is_liked'] == true,
        createdAt: DateTime.tryParse((j['created_at'] ?? '').toString()),
      );

  /// Local echo of a like, so the UI can update without a refetch.
  FeedPost withLike(bool liked, int count) => FeedPost(
        id: id,
        authorId: authorId,
        authorName: authorName,
        authorInitials: authorInitials,
        content: content,
        category: category,
        dayNumber: dayNumber,
        likesCount: count,
        repliesCount: repliesCount,
        isLiked: liked,
        createdAt: createdAt,
      );
}

class FeedReply {
  FeedReply({
    required this.id,
    required this.authorId,
    required this.authorName,
    required this.authorInitials,
    required this.content,
    required this.createdAt,
  });

  final String id;
  final String authorId;
  final String authorName;
  final String authorInitials;
  final String content;
  final DateTime? createdAt;

  factory FeedReply.fromJson(Map<String, dynamic> j) => FeedReply(
        id: j['id'] as String,
        authorId: (j['author_id'] ?? '').toString(),
        authorName: (j['author_name'] ?? 'Learner').toString(),
        authorInitials: (j['author_initials'] ?? '?').toString(),
        content: (j['content'] ?? '').toString(),
        createdAt: DateTime.tryParse((j['created_at'] ?? '').toString()),
      );
}

/// Matches VALID_CATEGORIES on the backend; anything else is rejected there.
const feedCategories = <String, String>{
  'general': 'General',
  'progress': 'Progress',
  'project': 'Project',
  'doubt': 'Doubt',
};
