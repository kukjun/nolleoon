import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/auth/auth_repository.dart';
import 'package:nolleoon_mobile/auth/kakao_identity.dart';
import 'package:nolleoon_mobile/features/auth/auth_panel.dart';

import 'auth_test.dart' as fakes;

void main() {
  test('native key alone cannot enable unfinished platform setup', () {
    expect(NativeKakaoIdentity(nativeAppKey: 'synthetic').configured, false);
    expect(
      NativeKakaoIdentity(
        nativeAppKey: '',
        platformSetupVerified: true,
      ).configured,
      false,
    );
  });
  testWidgets('320 large text disabled login and resume never start provider', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final provider = fakes.Provider()..enabled = false;
    final auth = AuthRepository(
      identity: provider,
      backend: fakes.Backend(),
      store: fakes.Store(),
    );
    addTearDown(auth.dispose);
    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(textScaler: TextScaler.linear(2)),
          child: child!,
        ),
        home: Scaffold(body: AuthPanel(auth: auth)),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('아직 카카오 로그인을'), findsOneWidget);
    final button = tester.widget<FilledButton>(find.byType(FilledButton));
    expect(button.onPressed, null);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(provider.calls, 0);
    expect(tester.takeException(), null);
  });
  testWidgets('unmounted provider return never emits widget callback', (
    tester,
  ) async {
    final auth = AuthRepository(
      identity: fakes.Provider(),
      backend: fakes.Backend(),
      store: fakes.Store(),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: AuthPanel(auth: auth)),
      ),
    );
    await tester.pumpAndSettle();
    await tester.pumpWidget(const SizedBox());
    await auth.login();
    expect(tester.takeException(), null);
    auth.dispose();
  });
  testWidgets(
    'unresolved stored identity offers retry/logout but disables new login',
    (tester) async {
      final store = fakes.Store()..value = 'existing-account';
      final backend = fakes.Backend()..offline = true;
      final provider = fakes.Provider();
      final auth = AuthRepository(
        identity: provider,
        backend: backend,
        store: store,
      );
      addTearDown(auth.dispose);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: AuthPanel(auth: auth)),
        ),
      );
      await tester.pumpAndSettle();
      final login = find.ancestor(
        of: find.text('카카오로 로그인'),
        matching: find.byType(FilledButton),
      );
      expect(tester.widget<FilledButton>(login).onPressed, null);
      expect(find.text('로그인 상태 다시 확인'), findsOneWidget);
      expect(find.text('기존 세션 로그아웃'), findsOneWidget);
      expect(provider.calls, 0);
      backend.offline = false;
      await tester.tap(find.text('기존 세션 로그아웃'));
      await tester.pumpAndSettle();
      expect(store.value, null);
      expect(tester.widget<FilledButton>(login).onPressed, isNotNull);
    },
  );
}
