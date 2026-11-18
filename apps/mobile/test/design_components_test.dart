import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/design/app_components.dart';

Widget host(Widget child) => MaterialApp(home: Scaffold(body: child));
void main() {
  testWidgets('primary action blocks duplicate taps until request completes', (
    tester,
  ) async {
    final pending = Completer<void>();
    var calls = 0;
    await tester.pumpWidget(
      host(
        AppAction(
          label: '저장',
          onPressed: () {
            calls++;
            return pending.future;
          },
        ),
      ),
    );
    await tester.tap(find.text('저장'));
    await tester.pump();
    await tester.tap(find.byType(FilledButton));
    await tester.pump();
    expect(calls, 1);
    expect(find.text('처리 중이에요'), findsOneWidget);
    expect(
      tester.getSize(find.byType(FilledButton)).height,
      greaterThanOrEqualTo(48),
    );
    pending.complete();
    await tester.pumpAndSettle();
    expect(find.text('저장'), findsOneWidget);
  });
  testWidgets('async action failure exposes retry without claiming success', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        AppAction(
          label: '다시 확인',
          onPressed: () async => throw StateError('private response'),
        ),
      ),
    );
    await tester.tap(find.text('다시 확인'));
    await tester.pumpAndSettle();
    expect(find.text('완료하지 못했어요. 다시 시도해 주세요.'), findsOneWidget);
    expect(find.textContaining('private response'), findsNothing);
  });
  testWidgets(
    'dirty step cancel keeps draft and repeated taps open one confirmation',
    (tester) async {
      var exits = 0;
      final controller = TextEditingController(text: '작성 중');
      addTearDown(controller.dispose);
      await tester.pumpWidget(
        host(
          StepPage(
            title: '설정',
            currentStep: 1,
            totalSteps: 3,
            hasUnsavedChanges: true,
            onBack: () => exits++,
            child: TextField(controller: controller),
          ),
        ),
      );
      final back = tester.widget<IconButton>(find.byType(IconButton));
      back.onPressed!();
      back.onPressed!();
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      await tester.tap(find.text('계속 작성'));
      await tester.pumpAndSettle();
      expect(exits, 0);
      expect(controller.text, '작성 중');
      await tester.tap(find.byTooltip('이전 단계'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('나가기'));
      await tester.pumpAndSettle();
      expect(exits, 1);
    },
  );
  testWidgets(
    '320px large text keyboard inset stays scrollable and announces step/error',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      tester.view.viewInsets = const FakeViewPadding(bottom: 260);
      addTearDown(tester.view.resetViewInsets);
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      final semantics = tester.ensureSemantics();
      try {
        await tester.pumpWidget(
          host(
            StepPage(
              title: '길어도 읽을 수 있는 단계 제목',
              currentStep: 2,
              totalSteps: 3,
              hasUnsavedChanges: false,
              onBack: () {},
              child: Column(
                children: [
                  const AppStatus(message: '서버에 연결되지 않았어요', isError: true),
                  const TextField(),
                  AppAction(label: '다시 확인', onPressed: () async {}),
                ],
              ),
            ),
          ),
        );
        expect(find.bySemanticsLabel('3단계 중 2단계'), findsOneWidget);
        expect(find.text('서버에 연결되지 않았어요'), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    },
  );
  testWidgets(
    'system back waits for confirmation then permits parent route pop',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (routeContext) => Scaffold(
                      body: StepPage(
                        title: '작성',
                        currentStep: 1,
                        totalSteps: 2,
                        hasUnsavedChanges: true,
                        onBack: () => Navigator.of(routeContext).pop(),
                        child: const Text('보존된 초안'),
                      ),
                    ),
                  ),
                ),
                child: const Text('열기'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('열기'));
      await tester.pumpAndSettle();
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      await tester.tap(find.text('계속 작성'));
      await tester.pumpAndSettle();
      expect(find.text('보존된 초안'), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      await tester.tap(find.text('나가기'));
      await tester.pumpAndSettle();
      expect(find.text('열기'), findsOneWidget);
      expect(find.text('보존된 초안'), findsNothing);
    },
  );
}
