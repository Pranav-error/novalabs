import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../core/theme.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../../auth/presentation/auth_controller.dart';
import '../data/payments_repository.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  late final Razorpay _razorpay;
  bool _isProcessing = false;
  String? _statusMessage;
  Map<String, dynamic>? _order;
  // The repository always accepted these; the screen never sent them, so a
  // referred learner could not credit their referrer and admin coupons were
  // unusable on mobile.
  final _referralController = TextEditingController();
  final _couponController = TextEditingController();
  String? _codeMessage;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay()
      ..on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess)
      ..on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError)
      ..on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternalWallet);
    _loadOrder();
  }

  @override
  void dispose() {
    _razorpay.clear();
    _referralController.dispose();
    _couponController.dispose();
    super.dispose();
  }

  Future<void> _loadOrder() async {
    setState(() => _isProcessing = true);
    try {
      final referral = _referralController.text.trim();
      final coupon = _couponController.text.trim();
      final order = await ref.read(paymentsRepositoryProvider).createOrder(
        referralCode: referral.isEmpty ? null : referral,
        couponCode: coupon.isEmpty ? null : coupon.toUpperCase(),
      );
      setState(() {
        _order = order;
        // The API silently ignores a code it will not honour, so compare
        // against the discount actually applied rather than claiming success.
        final applied = (order['discount'] as int? ?? 0) > 0;
        _codeMessage = (referral.isEmpty && coupon.isEmpty)
            ? null
            : applied
                ? 'Discount applied.'
                : "That code isn't valid, so no discount was applied.";
      });
    } on DioException catch (e) {
      final detail = e.response?.data?['detail']?.toString();
      setState(() => _statusMessage = detail == 'Already paid'
          ? 'You already have full access — all 30 days are unlocked. 🎉'
          : detail ?? 'Could not start checkout. Check your connection and try again.');
    } catch (_) {
      setState(
          () => _statusMessage = 'Could not start checkout. Check your connection and try again.');
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  void _openCheckout() {
    final order = _order;
    if (order == null) return;
    if ((order['key_id'] as String).isEmpty) {
      setState(() => _statusMessage =
          'Payments are not configured on the backend yet (missing RAZORPAY_KEY_ID).');
      return;
    }
    try {
      _razorpay.open({
        'key': order['key_id'],
        'amount': order['amount'],
        'currency': order['currency'],
        'name': order['name'],
        'description': order['description'],
        'order_id': order['order_id'],
        'prefill': order['prefill'],
      });
    } catch (_) {
      // razorpay_flutter only ships iOS/Android implementations — on
      // desktop/web the method channel is missing and open() throws.
      setState(() => _statusMessage =
          'Payments are available in the iOS and Android app. Please pay from your phone or the website.');
    }
  }

  Future<void> _onPaymentSuccess(PaymentSuccessResponse response) async {
    setState(() => _isProcessing = true);
    try {
      await ref.read(paymentsRepositoryProvider).verifyPayment(
            paymentId: response.paymentId!,
            orderId: response.orderId!,
            signature: response.signature!,
          );
      await ref.read(authControllerProvider.notifier).refreshProfile();
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _statusMessage = 'Payment succeeded but verification failed: $e');
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  void _onPaymentError(PaymentFailureResponse response) {
    setState(() => _statusMessage = 'Payment failed: ${response.message}');
  }

  void _onExternalWallet(ExternalWalletResponse response) {
    setState(() => _statusMessage = 'Opened external wallet: ${response.walletName}');
  }

  @override
  Widget build(BuildContext context) {
    final order = _order;
    final amount = order == null ? null : (order['amount'] as int) / 100;
    final original = order == null ? null : (order['original_amount'] as int) / 100;
    final hasDiscount = order != null && (order['discount'] as int) > 0;

    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        children: [
          BrandCard(
            gradient: Brand.brandingGradient,
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const BrandBadge('30-Day Challenge', gradient: Brand.premiumGradient),
                const SizedBox(height: 14),
                const Text('Unlock all 30 days',
                    style: TextStyle(
                        color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text('One payment. Lifetime access to every lesson, quiz and project.',
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.7), fontSize: 13.5)),
                const SizedBox(height: 20),
                if (amount != null)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('₹${amount.toStringAsFixed(0)}',
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 34,
                              fontWeight: FontWeight.w800)),
                      if (hasDiscount) ...[
                        const SizedBox(width: 10),
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Text('₹${original!.toStringAsFixed(0)}',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.5),
                                fontSize: 16,
                                decoration: TextDecoration.lineThrough,
                                decorationColor: Colors.white.withValues(alpha: 0.5),
                              )),
                        ),
                      ],
                    ],
                  )
                else
                  const SizedBox(
                      height: 40,
                      width: 40,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          BrandCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Have a code?',
                    style: TextStyle(
                        color: Brand.navy,
                        fontWeight: FontWeight.w700,
                        fontSize: 15)),
                const SizedBox(height: 12),
                TextField(
                  controller: _referralController,
                  textCapitalization: TextCapitalization.none,
                  decoration: const InputDecoration(
                    labelText: 'Referral code',
                    hintText: 'e.g. john-a1b2c3',
                    prefixIcon: Icon(Icons.card_giftcard_outlined, size: 18),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _couponController,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(
                    labelText: 'Coupon code',
                    hintText: 'e.g. LAUNCH20',
                    prefixIcon: Icon(Icons.local_offer_outlined, size: 18),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    OutlinedButton(
                      onPressed: _isProcessing ? null : _loadOrder,
                      child: const Text('Apply'),
                    ),
                    if (_codeMessage != null) ...[
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _codeMessage!,
                          style: TextStyle(
                            fontSize: 12.5,
                            color: _codeMessage!.startsWith('Discount')
                                ? const Color(0xFF059669)
                                : Brand.textMuted,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const BrandCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _PerkRow(icon: Icons.menu_book_outlined, text: '30 daily lessons with class videos'),
                SizedBox(height: 12),
                _PerkRow(icon: Icons.quiz_outlined, text: 'Daily quizzes and assignments with XP'),
                SizedBox(height: 12),
                _PerkRow(icon: Icons.workspace_premium_outlined, text: 'Tiered certificates on completion'),
                SizedBox(height: 12),
                _PerkRow(icon: Icons.support_agent_outlined, text: 'Community and mentor support'),
              ],
            ),
          ),
          if (_statusMessage != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                border: Border.all(color: const Color(0xFFFECACA)),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(_statusMessage!,
                  style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 13.5)),
            ),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: (_isProcessing || order == null) ? null : _openCheckout,
            child: _isProcessing
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Pay securely with Razorpay'),
          ),
          const SizedBox(height: 12),
          const Center(
            child: Text('7-day refund window · Secure checkout',
                style: TextStyle(color: Brand.textMuted, fontSize: 12)),
          ),
        ],
      ),
    );
  }
}

class _PerkRow extends StatelessWidget {
  const _PerkRow({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: Brand.teal.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 18, color: Brand.deepBlue),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(text,
              style: const TextStyle(color: Brand.navy, fontSize: 13.5)),
        ),
      ],
    );
  }
}
