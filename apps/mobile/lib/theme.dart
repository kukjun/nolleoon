import 'package:material_ui/material_ui.dart';

import 'design/app_tokens.dart';

ThemeData buildAppTheme() {
  const buttonShape = RoundedRectangleBorder(
    borderRadius: BorderRadius.all(Radius.circular(AppTokens.buttonRadius)),
  );
  final button = FilledButton.styleFrom(
    minimumSize: const Size(AppTokens.tap, AppTokens.tap),
    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
    shape: buttonShape,
    textStyle: const TextStyle(
      fontSize: 15,
      height: 1.5,
      fontWeight: FontWeight.w600,
    ),
  );
  const border = OutlineInputBorder(
    borderRadius: BorderRadius.all(Radius.circular(AppTokens.controlRadius)),
    borderSide: BorderSide(color: Color(0xffc7d4c9)),
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: const ColorScheme.light(
      primary: AppTokens.primary,
      onPrimary: AppTokens.onPrimary,
      primaryContainer: AppTokens.primarySoft,
      onPrimaryContainer: Color(0xff174bc7),
      secondary: AppTokens.selected,
      onSecondary: AppTokens.surface,
      surface: AppTokens.surface,
      onSurface: AppTokens.ink,
      onSurfaceVariant: AppTokens.muted,
      outline: AppTokens.line,
      error: AppTokens.danger,
      onError: AppTokens.surface,
    ),
    scaffoldBackgroundColor: AppTokens.canvas,
    materialTapTargetSize: MaterialTapTargetSize.padded,
    textTheme: const TextTheme(
      headlineSmall: TextStyle(
        fontSize: 28,
        height: 1.4,
        letterSpacing: -1,
        fontWeight: FontWeight.w700,
        color: AppTokens.ink,
      ),
      titleLarge: TextStyle(
        fontSize: 21,
        height: 1.5,
        fontWeight: FontWeight.w700,
        color: AppTokens.ink,
      ),
      titleMedium: TextStyle(
        fontSize: 16,
        height: 1.5,
        fontWeight: FontWeight.w600,
        color: AppTokens.ink,
      ),
      bodyLarge: TextStyle(fontSize: 16, height: 1.65, color: AppTokens.ink),
      bodyMedium: TextStyle(fontSize: 16, height: 1.65, color: AppTokens.ink),
      bodySmall: TextStyle(fontSize: 13, height: 1.7, color: AppTokens.muted),
      labelLarge: TextStyle(
        fontSize: 15,
        height: 1.5,
        fontWeight: FontWeight.w600,
      ),
    ),
    cardTheme: const CardThemeData(
      color: AppTokens.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.symmetric(vertical: 14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(AppTokens.cardRadius)),
        side: BorderSide(color: AppTokens.line),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(style: button),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: button.copyWith(
        side: const WidgetStatePropertyAll(BorderSide(color: AppTokens.line)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        minimumSize: const Size(AppTokens.tap, AppTokens.tap),
        shape: buttonShape,
      ),
    ),
    inputDecorationTheme: const InputDecorationThemeData(
      filled: true,
      fillColor: AppTokens.surface,
      border: border,
      enabledBorder: border,
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.all(
          Radius.circular(AppTokens.controlRadius),
        ),
        borderSide: BorderSide(color: AppTokens.focus, width: 3),
      ),
      contentPadding: EdgeInsets.all(12),
    ),
    dividerTheme: const DividerThemeData(color: AppTokens.line, thickness: 1),
    appBarTheme: const AppBarThemeData(
      backgroundColor: AppTokens.canvas,
      foregroundColor: AppTokens.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
    ),
  );
}
