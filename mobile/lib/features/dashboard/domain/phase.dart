class Phase {
  const Phase({
    required this.id,
    required this.name,
    required this.description,
    required this.tagline,
    required this.accentColor,
    required this.skills,
  });

  factory Phase.fromJson(Map<String, dynamic> json) {
    return Phase(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String? ?? '',
      tagline: json['tagline'] as String? ?? '',
      accentColor: json['accent_color'] as String?,
      skills: (json['skills_list'] as List?)?.cast<String>() ?? const [],
    );
  }

  final String id;
  final String name;
  final String description;
  final String tagline;
  final String? accentColor;
  final List<String> skills;
}

class PhaseDay {
  const PhaseDay({
    required this.dayNumber,
    required this.title,
    required this.estimatedTime,
    required this.status,
  });

  factory PhaseDay.fromJson(Map<String, dynamic> json) {
    return PhaseDay(
      dayNumber: json['day_number'] as int,
      title: json['title'] as String,
      estimatedTime: json['estimated_time'] as String? ?? '',
      status: json['status'] as String? ?? 'locked',
    );
  }

  final int dayNumber;
  final String title;
  final String estimatedTime;
  final String status;
}
