import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/theme.dart';

void main() {
  test(
    'theme uses padded touch targets and readable surface text contrast',
    () {
      final theme = buildAppTheme();
      expect(theme.materialTapTargetSize, MaterialTapTargetSize.padded);
      final surface = theme.colorScheme.surface.computeLuminance();
      final text = theme.colorScheme.onSurface.computeLuminance();
      final contrast = (surface + .05) / (text + .05);
      expect(contrast, greaterThanOrEqualTo(4.5));
    },
  );
}
