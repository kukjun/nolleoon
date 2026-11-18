import '../../receipt_fake.dart';

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/main.dart';
import 'package:nolleoon_mobile/auth/auth_repository.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/profile/profile_avatar.dart';

import '../../auth_test.dart' as f;

class ShellBackend extends f.Backend {
  @override
  AuthSession get session => AuthSession(
    token: 'a' * 43,
    expiresAt: DateTime.now().add(const Duration(days: 7)),
    accountId: 'account-a',
    displayName: '합성',
  );
}

Map<String, Object?> room() => {
  'roomId': 'room-a',
  'title': '합성 여행',
  'startDate': null,
  'endDate': null,
  'status': 'open',
  'version': 0,
  'self': {'membershipId': 'member-a', 'isAdmin': true},
  'members': [
    {
      'membershipId': 'member-a',
      'nickname': '첫 사람',
      'presetId': 'preset-01',
      'connected': true,
      'isAdmin': true,
    },
    {
      'membershipId': 'member-b',
      'nickname': '둘째 사람',
      'presetId': 'preset-02',
      'connected': true,
      'isAdmin': false,
    },
  ],
  'activeRun': null,
};

class ShellTransport implements ApiTransport {
  final requests = <TransportRequest>[];
  int deletions = 0;
  Map<String, Object?>? run;
  Map<String, Object?> makeRun(String status) => {
    'runId': 'run-a',
    'roomId': 'room-a',
    'type': 'team',
    'status': status,
    'version': status == 'draft' ? 0 : 1,
    'facilitatorMembershipId': 'member-a',
    'selectedMembershipIds': ['member-a', 'member-b'],
    'createdAt': 1,
    'startedAt': status == 'draft' ? null : 2,
    'endedAt': status == 'completed' ? 2 : null,
    'isParticipant': true,
    'game': {
      'kind': 'team',
      'teamCount': 2,
      'assignments': status == 'draft'
          ? []
          : [
              {'membershipId': 'member-a', 'team': 1},
              {'membershipId': 'member-b', 'team': 2},
            ],
    },
  };
  @override
  Future<TransportResponse> send(
    TransportRequest r,
    CancellationToken cancel,
  ) async {
    requests.add(r);
    Object body;
    switch (r.uri.path) {
      case '/api/native/travel-rooms':
        body = {
          'items': [
            {
              'roomId': 'room-a',
              'title': '합성 여행',
              'startDate': null,
              'endDate': null,
              'status': 'open',
              'version': 0,
              'isAdmin': true,
              'memberCount': 2,
            },
          ],
          'nextCursor': null,
        };
      case '/api/native/travel-rooms/room-a':
        body = room();
      case '/api/native/travel-rooms/room-a/runs':
        run = makeRun('draft');
        body = run!;
      case '/api/native/travel-rooms/room-a/runs/run-a':
        body = run!;
      case '/api/native/travel-rooms/room-a/runs/run-a/start':
        run = makeRun('completed');
        body = run!;
      case '/api/native/travel-deleted-rooms':
        body = {'items': []};
      case '/api/native/travel-rooms/room-a/history':
        body = {'items': [], 'nextCursor': null};
      case '/api/native/account/session':
        body = {
          'authenticated': true,
          'expiresAt': 9999999999999,
          'account': {
            'id': 'account-a',
            'displayName': '프로필 이름',
            'presetId': 'preset-01',
            'revision': 0,
            'avatar': {
              'kind': 'preset',
              'presetId': 'preset-01',
              'revision': 0,
              'imageUrl': null,
            },
          },
        };
      case '/api/native/account/delete':
        deletions++;
        body = {'deleted': true};
      default:
        return const TransportResponse(404, '{"error":{"code":"NOT_FOUND"}}');
    }
    return TransportResponse(200, jsonEncode(body));
  }
}

void main() {
  for (final width in [320.0, 390.0]) {
    testWidgets(
      'root connects profile room game management history and hides background at $width',
      (tester) async {
        tester.view.physicalSize = Size(width, 900);
        tester.view.devicePixelRatio = 1;
        tester.platformDispatcher.textScaleFactorTestValue = width == 390
            ? 1.6
            : 1;
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final auth = AuthRepository(
          identity: f.Provider(),
          backend: ShellBackend(),
          store: f.Store(),
        );
        final t = ShellTransport();
        await tester.pumpWidget(
          MyApp(deletionReceiptStore: ReceiptFake(), auth: auth, transport: t),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.text('카카오로 로그인'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('내 프로필'));
        await tester.pumpAndSettle();
        expect(find.text('프로필 이름'), findsOneWidget);
        await tester.pageBack();
        await tester.pumpAndSettle();
        await tester.tap(find.text('합성 여행'));
        await tester.pumpAndSettle();
        await tester.scrollUntilVisible(
          find.text('새 게임'),
          150,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.tap(find.text('새 게임'));
        await tester.pumpAndSettle();
        expect(find.text('팀 나누기'), findsOneWidget);
        expect(find.text('제비뽑기'), findsOneWidget);
        expect(find.text('메뉴 고르기'), findsOneWidget);
        expect(find.text('재판'), findsOneWidget);
        tester.binding.handleAppLifecycleStateChanged(
          AppLifecycleState.inactive,
        );
        await tester.pump();
        expect(find.text('첫 사람'), findsNothing);
        tester.binding.handleAppLifecycleStateChanged(
          AppLifecycleState.resumed,
        );
        await tester.pumpAndSettle();
        expect(find.text('팀 나누기'), findsOneWidget);
        await tester.pageBack();
        await tester.pumpAndSettle();
        await tester.scrollUntilVisible(
          find.text('방 관리'),
          150,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.tap(find.text('방 관리'));
        await tester.pumpAndSettle();
        expect(find.text('여행방 관리'), findsOneWidget);
        await tester.tap(find.byTooltip('이전 화면'));
        await tester.pumpAndSettle();
        await tester.scrollUntilVisible(
          find.text('게임 기록'),
          150,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.tap(find.text('게임 기록'));
        await tester.pumpAndSettle();
        expect(t.requests.any((r) => r.uri.path.endsWith('/history')), isTrue);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
        auth.dispose();
      },
    );
  }
  testWidgets(
    'root team configuration cancellation sends nothing then server result renders',
    (tester) async {
      final auth = AuthRepository(
        identity: f.Provider(),
        backend: ShellBackend(),
        store: f.Store(),
      );
      final t = ShellTransport();
      await tester.pumpWidget(
        MyApp(deletionReceiptStore: ReceiptFake(), auth: auth, transport: t),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('카카오로 로그인'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('합성 여행'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('새 게임'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('새 게임'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('첫 사람'));
      await tester.tap(find.text('둘째 사람'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('게임 설정'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('게임 설정'));
      await tester.pumpAndSettle();
      expect(find.text('첫 사람'), findsOneWidget);
      await tester.tap(find.text('취소'));
      await tester.pumpAndSettle();
      expect(t.run, isNull);
      await tester.tap(find.text('게임 설정'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('설정 적용'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('게임 시작'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('게임 시작'));
      await tester.pumpAndSettle();
      expect(find.text('팀 나누기 결과'), findsOneWidget);
      expect(find.text('첫 사람'), findsOneWidget);
      expect(
        tester
            .widgetList<ProfileAvatar>(find.byType(ProfileAvatar))
            .map((a) => a.presetId),
        containsAll(['preset-01', 'preset-02']),
      );
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();
      expect(find.text('팀 나누기 결과'), findsNothing);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expect(find.text('팀 나누기 결과'), findsOneWidget);

      expect(t.requests.where((r) => r.uri.path.endsWith('/start')).length, 1);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      auth.dispose();
    },
  );
  testWidgets('verified deletion uses local cleanup and no remote logout', (
    tester,
  ) async {
    final backend = ShellBackend();
    final store = f.Store();
    final auth = AuthRepository(
      identity: f.Provider(),
      backend: backend,
      store: store,
    );
    final t = ShellTransport();
    await tester.pumpWidget(
      MyApp(deletionReceiptStore: ReceiptFake(), auth: auth, transport: t),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('카카오로 로그인'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('계정 탈퇴'));
    await tester.pumpAndSettle();
    expect(find.text('계정 탈퇴'), findsWidgets);
    expect(t.deletions, 0);
    await tester.scrollUntilVisible(find.text('탈퇴 최종 확인으로'), 250);
    await tester.tap(find.text('탈퇴 최종 확인으로'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '계정 탈퇴');
    tester.testTextInput.hide();
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('계정 영구 탈퇴'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('계정 영구 탈퇴'));
    await tester.pumpAndSettle();
    expect(t.deletions, 1);
    expect(backend.logouts, 0);
    expect(store.value, isNull);
    expect(find.text('계정 탈퇴와 기기 정보 정리를 완료했어요.'), findsOneWidget);
    await tester.tap(find.text('로그인 화면으로'));
    await tester.pumpAndSettle();
    expect(find.text('카카오로 로그인'), findsOneWidget);
    expect(t.deletions, 1);
    await tester.pumpWidget(const SizedBox.shrink());
    auth.dispose();
  });
}
