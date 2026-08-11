import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import 'auth_controller.dart';

/// Six-digit OTP entry after signup.
///
/// App-only learners previously had no way to verify their address at all —
/// the endpoints existed but nothing in the app called them.
class VerifyEmailScreen extends ConsumerStatefulWidget {
  const VerifyEmailScreen({super.key, required this.email});

  final String email;

  @override
  ConsumerState<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends ConsumerState<VerifyEmailScreen> {
  final _otpController = TextEditingController();
  bool _submitting = false;
  bool _resending = false;
  String? _error;
  String? _notice;

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      setState(() => _error = 'Enter the 6-digit code');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
      _notice = null;
    });
    try {
      await ref
          .read(apiClientProvider)
          .dio
          .post(
            '/auth/verify-email',
            data: {'email': widget.email, 'otp': otp},
          );
      // Reflect email_verified on the cached profile.
      await ref.read(authControllerProvider.notifier).refreshProfile();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Email verified')));
      Navigator.of(context).pop(true);
    } on DioException catch (e) {
      setState(() {
        _error = e.response?.statusCode == 429
            ? 'Too many attempts. Try again later.'
            : e.response?.data?['detail']?.toString() ??
                  'Could not verify that code.';
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _resend() async {
    setState(() {
      _resending = true;
      _error = null;
      _notice = null;
    });
    try {
      await ref
          .read(apiClientProvider)
          .dio
          .post('/auth/resend-verification', data: {'email': widget.email});
      setState(() => _notice = 'A new code is on its way.');
    } on DioException catch (e) {
      setState(() {
        _error = e.response?.statusCode == 429
            ? 'You have requested too many codes. Try again in an hour.'
            : 'Could not resend the code.';
      });
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Verify your email')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'We sent a 6-digit code to ${widget.email}. It expires in 10 minutes.',
                style: const TextStyle(color: Brand.textMuted, fontSize: 14),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _otpController,
                keyboardType: TextInputType.number,
                maxLength: 6,
                textAlign: TextAlign.center,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 10,
                  color: Brand.navy,
                ),
                decoration: const InputDecoration(
                  hintText: '000000',
                  counterText: '',
                ),
                onSubmitted: (_) => _verify(),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _submitting ? null : _verify,
                child: _submitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Verify'),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: _resending ? null : _resend,
                child: Text(_resending ? 'Sending…' : 'Resend code'),
              ),
              if (_notice != null) ...[
                const SizedBox(height: 12),
                _Banner(
                  _notice!,
                  const Color(0xFFECFDF5),
                  const Color(0xFFA7F3D0),
                  const Color(0xFF047857),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                _Banner(
                  _error!,
                  const Color(0xFFFEF2F2),
                  const Color(0xFFFECACA),
                  const Color(0xFFB91C1C),
                ),
              ],
              const SizedBox(height: 24),
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Skip for now'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner(this.text, this.bg, this.border, this.fg);
  final String text;
  final Color bg;
  final Color border;
  final Color fg;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: bg,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: border),
    ),
    child: Text(text, style: TextStyle(color: fg, fontSize: 13)),
  );
}
