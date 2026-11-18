import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/main.dart';

void main() {
  testWidgets(
    'initial screen identifies the app and does not pretend games or login are ready',
    (tester) async {
      await tester.pumpWidget(const MyApp());
      await tester.pumpAndSettle();
      expect(find.text('놀러온'), findsOneWidget);
      expect(find.textContaining('아직 카카오 로그인을'), findsOneWidget);
      expect(find.text('로그인했어요.'), findsNothing);
      expect(
        tester
            .widget<FilledButton>(
              find.ancestor(
                of: find.text('카카오로 로그인'),
                matching: find.byType(FilledButton),
              ),
            )
            .onPressed,
        isNull,
      );
      expect(find.byType(FloatingActionButton), findsNothing);
    },
  );
  testWidgets(
    '320px and large text keep preparation notice readable without overflow',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await tester.pumpWidget(const MyApp());
      await tester.pumpAndSettle();
      expect(find.textContaining('아직 카카오 로그인을'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
