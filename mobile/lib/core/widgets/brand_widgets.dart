import 'package:flutter/material.dart';

import '../theme.dart';

/// White rounded card — mirrors the site's `Card` component
/// (rounded-2xl, white, gray-100 border, soft shadow).
class BrandCard extends StatelessWidget {
  const BrandCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.onTap,
    this.gradient,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Gradient? gradient;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      decoration: BoxDecoration(
        color: gradient == null ? Colors.white : null,
        gradient: gradient,
        borderRadius: BorderRadius.circular(16),
        border: gradient == null ? Border.all(color: Brand.cardBorder) : null,
        boxShadow: [
          BoxShadow(
            color: (gradient != null ? Brand.deepBlue : Colors.black).withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: padding,
      child: child,
    );

    if (onTap == null) return card;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: card,
      ),
    );
  }
}

/// Gradient progress bar — mirrors the site's ProgressBar
/// (primary → cyan → teal on a gray track).
class BrandProgressBar extends StatelessWidget {
  const BrandProgressBar({super.key, required this.value, this.height = 10});

  /// 0.0 – 1.0
  final double value;
  final double height;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(height / 2),
      child: Container(
        height: height,
        color: Colors.white.withValues(alpha: 0.25),
        alignment: Alignment.centerLeft,
        child: FractionallySizedBox(
          widthFactor: value.clamp(0.0, 1.0),
          child: Container(
            decoration: BoxDecoration(
              gradient: Brand.progressGradient,
              borderRadius: BorderRadius.circular(height / 2),
            ),
          ),
        ),
      ),
    );
  }
}

/// Pill badge — mirrors the site's Badge component.
class BrandBadge extends StatelessWidget {
  const BrandBadge(this.label, {super.key, this.background, this.foreground, this.gradient});

  final String label;
  final Color? background;
  final Color? foreground;
  final Gradient? gradient;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: gradient == null ? (background ?? const Color(0xFFF3F4F6)) : null,
        gradient: gradient,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: gradient != null ? Colors.white : (foreground ?? Brand.navy),
        ),
      ),
    );
  }
}

/// The "M" logo tile used on the site's auth branding panel
/// (gradient primary → cyan, rounded-2xl).
class BrandLogoTile extends StatelessWidget {
  const BrandLogoTile({super.key, this.size = 64});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Brand.primary, Brand.cyan],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Brand.primary.withValues(alpha: 0.3),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        'M',
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w800,
          fontSize: size * 0.45,
        ),
      ),
    );
  }
}

/// Parses the API's `accent_color` hex ("#2F67C7") with a brand fallback.
Color accentColorFrom(String? hex) {
  if (hex == null || hex.length != 7 || !hex.startsWith('#')) return Brand.primary;
  final value = int.tryParse(hex.substring(1), radix: 16);
  return value == null ? Brand.primary : Color(0xFF000000 | value);
}
