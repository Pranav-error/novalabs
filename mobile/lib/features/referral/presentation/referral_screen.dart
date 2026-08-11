import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/config.dart';
import '../../../core/theme.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../../../core/widgets/error_view.dart';
import '../../auth/presentation/auth_controller.dart';

/// Matches the web app's green-600 for earned credit.
const _success = Color(0xFF059669);

/// Refer & Earn — the app-side counterpart to the website's dashboard card.
///
/// Every account is issued a code at signup, so this is never empty for a
/// logged-in learner; the backend also self-heals a missing one on first read.
class ReferralScreen extends ConsumerStatefulWidget {
  const ReferralScreen({super.key});

  @override
  ConsumerState<ReferralScreen> createState() => _ReferralScreenState();
}

class _Referral {
  _Referral(this.name, this.status, this.creditPaise);
  final String name;
  final String status;
  final int creditPaise;
}

class _ReferralScreenState extends ConsumerState<ReferralScreen> {
  bool _loading = true;
  String? _error;
  String? _code;
  int _cashbackPaise = 0;
  // Reward amounts are admin-editable, so they are read from the API
  // rather than hardcoded — the web app quoted a stale figure for weeks.
  int? _discountPaise;
  int? _creditPaise;
  List<_Referral> _referrals = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ref.read(apiClientProvider).dio.get('/me/referral');
      final data = res.data as Map<String, dynamic>;
      setState(() {
        _code = data['code'] as String?;
        _cashbackPaise = (data['cashback_balance'] as num?)?.toInt() ?? 0;
        _referrals = ((data['referrals'] as List?) ?? [])
            .map((r) => _Referral(
                  (r['referee_name'] ?? 'A learner').toString(),
                  (r['status'] ?? 'pending').toString(),
                  (r['credit_paise'] as num?)?.toInt() ?? 0,
                ))
            .toList();
      });
      try {
        final terms =
            await ref.read(apiClientProvider).dio.get('/referrals/terms');
        final t = terms.data as Map<String, dynamic>;
        if (mounted) {
          setState(() {
            _discountPaise = (t['discount_paise'] as num?)?.toInt();
            _creditPaise = (t['credit_paise'] as num?)?.toInt();
          });
        }
      } catch (_) {
        // Non-fatal: the copy falls back to wording without amounts.
      }
    } on DioException catch (e) {
      setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _rupees(int? paise) =>
      paise == null ? '' : '₹${(paise / 100).round()}';

  /// The web link the code resolves to — /r/<code> sets the cookie and
  /// redirects, so a shared link survives the trip through signup.
  String get _shareUrl {
    final origin = apiBaseUrl.contains('localhost') || apiBaseUrl.contains('10.0.2.2')
        ? 'http://localhost:3000'
        : apiBaseUrl.replaceFirst(RegExp(r':\d+$'), '');
    return '$origin/r/${_code ?? ''}';
  }

  String get _shareMessage =>
      "Hey! I'm doing the 30-Day Full-Stack Challenge and it's been great. "
      "Use my code ${_code?.toUpperCase()} at checkout to get "
      "${_discountPaise == null ? 'a discount' : '${_rupees(_discountPaise)} off'}. "
      "Try Day 1 free: $_shareUrl";

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: _shareMessage));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Referral message copied')),
    );
  }

  Future<void> _share() async {
    await Share.share(_shareMessage, subject: 'Join me on NOVA LABS');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Refer & Earn')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  if (_error != null)
                    BrandCard(
                      child: Column(
                        children: [
                          Text(_error!,
                              style: const TextStyle(color: Brand.textMuted, fontSize: 13)),
                          const SizedBox(height: 12),
                          FilledButton(onPressed: _load, child: const Text('Retry')),
                        ],
                      ),
                    )
                  else ...[
                    BrandCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            _discountPaise == null || _creditPaise == null
                                ? 'Share your code — your friend gets a discount, you earn credit.'
                                : 'Share your code — your friend gets ${_rupees(_discountPaise)} off, '
                                    'you get ${_rupees(_creditPaise)} credit.',
                            style: const TextStyle(
                                color: Brand.textMuted, fontSize: 13.5),
                          ),
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            decoration: BoxDecoration(
                              color: Brand.primary.withValues(alpha: 0.06),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                  color: Brand.primary.withValues(alpha: 0.2)),
                            ),
                            child: Text(
                              _code?.toUpperCase() ?? '—',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Brand.primary,
                                fontWeight: FontWeight.bold,
                                fontSize: 18,
                                letterSpacing: 1.5,
                              ),
                            ),
                          ),
                          const SizedBox(height: 14),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: _code == null ? null : _copy,
                                  icon: const Icon(Icons.copy_rounded, size: 18),
                                  label: const Text('Copy'),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: FilledButton.icon(
                                  onPressed: _code == null ? null : _share,
                                  icon: const Icon(Icons.ios_share_rounded, size: 18),
                                  label: const Text('Share'),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    if (_cashbackPaise > 0) ...[
                      const SizedBox(height: 16),
                      BrandCard(
                        child: Row(
                          children: [
                            const Icon(Icons.savings_rounded, color: _success),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                '₹${(_cashbackPaise / 100).toStringAsFixed(0)} credit earned',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600, color: Brand.navy),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 24),
                    Text('Your referrals (${_referrals.length})',
                        style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 12),
                    if (_referrals.isEmpty)
                      const BrandCard(
                        child: Text(
                          'Nobody has joined with your code yet. Share it to start earning.',
                          style: TextStyle(color: Brand.textMuted, fontSize: 13.5),
                        ),
                      )
                    else
                      ..._referrals.map((r) => Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: BrandCard(
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(r.name,
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w600,
                                            color: Brand.navy,
                                            fontSize: 14)),
                                  ),
                                  BrandBadge(
                                    r.status == 'rewarded' ? 'Rewarded' : 'Pending',
                                    background: r.status == 'rewarded'
                                        ? _success.withValues(alpha: 0.12)
                                        : const Color(0xFFF3F4F6),
                                    foreground:
                                        r.status == 'rewarded' ? _success : Brand.textMuted,
                                  ),
                                  if (r.creditPaise > 0) ...[
                                    const SizedBox(width: 10),
                                    Text('+₹${(r.creditPaise / 100).toStringAsFixed(0)}',
                                        style: const TextStyle(
                                            color: _success,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 13)),
                                  ],
                                ],
                              ),
                            ),
                          )),
                  ],
                ],
              ),
      ),
    );
  }
}
