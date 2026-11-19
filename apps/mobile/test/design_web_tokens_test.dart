import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/theme.dart';
import 'package:nolleoon_mobile/design/app_tokens.dart';

void main() {
  test('travel theme matches current web travel surfaces and shared CTA, not legacy party palette', () {
    final t = buildAppTheme();
    expect(t.scaffoldBackgroundColor, const Color(0xfffaf8f3));
    expect(t.colorScheme.surface, const Color(0xffffffff));
    expect(t.colorScheme.onSurface, const Color(0xff243a32));
    expect(t.colorScheme.primary, const Color(0xff245ce2));
    expect(t.colorScheme.outline, const Color(0xffdce3d9));
    expect(t.textTheme.bodyMedium!.fontSize, 16);
    expect(t.textTheme.bodyMedium!.height, 1.65);
    expect(t.textTheme.headlineSmall!.fontSize, 28);
    expect(t.cardTheme.elevation, 0);
    expect(
      (t.cardTheme.shape! as RoundedRectangleBorder).borderRadius,
      BorderRadius.circular(20),
    );
    expect(
      t.filledButtonTheme.style!.minimumSize!.resolve({}),
      const Size(48, 48),
    );
    expect(
      (t.filledButtonTheme.style!.shape!.resolve({})! as RoundedRectangleBorder)
          .borderRadius,
      BorderRadius.circular(AppTokens.buttonRadius),
    );
    for (final pair in [
      [AppTokens.ink, AppTokens.canvas],
      [AppTokens.muted, AppTokens.surface],
      [AppTokens.onPrimary, AppTokens.primary],
    ]) {
      final a = pair[0].computeLuminance(), b = pair[1].computeLuminance();
      expect(
        ((a > b ? a : b) + .05) / ((a > b ? b : a) + .05),
        greaterThanOrEqualTo(4.5),
      );
    }
  });
}
