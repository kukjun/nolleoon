import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../../test_targets/probe_actions.dart';

void main() {
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
