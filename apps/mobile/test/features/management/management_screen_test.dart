import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/management/management_controller.dart';
import 'package:nolleoon_mobile/features/management/management_repository.dart';
import 'package:nolleoon_mobile/features/management/management_screen.dart';
import 'package:nolleoon_mobile/features/management/deleted_rooms_screen.dart';

import 'management_test.dart' as f;

ManagementRepository repo(ApiTransport t) => ManagementRepository(
  ApiClient(
    transport: t,
    resolver: const NativeRoutes(),
    accessToken: () async => 'synthetic',
  ),
  requestId: () => 'request-fixed',
);
Widget screen(f.FakeTransport t) => MaterialApp(
  home: ManagementScreen(
    repository: repo(t),
    roomId: 'room-example',
    accountId: 'account-a',
    recovery: ManagementRecovery('account-a'),
    onSessionLost: () {},
  ),
);

class DeletedTransport implements ApiTransport {
  final posts = <TransportRequest>[];
  bool restored = false;
  @override
  Future<TransportResponse> send(
    TransportRequest request,
    CancellationToken cancel,
  ) async {
    if (request.method == 'GET') {
      return TransportResponse(
        200,
        jsonEncode({
          'items': restored
              ? []
              : [
                  {
                    'roomId': 'room-example',
                    'title': '삭제한 방',
                    'deletionVersion': 4,
                    'deletedAt': 2000000000000,
                    'purgeAfter': 2000604800000,
                    'previousStatus': 'open',
                  },
                ],
        }),
      );
    }
    posts.add(request);
    restored = true;
    return TransportResponse(200, jsonEncode(f.roomFixture()));
  }
}

void main() {
  testWidgets(
    'administrator deletion requires visible confirmation and cancel sends nothing',
    (tester) async {
      final t = f.FakeTransport(f.roomFixture());
      await tester.pumpWidget(screen(t));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('방 삭제'));
      await tester.tap(find.text('방 삭제'));
      await tester.pumpAndSettle();
      expect(find.textContaining('7일 이내 복원'), findsOneWidget);
      expect(t.calls.where((r) => r.method == 'POST'), isEmpty);
      await tester.tap(find.text('취소'));
      await tester.pumpAndSettle();
      expect(t.calls.where((r) => r.method == 'POST'), isEmpty);
    },
  );
  testWidgets(
    'participant cannot see admin operations and active game prevents leave',
    (tester) async {
      await tester.pumpWidget(
        screen(f.FakeTransport(f.roomFixture(admin: false, active: true))),
      );
      await tester.pumpAndSettle();
      expect(find.text('방 삭제'), findsNothing);
      expect(find.text('방 정보 저장'), findsNothing);
      expect(find.text('방 나가기'), findsNothing);
      expect(find.textContaining('진행 중인 게임'), findsOneWidget);
    },
  );
  testWidgets(
    'system back on dirty form confirms and cancel retains input at 320 large text',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final t = f.FakeTransport(f.roomFixture());
      await tester.pumpWidget(
        MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context)
                .copyWith(textScaler: TextScaler.linear(2)),
            child: child!,
          ),
          home: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute<void>(
                    builder: (_) => ManagementScreen(
                      repository: repo(t),
                      roomId: 'room-example',
                      accountId: 'account-a',
                      recovery: ManagementRecovery('account-a'),
                      onSessionLost: () {},
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
      await tester.enterText(find.byType(TextField).first, '수정 중인 방');
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('관리 화면을 나갈까요?'), findsOneWidget);
      await tester.tap(find.text('취소'));
      await tester.pumpAndSettle();
      expect(find.text('수정 중인 방'), findsOneWidget);
      expect(tester.takeException(), null);
    },
  );
  testWidgets(
    'deleted list restore confirms exact deletion proof and refreshes',
    (tester) async {
      final t = DeletedTransport();
      await tester.pumpWidget(
        MaterialApp(
          home: DeletedRoomsScreen(
            repository: repo(t),
            accountId: 'account-a',
            recovery: ManagementRecovery('account-a'),
            onSessionLost: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('방 복원'));
      await tester.pumpAndSettle();
      expect(t.posts, isEmpty);
      await tester.tap(find.text('복원'));
      await tester.pumpAndSettle();
      expect(t.posts.length, 1);
      expect(jsonDecode(t.posts.single.body!), {
        'requestId': 'request-fixed',
        'deletedAt': 2000000000000,
        'deletionVersion': 4,
      });
      expect(find.text('방을 복원했어요.'), findsOneWidget);
      expect(find.text('복원할 방이 없어요.'), findsOneWidget);
    },
  );
  testWidgets(
    'same-key account replacement clears old form and confirmation without submitting',
    (tester) async {
      final a = f.FakeTransport(f.roomFixture());
      final b = f.FakeTransport(f.roomFixture(admin: false));
      final recoveryA = ManagementRecovery('account-a'),
          recoveryB = ManagementRecovery('account-b');
      final repoA = repo(a), repoB = repo(b);
      Widget route(
        String account,
        ManagementRepository repository,
        ManagementRecovery recovery,
      ) => MaterialApp(
        home: ManagementScreen(
          repository: repository,
          roomId: 'room-example',
          accountId: account,
          recovery: recovery,
          onSessionLost: () {},
        ),
      );
      await tester.pumpWidget(route('account-a', repoA, recoveryA));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('방 삭제'));
      await tester.tap(find.text('방 삭제'));
      await tester.pumpAndSettle();
      expect(find.text('방을 삭제할까요?'), findsOneWidget);
      await tester.pumpWidget(route('account-b', repoB, recoveryB));
      await tester.pumpAndSettle();
      expect(find.text('방을 삭제할까요?'), findsNothing);
      expect(find.text('방 삭제'), findsNothing);
      expect(find.text('방 나가기'), findsOneWidget);
      expect(a.calls.where((r) => r.method == 'POST'), isEmpty);
      expect(b.calls.where((r) => r.method == 'POST'), isEmpty);
      expect(tester.takeException(), null);
    },
  );
}
