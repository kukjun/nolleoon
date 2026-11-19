import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../../test_targets/probe_actions.dart';

void main() {
  testWidgets('M3 back icon resolves one public button and taps once', (
    tester,
  ) async {
    var calls = 0;
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: Scaffold(
          appBar: AppBar(
            leading: IconButton(
              tooltip: '목록으로',
              onPressed: () => calls++,
              icon: const Icon(Icons.arrow_back),
            ),
          ),
        ),
      ),
    );
    final icon = find.descendant(
      of: find.byTooltip('목록으로'),
      matching: find.byType(Icon),
    );
    expect(icon, findsOneWidget);
    expect(enabledProbeButton(icon), findsOneWidget);
    expect(tester.widget(enabledProbeButton(icon)), isA<IconButton>());
    await tapReadyProbeAction(tester, icon);
    expect(calls, 1);
  });
  testWidgets(
    'present disabled label is not readiness; waits enabled callback',
    (tester) async {
      bool enabled = false;
      int calls = 0;
      late StateSetter update;
      await tester.pumpWidget(
        MaterialApp(
          home: StatefulBuilder(
            builder: (context, setState) {
              update = setState;
              return FilledButton(
                onPressed: enabled ? () => calls++ : null,
                child: const Text('action'),
              );
            },
          ),
        ),
      );
      expect(find.text('action'), findsOneWidget);
      expect(enabledProbeButton(find.text('action')), findsNothing);
      Timer(const Duration(milliseconds: 300), () {
        update(() => enabled = true);
      });
      final tap = tapReadyProbeAction(
        tester,
        find.text('action'),
        ready: () => enabled,
      );

      await tap;
      expect(calls, 1);
    },
  );
}
