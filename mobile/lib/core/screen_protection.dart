import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Screen-capture state, for the platforms that expose it.
///
/// Android blocks capture outright via FLAG_SECURE in MainActivity, so nothing
/// is needed here. iOS cannot block it, but reports when a recording is running
/// and after a screenshot is taken — so protected content hides itself while
/// `isCaptured` is true.
class ScreenProtection extends ChangeNotifier {
  ScreenProtection() {
    if (_supported) {
      _channel.setMethodCallHandler(_onCall);
      _refresh();
    }
  }

  static const _channel = MethodChannel('novalabs/screen_protection');

  // Only iOS forwards these; Android relies on FLAG_SECURE instead.
  bool get _supported => !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS;

  bool _isCaptured = false;
  int _screenshotCount = 0;

  /// True while the screen is being recorded or mirrored.
  bool get isCaptured => _isCaptured;

  /// Screenshots taken during this session — surfaced so the UI can remind the
  /// learner that content is watermarked with their account.
  int get screenshotCount => _screenshotCount;

  Future<void> _refresh() async {
    try {
      final captured = await _channel.invokeMethod<bool>('isCaptured');
      if (captured != null && captured != _isCaptured) {
        _isCaptured = captured;
        notifyListeners();
      }
    } on PlatformException {
      // Detection is best-effort; never break playback over it.
    }
  }

  Future<dynamic> _onCall(MethodCall call) async {
    switch (call.method) {
      case 'captureChanged':
        _isCaptured = call.arguments == true;
        notifyListeners();
        break;
      case 'screenshotTaken':
        _screenshotCount++;
        notifyListeners();
        break;
    }
    return null;
  }
}

/// App-wide capture state. Android does not need it (FLAG_SECURE blocks
/// capture outright), so on Android this simply never reports a capture.
final screenProtectionProvider = ChangeNotifierProvider<ScreenProtection>(
  (ref) => ScreenProtection(),
);

/// Wraps protected content: hides it while a screen recording is active and
/// keeps a per-learner watermark over the top otherwise.
class ProtectedContent extends StatelessWidget {
  const ProtectedContent({
    super.key,
    required this.child,
    required this.watermark,
    this.protection,
    this.onDarkBackground = false,
  });

  final Widget child;

  /// Usually the learner's email — makes any leaked capture attributable.
  final String watermark;
  final ScreenProtection? protection;

  /// White text reads on a video; day content sits on a light background and
  /// needs dark text or the watermark is invisible.
  final bool onDarkBackground;

  @override
  Widget build(BuildContext context) {
    final guard = protection;
    if (guard == null) return _watermarked(child);

    return AnimatedBuilder(
      animation: guard,
      builder: (context, _) {
        if (guard.isCaptured) {
          return Container(
            color: Colors.black,
            alignment: Alignment.center,
            child: const Padding(
              padding: EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.videocam_off_rounded,
                    color: Colors.white70,
                    size: 34,
                  ),
                  SizedBox(height: 12),
                  Text(
                    'Course content is hidden while your screen is being recorded.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white70, fontSize: 14),
                  ),
                  SizedBox(height: 6),
                  Text(
                    'Stop the recording to continue.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white38, fontSize: 12),
                  ),
                ],
              ),
            ),
          );
        }
        return _watermarked(child);
      },
    );
  }

  Widget _watermarked(Widget content) {
    return Stack(
      children: [
        content,
        // Low-contrast and non-interactive: readable enough in a capture to
        // identify the account, quiet enough not to spoil normal viewing.
        Positioned.fill(
          child: IgnorePointer(
            child: Align(
              alignment: Alignment.bottomRight,
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Text(
                  watermark,
                  style: TextStyle(
                    color: onDarkBackground
                        ? Colors.white.withValues(alpha: 0.32)
                        : Colors.black.withValues(alpha: 0.22),
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    shadows: onDarkBackground
                        ? const [Shadow(color: Colors.black45, blurRadius: 2)]
                        : null,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
