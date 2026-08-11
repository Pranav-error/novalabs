import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme.dart';
import 'auth_controller.dart';

/// Password reset for mobile.
///
/// The backend emails a link to the *website*, so this screen does both halves:
/// request the email, then let the learner paste the token from that link and
/// set a new password without leaving the app. Someone who only ever uses the
/// app previously had no way to recover an account at all.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _emailKey = GlobalKey<FormState>();
  final _resetKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _tokenController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _isSubmitting = false;
  bool _emailSent = false;
  bool _showTokenStep = false;
  String? _errorMessage;
  String? _successMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _tokenController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  ApiClient get _client => ref.read(apiClientProvider);

  Future<void> _requestEmail() async {
    if (!_emailKey.currentState!.validate()) return;
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    try {
      await _client.dio.post(
        '/auth/forgot-password',
        data: {'email': _emailController.text.trim()},
      );
      setState(() {
        _emailSent = true;
        _successMessage =
            'If that email is registered, a reset link is on its way. Open it on '
            'this device, or copy the link and paste it below.';
      });
    } on DioException catch (e) {
      setState(() {
        _errorMessage = e.response?.statusCode == 429
            ? 'Too many attempts. Try again in an hour.'
            : e.response?.data?['detail']?.toString() ??
                  'Could not send the reset email. Try again.';
      });
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  /// Accepts either a bare token or the whole reset URL from the email.
  String _extractToken(String raw) {
    final trimmed = raw.trim();
    final uri = Uri.tryParse(trimmed);
    final fromQuery = uri?.queryParameters['token'];
    return (fromQuery != null && fromQuery.isNotEmpty) ? fromQuery : trimmed;
  }

  Future<void> _resetPassword() async {
    if (!_resetKey.currentState!.validate()) return;
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    try {
      await _client.dio.post(
        '/auth/reset-password',
        data: {
          'token': _extractToken(_tokenController.text),
          'new_password': _passwordController.text,
        },
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Password updated — log in with your new password'),
        ),
      );
      context.go('/login');
    } on DioException catch (e) {
      setState(() {
        _errorMessage =
            e.response?.data?['detail']?.toString() ??
            'That reset link is invalid or has expired. Request a new one.';
      });
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reset password')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Enter the email you signed up with and we will send you a reset link.',
                style: TextStyle(color: Brand.textMuted, fontSize: 14),
              ),
              const SizedBox(height: 24),

              Form(
                key: _emailKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _Label('Email'),
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      enabled: !_emailSent,
                      decoration: const InputDecoration(
                        hintText: 'you@example.com',
                      ),
                      validator: (v) => (v == null || !v.contains('@'))
                          ? 'Enter a valid email'
                          : null,
                    ),
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: _isSubmitting ? null : _requestEmail,
                      child: _isSubmitting && !_showTokenStep
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              _emailSent ? 'Resend email' : 'Send reset link',
                            ),
                    ),
                  ],
                ),
              ),

              if (_successMessage != null) ...[
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFA7F3D0)),
                  ),
                  child: Text(
                    _successMessage!,
                    style: const TextStyle(
                      color: Color(0xFF047857),
                      fontSize: 13,
                    ),
                  ),
                ),
              ],

              if (_emailSent) ...[
                const SizedBox(height: 24),
                if (!_showTokenStep)
                  TextButton(
                    onPressed: () => setState(() => _showTokenStep = true),
                    child: const Text('I have the reset link — enter it here'),
                  )
                else
                  Form(
                    key: _resetKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Divider(),
                        const SizedBox(height: 12),
                        const _Label('Reset link or token'),
                        TextFormField(
                          controller: _tokenController,
                          maxLines: 2,
                          decoration: const InputDecoration(
                            hintText: 'Paste the whole link from the email',
                          ),
                          validator: (v) => (v == null || v.trim().isEmpty)
                              ? 'Paste the link or token'
                              : null,
                        ),
                        const SizedBox(height: 16),
                        const _Label('New password'),
                        TextFormField(
                          controller: _passwordController,
                          obscureText: true,
                          decoration: const InputDecoration(
                            hintText: 'At least 8 characters',
                          ),
                          validator: (v) => (v == null || v.length < 8)
                              ? 'At least 8 characters'
                              : null,
                        ),
                        const SizedBox(height: 20),
                        FilledButton(
                          onPressed: _isSubmitting ? null : _resetPassword,
                          child: _isSubmitting
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Text('Set new password'),
                        ),
                      ],
                    ),
                  ),
              ],

              if (_errorMessage != null) ...[
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFECACA)),
                  ),
                  child: Text(
                    _errorMessage!,
                    style: const TextStyle(
                      color: Color(0xFFB91C1C),
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(
      text,
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: Brand.textMuted,
      ),
    ),
  );
}
