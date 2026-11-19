import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

Finder enabledProbeButton(Finder content) => find.ancestor(
  of: content,
  matching: find.byWidgetPredicate(
    (widget) =>
        widget is ButtonStyleButton && widget.onPressed != null ||
        widget is IconButton && widget.onPressed != null,
  ),
);

Future<void> tapReadyProbeAction(
  WidgetTester tester,
  Finder content, {
  bool Function()? ready,
}) async {
  final until = DateTime.now().add(const Duration(seconds: 20));
  while (DateTime.now().isBefore(until)) {
    await tester.pump(const Duration(milliseconds: 100));
    final buttons = enabledProbeButton(content);
    if ((ready?.call() ?? true) && buttons.evaluate().length == 1) {
      await tester.ensureVisible(buttons);
      await tester.pump();
      if ((ready?.call() ?? true) && buttons.evaluate().length == 1) {
        await tester.tap(buttons);
        await tester.pump();
        return;
      }
    }
  }
  fail('Probe action never became enabled');
}
