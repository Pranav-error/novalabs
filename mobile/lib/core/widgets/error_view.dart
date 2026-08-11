import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../theme.dart';
import 'brand_widgets.dart';

/// Turns a thrown object into something a learner can act on.
///
/// Screens used to render `'Could not load days: $error'`, which put raw text
/// like "DioException [connection error]: The XMLHttpRequest onError callback
/// was called" on screen. That says nothing useful to a learner and looks
/// broken, so failures are mapped to a cause and a next step instead.
String friendlyError(Object? error) {
  if (error is DioException) {
    switch (error.type) {
      case DioExceptionType.connectionError:
      case DioExceptionType.unknown:
        return "Can't reach the server. Check your connection and try again.";
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return 'The server took too long to respond. Try again in a moment.';
      case DioExceptionType.badCertificate:
        return "The server's security certificate could not be verified.";
      case DioExceptionType.cancel:
        return 'That request was cancelled.';
      case DioExceptionType.transformTimeout:
        return 'That response took too long to process. Try again.';
      case DioExceptionType.badResponse:
        final status = error.response?.statusCode ?? 0;
        // A string `detail` is written for humans; a dict one is structured
        // data for the client and would read as noise here.
        final detail = error.response?.data is Map
            ? error.response?.data['detail']
            : null;
        if (detail is String && detail.isNotEmpty) return detail;
        // A 422 sends `detail` as a list of {loc, msg, ...} objects. Falling
        // through to the generic message told the learner nothing about which
        // field was wrong, which is the one thing they need to know.
        if (detail is List) {
          final parts = <String>[];
          for (final item in detail) {
            if (item is! Map) continue;
            final msg = item['msg'];
            if (msg is! String || msg.isEmpty) continue;
            final loc = item['loc'];
            final field = loc is List && loc.isNotEmpty
                ? loc.last.toString()
                : null;
            parts.add(
              field != null && field != 'body'
                  ? '${field.replaceAll('_', ' ')}: $msg'
                  : msg,
            );
          }
          if (parts.isNotEmpty) return parts.join('. ');
        }
        if (status == 401) return 'Your session has expired. Log in again.';
        if (status == 403) return "You don't have access to this.";
        if (status == 404) return "That isn't available any more.";
        if (status == 429) {
          return 'Too many requests just now. Try again shortly.';
        }
        if (status >= 500) {
          return 'Something went wrong on our side. Try again.';
        }
        return 'That request failed. Try again.';
    }
  }
  return 'Something went wrong. Try again.';
}

/// Full-screen failure state with a retry.
class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.error, this.onRetry, this.title});

  final Object? error;
  final VoidCallback? onRetry;
  final String? title;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.cloud_off_rounded,
              size: 42,
              color: Brand.textMuted,
            ),
            const SizedBox(height: 14),
            if (title != null) ...[
              Text(
                title!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 15.5,
                  color: Brand.navy,
                ),
              ),
              const SizedBox(height: 6),
            ],
            Text(
              friendlyError(error),
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Brand.textMuted,
                fontSize: 13.5,
                height: 1.4,
              ),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Try again'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Inline failure state, for a card inside an otherwise working screen.
class ErrorCard extends StatelessWidget {
  const ErrorCard({super.key, required this.error, this.onRetry});

  final Object? error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return BrandCard(
      child: Column(
        children: [
          Text(
            friendlyError(error),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Brand.textMuted, fontSize: 13),
          ),
          if (onRetry != null) ...[
            const SizedBox(height: 12),
            FilledButton(onPressed: onRetry, child: const Text('Try again')),
          ],
        ],
      ),
    );
  }
}
