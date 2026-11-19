import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

Finder enabledProbeButton(Finder content) {
  // M3 IconButton contains an internal ButtonStyleButton. Resolve the public
  // icon owner first so one action is not counted twice. Keep disabled icons
  // in this check so their implementation cannot bypass public readiness.
  final icons = find.ancestor(of: content, matching: find.byType(IconButton));
  if (icons.evaluate().isNotEmpty) {
    return find.ancestor(
      of: content,
      matching: find.byWidgetPredicate(
        (widget) => widget is IconButton && widget.onPressed != null,
      ),
    );
  }
  return find.ancestor(
    of: content,
    matching: find.byWidgetPredicate(
      (widget) => widget is ButtonStyleButton && widget.onPressed != null,
    ),
  );
}

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
