import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../../certificates/presentation/certificates_screen.dart';
import '../../gamification/presentation/xp_history_card.dart';
import '../../interviews/presentation/interviews_screen.dart';
import '../../resume/presentation/resume_screen.dart';
import '../../referral/presentation/referral_screen.dart';
import 'verify_email_screen.dart';
import '../domain/user.dart';
import 'auth_controller.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _bioController = TextEditingController();
  final _githubController = TextEditingController();
  final _linkedinController = TextEditingController();
  bool _isSaving = false;
  bool _initialized = false;

  void _hydrateOnce(LearnerProfile profile) {
    if (_initialized) return;
    _bioController.text = profile.bio ?? '';
    _githubController.text = profile.githubUrl ?? '';
    _linkedinController.text = profile.linkedinUrl ?? '';
    _initialized = true;
  }

  Future<void> _save() async {
    setState(() => _isSaving = true);
    try {
      await ref
          .read(authRepositoryProvider)
          .updateProfile(
            bio: _bioController.text,
            githubUrl: _githubController.text,
            linkedinUrl: _linkedinController.text,
          );
      await ref.read(authControllerProvider.notifier).refreshProfile();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Profile updated')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Could not save: $e')));
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  void dispose() {
    _bioController.dispose();
    _githubController.dispose();
    _linkedinController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    if (authState is! AuthAuthenticated) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final profile = authState.profile;
    _hydrateOnce(profile);

    final initials =
        '${profile.firstName.isNotEmpty ? profile.firstName[0] : ''}${profile.lastName.isNotEmpty ? profile.lastName[0] : ''}'
            .toUpperCase();

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          children: [
            if (!profile.emailVerified) ...[
              BrandCard(
                padding: EdgeInsets.zero,
                onTap: () async {
                  final verified = await Navigator.of(context).push<bool>(
                    MaterialPageRoute(
                      builder: (context) =>
                          VerifyEmailScreen(email: profile.email),
                    ),
                  );
                  if (verified == true) {
                    await ref
                        .read(authControllerProvider.notifier)
                        .refreshProfile();
                  }
                },
                child: const Padding(
                  padding: EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Icon(
                        Icons.mark_email_unread_rounded,
                        color: Color(0xFFD97706),
                      ),
                      SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Verify your email',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14.5,
                                color: Brand.navy,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Tap to enter the code we sent you',
                              style: TextStyle(
                                color: Brand.textMuted,
                                fontSize: 12.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Icon(Icons.chevron_right, color: Brand.textMuted),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],
            BrandCard(
              gradient: Brand.brandingGradient,
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.4),
                        width: 2,
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      initials,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 26,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    '${profile.firstName} ${profile.lastName}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    profile.email,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.65),
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (profile.isPaid)
                        const BrandBadge(
                          'Full access',
                          gradient: Brand.premiumGradient,
                        )
                      else
                        BrandBadge(
                          'Day 1 free',
                          background: Colors.white.withValues(alpha: 0.2),
                          foreground: Colors.white,
                        ),
                      const SizedBox(width: 8),
                      BrandBadge(
                        '${profile.totalXp} XP',
                        background: Colors.white.withValues(alpha: 0.2),
                        foreground: Colors.white,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            BrandCard(
              padding: EdgeInsets.zero,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => const CertificatesScreen(),
                ),
              ),
              child: const Padding(
                padding: EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(Icons.workspace_premium_rounded, color: Brand.purple),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Certificates',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14.5,
                          color: Brand.navy,
                        ),
                      ),
                    ),
                    Icon(Icons.chevron_right, color: Brand.textMuted),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            BrandCard(
              padding: EdgeInsets.zero,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (context) => const ReferralScreen()),
              ),
              child: const Padding(
                padding: EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(Icons.card_giftcard_rounded, color: Brand.magenta),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Refer & Earn',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14.5,
                          color: Brand.navy,
                        ),
                      ),
                    ),
                    Icon(Icons.chevron_right, color: Brand.textMuted),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            _NavCard(
              icon: Icons.record_voice_over_outlined,
              color: Brand.teal,
              label: 'Mock interviews',
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => const InterviewsScreen(),
                ),
              ),
            ),
            const SizedBox(height: 12),
            _NavCard(
              icon: Icons.description_outlined,
              color: Brand.deepBlue,
              label: 'Resume builder',
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (context) => const ResumeScreen()),
              ),
            ),
            const XpHistoryCard(),
            const SizedBox(height: 24),
            Text('Edit profile', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 14),
            BrandCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _FieldLabel('Bio'),
                  TextField(
                    controller: _bioController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      hintText: 'Tell the community about yourself',
                    ),
                  ),
                  const SizedBox(height: 16),
                  const _FieldLabel('GitHub URL'),
                  TextField(
                    controller: _githubController,
                    decoration: const InputDecoration(
                      hintText: 'https://github.com/you',
                    ),
                  ),
                  const SizedBox(height: 16),
                  const _FieldLabel('LinkedIn URL'),
                  TextField(
                    controller: _linkedinController,
                    decoration: const InputDecoration(
                      hintText: 'https://linkedin.com/in/you',
                    ),
                  ),
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _isSaving ? null : _save,
                    child: _isSaving
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Save changes'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFB91C1C),
                side: const BorderSide(color: Color(0xFFFECACA)),
              ),
              icon: const Icon(Icons.logout, size: 18),
              label: const Text('Log out'),
              onPressed: () =>
                  ref.read(authControllerProvider.notifier).logout(),
            ),
          ],
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: Brand.navy,
        ),
      ),
    );
  }
}

/// Row linking to a full-screen feature from the profile.
class _NavCard extends StatelessWidget {
  const _NavCard({
    required this.icon,
    required this.color,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return BrandCard(
      padding: EdgeInsets.zero,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(icon, color: color),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 14.5,
                  color: Brand.navy,
                ),
              ),
            ),
            const Icon(Icons.chevron_right, color: Brand.textMuted),
          ],
        ),
      ),
    );
  }
}
