import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_controller.dart';

class GamificationRepository {
  GamificationRepository(this._ref);

  final Ref _ref;

  Future<Map<String, dynamic>> fetchStreak() async {
    final dio = _ref.read(apiClientProvider).dio;
    final response = await dio.get('/streaks/me');
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> fetchLeaderboard({required bool weekly}) async {
    final dio = _ref.read(apiClientProvider).dio;
    final response = await dio.get(
      weekly ? '/leaderboard/weekly' : '/leaderboard/alltime',
    );
    return response.data as Map<String, dynamic>;
  }
}

final gamificationRepositoryProvider = Provider(
  (ref) => GamificationRepository(ref),
);
