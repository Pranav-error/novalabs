import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_controller.dart';

class ProgressRepository {
  ProgressRepository(this._ref);

  final Ref _ref;

  Future<Map<String, dynamic>> submitQuiz(int dayNumber, Map<String, int> answers) async {
    final dio = _ref.read(apiClientProvider).dio;
    final response = await dio.post('/days/$dayNumber/quiz', data: {'answers': answers});
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>?> fetchAssignment(int dayNumber) async {
    final dio = _ref.read(apiClientProvider).dio;
    final response = await dio.get('/days/$dayNumber/assignment');
    return response.data as Map<String, dynamic>?;
  }

  Future<void> submitAssignment(
    int dayNumber, {
    required String submissionType,
    String? content,
    String? githubUrl,
    String? liveUrl,
    String? description,
  }) async {
    final dio = _ref.read(apiClientProvider).dio;
    await dio.post(
      '/days/$dayNumber/assignment',
      data: {
        'submission_type': submissionType,
        'content': content,
        'github_url': githubUrl,
        'live_url': liveUrl,
        'description': description,
      },
    );
  }
}

final progressRepositoryProvider = Provider((ref) => ProgressRepository(ref));
