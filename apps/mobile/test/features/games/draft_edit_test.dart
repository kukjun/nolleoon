import 'dart:convert';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/games/game_repository.dart';
import 'package:nolleoon_mobile/features/games/game_controller.dart';
import 'package:nolleoon_mobile/features/games/game_screen.dart';

import 'games_test.dart' show FakeTransport, ok, run;

void main() {
  testWidgets(
    'owned draft edit uses captured version and same retry intent, restricted edit never opens',
    (tester) async {
      final t = FakeTransport();
      var fail = true;
      var edits = 0;
      String? remembered;
      var state = {...run(7), 'status': 'draft', 'startedAt': null};
      t.handler = (r) async {
        if (r.method == 'PATCH') {
          if (fail) throw const ApiFailure(FailureKind.network);
        }
        return ok(state);
      };
      final repo = GameRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
      );
      final owner = PendingGameCommands();
      Widget screen() => MaterialApp(
        home: GameScreen(
          repository: repo,
          roomId: 'room-a',
          runId: 'run-a',
          accountScope: 'a',
          pendingCommands: owner,
          viewerMembershipId: 'member-a',
          onSessionLost: () {},
          onRunAvailable: (id) => remembered = id,
          editConfigure: (_, r, done) {
            edits++;
            expect(r.version, 7);
            return AlertDialog(
              actions: [
                TextButton(
                  onPressed: () => done({'teamCount': 2}),
                  child: const Text('수정 적용'),
                ),
              ],
            );
          },
        ),
      );
      await tester.pumpWidget(screen());
      await tester.pump();
      await tester.pump();
      expect(remembered, 'run-a');
      await tester.tap(find.text('설정 수정'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('수정 적용'));
      await tester.pumpAndSettle();
      final patch = t.requests.firstWhere((r) => r.method == 'PATCH');
      expect(jsonDecode(patch.body!)['expectedVersion'], 7);
      expect(jsonDecode(patch.body!)['settings'], {'teamCount': 2});
      fail = false;
      await tester.tap(find.text('같은 요청 다시 보내기'));
      await tester.pump();
      await tester.pump();
      expect(
        t.requests.where((r) => r.method == 'PATCH').last.body,
        patch.body,
      );
      state = {
        ...state,
        'type': 'trial',
        'game': {'kind': 'trial', 'restricted': true, 'phase': 'preparing'},
      };
      await tester.tap(find.text('최신 상태 확인'));
      await tester.pump();
      await tester.pump();
      expect(find.text('설정 수정'), findsNothing);
      expect(edits, 1);
      expect(find.textContaining('설정을 볼 수 없어'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'draft edit background cancels owned input and stale completion sends nothing',
    (tester) async {
      final t = FakeTransport()..handler = (_) async => ok(run(7));
      final repo = GameRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
      );
      final owner = PendingGameCommands();
      ValueChanged<Map<String, Object?>?>? done;
      await tester.pumpWidget(
        MaterialApp(
          home: GameScreen(
            repository: repo,
            roomId: 'room-a',
            runId: 'run-a',
            accountScope: 'a',
            pendingCommands: owner,
            viewerMembershipId: 'member-a',
            onSessionLost: () {},
            editConfigure: (_, r, complete) {
              done = complete;
              return const AlertDialog(content: Text('private draft input'));
            },
          ),
        ),
      );
      await tester.pump();
      await tester.pump();
      await tester.tap(find.text('설정 수정'));
      await tester.pumpAndSettle();
      expect(find.text('private draft input'), findsOneWidget);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();
      expect(find.text('private draft input'), findsNothing);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      await tester.pump();
      done!({'teamCount': 2});
      await tester.pump();
      expect(t.requests.where((r) => r.method != 'GET'), isEmpty);
      expect(find.text('설정 수정'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'newer draft snapshot invalidates old settings rather than silently overwriting',
    (tester) async {
      final t = FakeTransport();
      var version = 7;
      t.handler = (_) async => ok(run(version));
      final repo = GameRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
      );
      final owner = PendingGameCommands();
      await tester.pumpWidget(
        MaterialApp(
          home: GameScreen(
            repository: repo,
            roomId: 'room-a',
            runId: 'run-a',
            accountScope: 'a',
            pendingCommands: owner,
            viewerMembershipId: 'member-a',
            onSessionLost: () {},
            editConfigure: (_, r, complete) => AlertDialog(
              actions: [
                TextButton(
                  onPressed: () {
                    version = 8;
                    complete({'teamCount': 2});
                  },
                  child: const Text('수정 적용'),
                ),
              ],
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump();
      await tester.tap(find.text('설정 수정'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('수정 적용'));
      await tester.pumpAndSettle();
      expect(t.requests.where((r) => r.method != 'GET'), isEmpty);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
