import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_controller.dart';
import '../domain/phase.dart';

class ContentRepository {
  ContentRepository(this._ref);

  final Ref _ref;

  Future<List<Phase>> fetchPhases() async {
    final dio = _ref.read(apiClientProvider).dio;
    final response = await dio.get('/phases');
    return (response.data as List)
        .map((json) => Phase.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  Future<List<PhaseDay>> fetchPhaseDays(String phaseId) async {
    final dio = _ref.read(apiClientProvider).dio;
    final response = await dio.get('/phases/$phaseId');
    return (response.data['days'] as List)
        .map((json) => PhaseDay.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  Future<Map<String, dynamic>> fetchDay(int dayNumber) async {
    final dio = _ref.read(apiClientProvider).dio;
    final response = await dio.get('/days/$dayNumber');
    return response.data as Map<String, dynamic>;
  }

  /// Records that the learner has read the lesson.
  ///
  /// A day only completes when this AND at least one quiz attempt are true.
  /// Nothing in either client ever called this endpoint, so no learner could
  /// complete a day — no XP milestones, badges or certificates, and progress
  /// stuck at 0/30 forever. Returns true once the day is complete.
  Future<bool> markViewed(int dayNumber) async {
    final dio = _ref.read(apiClientProvider).dio;
    final response = await dio.post('/days/$dayNumber/mark-viewed');
    return (response.data as Map<String, dynamic>)['day_completed'] == true;
  }

  /// Per-day progress rows: {day_number, status, best_quiz_score, ...}.
  Future<List<Map<String, dynamic>>> fetchMyProgress() async {
    final dio = _ref.read(apiClientProvider).dio;
    final response = await dio.get('/me/progress');
    return (response.data as List).cast<Map<String, dynamic>>();
  }
}

final contentRepositoryProvider = Provider((ref) => ContentRepository(ref));
