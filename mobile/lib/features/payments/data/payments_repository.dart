import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_controller.dart';

class PaymentsRepository {
  PaymentsRepository(this._ref);

  final Ref _ref;

  Future<Map<String, dynamic>> createOrder({String? referralCode, String? couponCode}) async {
    final dio = _ref.read(apiClientProvider).dio;
    final response = await dio.post(
      '/payments/create-order',
      data: {'referral_code': referralCode, 'coupon_code': couponCode},
    );
    return response.data as Map<String, dynamic>;
  }

  Future<void> verifyPayment({
    required String paymentId,
    required String orderId,
    required String signature,
  }) async {
    final dio = _ref.read(apiClientProvider).dio;
    await dio.post(
      '/payments/verify',
      data: {'payment_id': paymentId, 'order_id': orderId, 'signature': signature},
    );
  }
}

final paymentsRepositoryProvider = Provider((ref) => PaymentsRepository(ref));
