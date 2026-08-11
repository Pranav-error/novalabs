import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Brand palette — mirrors frontend/tailwind.config.ts `colors.brand` exactly,
/// so the app and website read as one product.
abstract final class Brand {
  static const deepBlue = Color(0xFF2236A8);
  static const primary = Color(0xFF2F67C7);
  static const cyan = Color(0xFF32D3E6);
  static const teal = Color(0xFF22C7D4);
  static const purple = Color(0xFF8A2BBE);
  static const magenta = Color(0xFFD21D8E);
  static const pink = Color(0xFFF02B8F);
  static const navy = Color(0xFF1B237A);

  /// Page background — the site uses a near-white gray behind white cards.
  static const background = Color(0xFFF7F8FA);
  static const cardBorder = Color(0xFFF3F4F6); // tailwind gray-100
  static const textMuted = Color(0xFF6B7280); // tailwind gray-500

  /// Hero gradient (dashboard welcome card): primary → deep-blue.
  static const heroGradient = LinearGradient(
    colors: [primary, deepBlue],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  /// Progress gradient: primary → cyan → teal.
  static const progressGradient = LinearGradient(
    colors: [primary, cyan, teal],
  );

  /// Premium gradient (secondary buttons / premium badges): purple → magenta.
  static const premiumGradient = LinearGradient(
    colors: [purple, magenta],
  );

  /// Auth-branding gradient: navy → deep-blue → primary.
  static const brandingGradient = LinearGradient(
    colors: [navy, deepBlue, primary],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

ThemeData buildBrandTheme() {
  final textTheme = GoogleFonts.interTextTheme().apply(
    bodyColor: Brand.navy,
    displayColor: Brand.navy,
  );
  final display = GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, color: Brand.navy);

  return ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: Brand.background,
    colorScheme: ColorScheme.fromSeed(
      seedColor: Brand.primary,
      primary: Brand.primary,
      secondary: Brand.teal,
      surface: Colors.white,
      onSurface: Brand.navy,
    ),
    textTheme: textTheme.copyWith(
      headlineMedium: display.copyWith(fontSize: 28),
      headlineSmall: display.copyWith(fontSize: 24),
      titleLarge: display.copyWith(fontSize: 20),
      titleMedium: GoogleFonts.plusJakartaSans(
          fontSize: 16, fontWeight: FontWeight.w600, color: Brand.navy),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: Brand.background,
      foregroundColor: Brand.navy,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      titleTextStyle: GoogleFonts.plusJakartaSans(
          fontSize: 18, fontWeight: FontWeight.w700, color: Brand.navy),
    ),
    cardTheme: const CardThemeData(
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(16)),
        side: BorderSide(color: Brand.cardBorder),
      ),
      margin: EdgeInsets.zero,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Brand.primary,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600),
        elevation: 4,
        shadowColor: Brand.primary.withValues(alpha: 0.25),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: Brand.primary,
        minimumSize: const Size.fromHeight(52),
        side: const BorderSide(color: Brand.primary, width: 1.5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: Brand.primary,
        textStyle: GoogleFonts.inter(fontWeight: FontWeight.w600),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      labelStyle: GoogleFonts.inter(color: Brand.textMuted, fontSize: 14),
      hintStyle: GoogleFonts.inter(color: const Color(0xFF9CA3AF), fontSize: 14),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Brand.primary, width: 2),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: Brand.primary.withValues(alpha: 0.12),
      surfaceTintColor: Colors.transparent,
      labelTextStyle: WidgetStatePropertyAll(
        GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: Brand.navy),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected) ? Brand.primary : Brand.textMuted,
        ),
      ),
    ),
    tabBarTheme: const TabBarThemeData(
      labelColor: Brand.primary,
      unselectedLabelColor: Brand.textMuted,
      indicatorColor: Brand.primary,
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: Brand.navy,
      contentTextStyle: GoogleFonts.inter(color: Colors.white),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  );
}
