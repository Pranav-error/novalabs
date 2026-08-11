import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_controller.dart';

class CertificatesRepository {
  CertificatesRepository(this._ref);

  final Ref _ref;

  Future<List<Map<String, dynamic>>> fetchCertificates() async {
    final dio = _ref.read(apiClientProvider).dio;
    final response = await dio.get('/certificates/me');
    return (response.data as List).cast<Map<String, dynamic>>();
  }

  Future<Uint8List> downloadCertificate(String certId) async {
    final dio = _ref.read(apiClientProvider).dio;
    final response = await dio.get<List<int>>(
      '/certificates/$certId/download',
      options: Options(responseType: ResponseType.bytes),
    );
    return Uint8List.fromList(response.data!);
  }
}

final certificatesRepositoryProvider = Provider(
  (ref) => CertificatesRepository(ref),
);
