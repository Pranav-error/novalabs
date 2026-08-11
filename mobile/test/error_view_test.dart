import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:novalabs/core/widgets/error_view.dart';

DioException _dio(DioExceptionType type, {int? status, dynamic data}) =>
    DioException(
      requestOptions: RequestOptions(path: '/x'),
      type: type,
      response: status == null
          ? null
          : Response(
              requestOptions: RequestOptions(path: '/x'),
              statusCode: status,
              data: data,
            ),
    );

void main() {
  group('friendlyError', () {
    test('never leaks raw exception text to the learner', () {
      // The bug this guards: 'Could not load days: DioException [connection
      // error]: The XMLHttpRequest onError callback was called...' on screen.
      for (final type in DioExceptionType.values) {
        final msg = friendlyError(_dio(type, status: 500));
        expect(msg, isNot(contains('DioException')));
        expect(msg, isNot(contains('XMLHttpRequest')));
        expect(msg.isNotEmpty, isTrue);
      }
    });

    test('connection failure explains the cause', () {
      expect(
        friendlyError(_dio(DioExceptionType.connectionError)),
        contains("Can't reach the server"),
      );
    });

    test('timeouts read as timeouts', () {
      expect(
        friendlyError(_dio(DioExceptionType.receiveTimeout)),
        contains('took too long'),
      );
    });

    test('a human-readable detail from the API is surfaced verbatim', () {
      expect(
        friendlyError(_dio(DioExceptionType.badResponse,
            status: 400, data: {'detail': 'That reset link has already been used'})),
        'That reset link has already been used',
      );
    });

    test('a structured detail is not rendered as noise', () {
      final msg = friendlyError(_dio(DioExceptionType.badResponse,
          status: 400, data: {'detail': {'counts': {'submissions': 3}}}));
      expect(msg, isNot(contains('counts')));
      expect(msg, 'That request failed. Try again.');
    });

    test('status codes map to something actionable', () {
      expect(friendlyError(_dio(DioExceptionType.badResponse, status: 401)),
          contains('session has expired'));
      expect(friendlyError(_dio(DioExceptionType.badResponse, status: 429)),
          contains('Too many requests'));
      expect(friendlyError(_dio(DioExceptionType.badResponse, status: 503)),
          contains('our side'));
    });

    test('a non-Dio error still produces a sentence', () {
      expect(friendlyError(StateError('boom')), 'Something went wrong. Try again.');
      expect(friendlyError(null), 'Something went wrong. Try again.');
    });
  });
}
