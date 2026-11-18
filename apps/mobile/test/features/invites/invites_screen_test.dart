import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/navigation/invite_link.dart';
import 'package:nolleoon_mobile/features/invites/invites_repository.dart';
import 'package:nolleoon_mobile/features/invites/invites_controller.dart';
import 'package:nolleoon_mobile/features/invites/invites_screen.dart';

import 'invites_test.dart' show Transport, ok, room, linkA;

void main() {
  testWidgets(
    '320px cancelled login keeps invitation, explicit join only after account confirmation',
    (tester) async {
      tester.view.physicalSize = const Size(320, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final t = Transport();
      t.handler = (r) async => r.method == 'GET'
          ? ok({'available': true, 'loginRequired': true})
          : ok(room());
      final pending = PendingInvitation();
      final c = InvitesController(
        InvitesRepository(
          ApiClient(
            transport: t,
            resolver: const NativeRoutes(),
            accessToken: () async => 'synthetic',
          ),
        ),
        pending,
      );
      addTearDown(c.dispose);
      await c.open(linkA);
      int login = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: InvitationScreen(
            controller: c,
            onLoginRequested: () async {
              login++;
            },
            onCancel: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('로그인하고 초대 확인'));
      await tester.pumpAndSettle();
      expect(login, 1);
      expect(pending.current, isNotNull);
      expect(t.requests.length, 1);
      c.setAccount('account-a');
      await tester.pumpAndSettle();
      expect(t.requests.length, 1);
      await tester.tap(find.text('여행방 참가'));
      await tester.pumpAndSettle();
      expect(t.requests.length, 2);
      expect(find.text('참가했어요. 여행방으로 이동해 주세요.'), findsOneWidget);
      expect(tester.takeException(), null);
    },
  );
  testWidgets('explicit close clears only this invitation and does not join', (
    tester,
  ) async {
    final t = Transport();
    t.handler = (r) async => ok({'available': true, 'loginRequired': true});
    final pending = PendingInvitation();
    final c = InvitesController(
      InvitesRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => null,
        ),
      ),
      pending,
    );
    addTearDown(c.dispose);
    await c.open(linkA);
    bool closed = false;
    await tester.pumpWidget(
      MaterialApp(
        home: InvitationScreen(
          controller: c,
          onLoginRequested: () async {},
          onCancel: () {
            closed = true;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('초대 닫기'));
    await tester.pumpAndSettle();
    expect(closed, true);
    expect(pending.current, null);
    expect(t.requests.length, 1);
  });
}
