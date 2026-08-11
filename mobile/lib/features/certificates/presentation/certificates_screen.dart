import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/theme.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../data/certificates_repository.dart';

class CertificatesScreen extends ConsumerWidget {
  const CertificatesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final certsFuture = ref.watch(_certificatesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Certificates')),
      body: certsFuture.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorView(
          error: error,
          title: 'Could not load your certificates',
          onRetry: () => ref.invalidate(_certificatesProvider),
        ),
        data: (certs) => certs.isEmpty
            ? const _EmptyState()
            : ListView(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                children: [
                  for (final cert in certs) ...[
                    _CertificateCard(cert: cert),
                    const SizedBox(height: 12),
                  ],
                ],
              ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: Brand.purple.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.workspace_premium_rounded,
                color: Brand.purple,
                size: 36,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'No certificates yet',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 6),
            const Text(
              'Complete days of the challenge to earn tiered certificates.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Brand.textMuted, fontSize: 13.5),
            ),
          ],
        ),
      ),
    );
  }
}

class _CertificateCard extends ConsumerStatefulWidget {
  const _CertificateCard({required this.cert});
  final Map<String, dynamic> cert;

  @override
  ConsumerState<_CertificateCard> createState() => _CertificateCardState();
}

class _CertificateCardState extends ConsumerState<_CertificateCard> {
  bool _isDownloading = false;

  Future<void> _downloadAndShare() async {
    setState(() => _isDownloading = true);
    try {
      final bytes = await ref
          .read(certificatesRepositoryProvider)
          .downloadCertificate(widget.cert['id'] as String);
      final dir = await getTemporaryDirectory();
      final file = File(
        '${dir.path}/novalabs-certificate-${widget.cert['tier']}.pdf',
      );
      await file.writeAsBytes(bytes);
      if (mounted) {
        await Share.shareXFiles([XFile(file.path)]);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not download certificate: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isDownloading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cert = widget.cert;
    final isActive = cert['status'] == 'active';

    return BrandCard(
      padding: const EdgeInsets.all(18),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              gradient: Brand.premiumGradient,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.workspace_premium_rounded,
              color: Colors.white,
              size: 26,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  cert['tier_name'] as String,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: Brand.navy,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  isActive
                      ? 'Issued ${cert['issued_at']}'
                      : '${cert['status']}',
                  style: const TextStyle(
                    color: Brand.textMuted,
                    fontSize: 12.5,
                  ),
                ),
              ],
            ),
          ),
          _isDownloading
              ? const SizedBox(
                  height: 22,
                  width: 22,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : IconButton(
                  icon: const Icon(
                    Icons.ios_share_rounded,
                    color: Brand.primary,
                  ),
                  onPressed: isActive ? _downloadAndShare : null,
                ),
        ],
      ),
    );
  }
}

final _certificatesProvider = FutureProvider((ref) {
  return ref.watch(certificatesRepositoryProvider).fetchCertificates();
});
