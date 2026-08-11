import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_controller.dart';

/// The editable half of the resume. The `auto` half is derived server-side
/// from challenge progress and is never sent back.
class ResumeEditable {
  ResumeEditable({
    required this.headline,
    required this.summary,
    required this.experience,
    required this.education,
    required this.customSkills,
  });

  final String headline;
  final String summary;
  final List<Map<String, String>> experience;
  final List<Map<String, String>> education;
  final List<String> customSkills;

  static List<Map<String, String>> _entries(dynamic raw) =>
      ((raw as List?) ?? [])
          .map(
            (e) => (e as Map).map(
              (k, v) => MapEntry(k.toString(), (v ?? '').toString()),
            ),
          )
          .toList();

  factory ResumeEditable.fromJson(Map<String, dynamic> j) => ResumeEditable(
    headline: (j['headline'] ?? '').toString(),
    summary: (j['summary'] ?? '').toString(),
    experience: _entries(j['experience']),
    education: _entries(j['education']),
    customSkills: ((j['custom_skills'] as List?) ?? [])
        .map((e) => e.toString())
        .toList(),
  );
}

class ResumeAuto {
  ResumeAuto({
    required this.totalXp,
    required this.daysCompleted,
    required this.avgQuizScore,
    required this.projects,
    required this.skillsLearned,
  });

  final int totalXp;
  final int daysCompleted;
  final int avgQuizScore;
  final List<Map<String, dynamic>> projects;
  final List<String> skillsLearned;

  factory ResumeAuto.fromJson(Map<String, dynamic> j) {
    final stats = (j['stats'] as Map?) ?? {};
    return ResumeAuto(
      totalXp: (stats['total_xp'] as num?)?.toInt() ?? 0,
      daysCompleted: (stats['days_completed'] as num?)?.toInt() ?? 0,
      avgQuizScore: (stats['avg_quiz_score'] as num?)?.toInt() ?? 0,
      projects: ((j['projects'] as List?) ?? []).cast<Map<String, dynamic>>(),
      skillsLearned: ((j['skills_learned'] as List?) ?? [])
          .map((e) => e.toString())
          .toList(),
    );
  }
}

class ResumeAnalysis {
  ResumeAnalysis(this.score, this.strengths, this.suggestions);
  final int score;
  final List<String> strengths;
  final List<String> suggestions;
}

class ResumeRepository {
  ResumeRepository(this._client);
  final dynamic _client;

  Future<(ResumeAuto, ResumeEditable)> fetch() async {
    final res = await _client.dio.get('/resume');
    final d = res.data as Map<String, dynamic>;
    return (
      ResumeAuto.fromJson((d['auto'] as Map).cast<String, dynamic>()),
      ResumeEditable.fromJson((d['editable'] as Map).cast<String, dynamic>()),
    );
  }

  /// PATCH accepts a partial body; only the supplied keys are merged.
  Future<void> save(Map<String, dynamic> updates) async {
    await _client.dio.patch('/resume', data: updates);
  }

  /// The full resume as JSON — the same payload the website exports.
  Future<Map<String, dynamic>> exportJson() async {
    final res = await _client.dio.get('/resume/export/json');
    return (res.data as Map).cast<String, dynamic>();
  }

  Future<ResumeAnalysis> analyze() async {
    final res = await _client.dio.post('/resume/analyze');
    final d = res.data as Map<String, dynamic>;
    return ResumeAnalysis(
      (d['score'] as num?)?.toInt() ?? 0,
      ((d['strengths'] as List?) ?? []).map((e) => e.toString()).toList(),
      ((d['suggestions'] as List?) ?? []).map((e) => e.toString()).toList(),
    );
  }
}

final resumeRepositoryProvider = Provider(
  (ref) => ResumeRepository(ref.watch(apiClientProvider)),
);
