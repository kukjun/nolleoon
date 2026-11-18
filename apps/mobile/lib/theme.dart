import 'package:material_ui/material_ui.dart';

ThemeData buildAppTheme() => ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff1e40af)),
  scaffoldBackgroundColor: const Color(0xfffaf9f6),
  materialTapTargetSize: MaterialTapTargetSize.padded,
  textTheme: const TextTheme(
    headlineSmall: TextStyle(
      fontSize: 26,
      height: 1.35,
      fontWeight: FontWeight.w700,
    ),
    bodyLarge: TextStyle(fontSize: 17, height: 1.6),
  ),
);
