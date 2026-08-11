import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_controller.dart';

class InterviewTopic {
  InterviewTopic(this.id, this.name, this.questionCount);
  final String id;
  final String name;
  final int questionCount;

  factory InterviewTopic.fromJson(Map<String, dynamic> j) => InterviewTopic(
    (j['id'] ?? '').toString(),
    (j['name'] ?? '').toString(),
    (j['question_count'] as num?)?.toInt() ?? 0,
  );
}

class InterviewQuestion {
  InterviewQuestion(this.id, this.question);
  final String id;
  final String question;

  factory InterviewQuestion.fromJson(Map<String, dynamic> j) =>
      InterviewQuestion(
        (j['id'] ?? '').toString(),
        (j['question'] ?? '').toString(),
      );
}

class InterviewSessionStart {
  InterviewSessionStart(this.sessionId, this.topicName, this.questions);
  final String sessionId;
  final String topicName;
  final List<InterviewQuestion> questions;
}

class QuestionResult {
  QuestionResult({
    required this.question,
    required this.yourAnswer,
    required this.score,
    required this.feedback,
    required this.keywordsHit,
    required this.keywordsMissed,
    required this.modelAnswer,
  });

  final String question;
  final String yourAnswer;
  final int score;
  final String feedback;
  final List<String> keywordsHit;
  final List<String> keywordsMissed;
  final String modelAnswer;

  factory QuestionResult.fromJson(Map<String, dynamic> j) => QuestionResult(
    question: (j['question'] ?? '').toString(),
    yourAnswer: (j['your_answer'] ?? '').toString(),
    score: (j['score'] as num?)?.toInt() ?? 0,
    feedback: (j['feedback'] ?? '').toString(),
    keywordsHit: ((j['keywords_hit'] as List?) ?? [])
        .map((e) => e.toString())
        .toList(),
    keywordsMissed: ((j['keywords_missed'] as List?) ?? [])
        .map((e) => e.toString())
        .toList(),
    modelAnswer: (j['model_answer'] ?? '').toString(),
  );
}

class InterviewResults {
  InterviewResults(this.topicName, this.totalScore, this.results);
  final String topicName;
  final int totalScore;
  final List<QuestionResult> results;
}

class PastSession {
  PastSession(
    this.sessionId,
    this.topicName,
    this.status,
    this.totalScore,
    this.startedAt,
  );
  final String sessionId;
  final String topicName;
  final String status;
  final int? totalScore;
  final DateTime? startedAt;

  factory PastSession.fromJson(Map<String, dynamic> j) => PastSession(
    (j['session_id'] ?? '').toString(),
    (j['topic_name'] ?? '').toString(),
    (j['status'] ?? '').toString(),
    (j['total_score'] as num?)?.toInt(),
    DateTime.tryParse((j['started_at'] ?? '').toString()),
  );
}

class InterviewRepository {
  InterviewRepository(this._client);
  final dynamic _client;

  Future<List<InterviewTopic>> topics() async {
    final res = await _client.dio.get('/interviews/topics');
    return ((res.data['topics'] as List?) ?? [])
        .map((t) => InterviewTopic.fromJson(t as Map<String, dynamic>))
        .toList();
  }

  Future<InterviewSessionStart> start(String topic) async {
    final res = await _client.dio.post(
      '/interviews/start',
      data: {'topic': topic},
    );
    final d = res.data as Map<String, dynamic>;
    return InterviewSessionStart(
      (d['session_id'] ?? '').toString(),
      (d['topic_name'] ?? '').toString(),
      ((d['questions'] as List?) ?? [])
          .map((q) => InterviewQuestion.fromJson(q as Map<String, dynamic>))
          .toList(),
    );
  }

  /// Returns (totalScore, xpAwarded).
  Future<(int, int)> submit(
    String sessionId,
    Map<String, String> answers,
  ) async {
    final res = await _client.dio.post(
      '/interviews/$sessionId/submit',
      data: {'answers': answers},
    );
    return (
      (res.data['total_score'] as num?)?.toInt() ?? 0,
      (res.data['xp_awarded'] as num?)?.toInt() ?? 0,
    );
  }

  Future<InterviewResults> results(String sessionId) async {
    final res = await _client.dio.get('/interviews/$sessionId/results');
    final d = res.data as Map<String, dynamic>;
    return InterviewResults(
      (d['topic_name'] ?? '').toString(),
      (d['total_score'] as num?)?.toInt() ?? 0,
      ((d['results'] as List?) ?? [])
          .map((r) => QuestionResult.fromJson(r as Map<String, dynamic>))
          .toList(),
    );
  }

  Future<List<PastSession>> history() async {
    final res = await _client.dio.get('/interviews/history');
    return ((res.data['sessions'] as List?) ?? [])
        .map((s) => PastSession.fromJson(s as Map<String, dynamic>))
        .toList();
  }
}

final interviewRepositoryProvider = Provider(
  (ref) => InterviewRepository(ref.watch(apiClientProvider)),
);
