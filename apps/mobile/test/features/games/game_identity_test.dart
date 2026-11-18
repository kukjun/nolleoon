import 'package:nolleoon_mobile/features/games/game_controller.dart';

import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/games/game_repository.dart';
import 'package:nolleoon_mobile/features/games/game_screen.dart';

import 'games_test.dart' show FakeTransport, run, ok;

void main() {
  late PendingGameCommands owner;
  setUp(() => owner = PendingGameCommands());
  test('empty identity scope rejected in all build modes', () {
    final t = FakeTransport();
    final r = GameRepository(
      ApiClient(
        transport: t,
        resolver: const NativeRoutes(),
        accessToken: () async => 'synthetic',
      ),
    );
    expect(
      () => GameScreen(
        pendingCommands: owner,
        accountScope: '',
        repository: r,
        roomId: 'room-a',
        onSessionLost: () {},
      ),
      throwsArgumentError,
    );
  });
  testWidgets(
    'same keyed screen must switch to new room and discard old projection',
    (tester) async {
      final t = FakeTransport()
        ..handler = (r) async => ok({
          ...run(),
          'roomId': r.uri.path.contains('room-b') ? 'room-b' : 'room-a',
          'runId': r.uri.path.contains('run-b') ? 'run-b' : 'run-a',
        });
      final repo = GameRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
      );
      Widget screen(String room, String id) => MaterialApp(
        home: GameScreen(
          pendingCommands: owner,
          accountScope: 'synthetic-account',
          key: const ValueKey('game'),
          repository: repo,
          roomId: room,
          runId: id,
          onSessionLost: () {},
          play: (_, r, _) => Text('projection:${r.runId}'),
        ),
      );
      await tester.pumpWidget(screen('room-a', 'run-a'));
      await tester.pump();
      await tester.pump();
      expect(find.text('projection:run-a'), findsOneWidget);
      await tester.pumpWidget(screen('room-b', 'run-b'));
      await tester.pump();
      await tester.pump();
      expect(find.text('projection:run-a'), findsNothing);
      expect(find.text('projection:run-b'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('same keyed new session rejects old late private response', (
    tester,
  ) async {
    final old = Completer<TransportResponse>();
    var count = 0;
    final t = FakeTransport()
      ..handler = (_) {
        count++;
        return count == 1
            ? old.future
            : Future.value(ok({...run(2), 'runId': 'run-a'}));
      };
    final repo = GameRepository(
      ApiClient(
        transport: t,
        resolver: const NativeRoutes(),
        accessToken: () async => 'synthetic',
      ),
    );
    Widget screen(String scope) => MaterialApp(
      home: GameScreen(
        pendingCommands: owner,
        key: const ValueKey('same'),
        repository: repo,
        accountScope: scope,
        roomId: 'room-a',
        runId: 'run-a',
        onSessionLost: () {},
        play: (_, r, _) => Text('version:${r.version}'),
      ),
    );
    await tester.pumpWidget(screen('session-1'));
    await tester.pump();
    await tester.pumpWidget(screen('session-2'));
    await tester.pump();
    await tester.pump();
    old.complete(ok(run(99)));
    await tester.pump();
    await tester.pump();
    expect(find.text('version:99'), findsNothing);
    expect(find.text('version:2'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
    'repository change drops old data and uses current session-lost callback',
    (tester) async {
      var oldLost = 0, newLost = 0;
      final first = FakeTransport()..handler = (_) async => ok(run());
      final second = FakeTransport()
        ..handler = (_) async => const TransportResponse(
          401,
          '{"error":{"code":"UNAUTHENTICATED"}}',
        );
      GameRepository repo(FakeTransport t) => GameRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
      );
      Widget screen(GameRepository r, VoidCallback lost) => MaterialApp(
        home: GameScreen(
          pendingCommands: owner,
          accountScope: 'synthetic-account',
          key: const ValueKey('same'),
          repository: r,
          roomId: 'room-a',
          runId: 'run-a',
          onSessionLost: lost,
          play: (_, r, _) => const Text('old-private'),
        ),
      );
      await tester.pumpWidget(screen(repo(first), () => oldLost++));
      await tester.pump();
      await tester.pump();
      expect(find.text('old-private'), findsOneWidget);
      await tester.pumpWidget(screen(repo(second), () => newLost++));
      await tester.pump();
      await tester.pump();
      expect(find.text('old-private'), findsNothing);
      expect(oldLost, 0);
      expect(newLost, 1);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets('late configuration cannot submit into a new account screen', (
    tester,
  ) async {
    late ValueChanged<Map<String, Object?>?> completeSettings;
    final t = FakeTransport()
      ..handler = (_) async => ok({
        'roomId': 'room-a',
        'title': 'synthetic',
        'startDate': null,
        'endDate': null,
        'status': 'open',
        'version': 1,
        'self': {'membershipId': 'm1', 'isAdmin': true},
        'members': [
          {
            'membershipId': 'm1',
            'nickname': '합성1',
            'presetId': 'preset-01',
            'connected': true,
            'isAdmin': true,
          },
        ],
        'activeRun': null,
      });
    final repo = GameRepository(
      ApiClient(
        transport: t,
        resolver: const NativeRoutes(),
        accessToken: () async => 'synthetic',
      ),
    );
    Widget screen(String scope) => MaterialApp(
      home: GameScreen(
        pendingCommands: owner,
        key: const ValueKey('same'),
        repository: repo,
        accountScope: scope,
        roomId: 'room-a',
        onSessionLost: () {},
        configure: (_, _, _, done) {
          completeSettings = done;
          return const AlertDialog(content: Text('private-config'));
        },
      ),
    );
    await tester.pumpWidget(screen('old'));
    await tester.pump();
    await tester.pump();
    await tester.tap(find.text('합성1'));
    await tester.pump();
    await tester.tap(find.text('게임 설정'));
    await tester.pump();
    await tester.pumpWidget(screen('new'));
    await tester.pump();
    await tester.pump();
    completeSettings({'teamCount': 2});
    expect(find.text('private-config'), findsNothing);
    await tester.pump();
    await tester.pump();
    expect(t.requests.where((r) => r.method != 'GET'), isEmpty);
    expect(
      tester.widget<CheckboxListTile>(find.byType(CheckboxListTile)).value,
      false,
    );
    await tester.pumpWidget(const SizedBox());
  });
}
