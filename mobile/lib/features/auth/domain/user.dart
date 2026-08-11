class LearnerProfile {
  const LearnerProfile({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.emailVerified,
    required this.isPaid,
    required this.totalXp,
    required this.daysCompleted,
    this.bio,
    this.githubUrl,
    this.linkedinUrl,
  });

  factory LearnerProfile.fromJson(Map<String, dynamic> json) {
    return LearnerProfile(
      id: json['id'] as String,
      email: json['email'] as String,
      firstName: json['first_name'] as String,
      lastName: json['last_name'] as String,
      emailVerified: json['email_verified'] as bool,
      isPaid: json['is_paid'] as bool,
      totalXp: json['total_xp'] as int,
      daysCompleted: json['days_completed'] as int,
      bio: json['bio'] as String?,
      githubUrl: json['github_url'] as String?,
      linkedinUrl: json['linkedin_url'] as String?,
    );
  }

  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final bool emailVerified;
  final bool isPaid;
  final int totalXp;
  final int daysCompleted;
  final String? bio;
  final String? githubUrl;
  final String? linkedinUrl;
}
