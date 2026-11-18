import 'package:nolleoon_mobile/features/games/game_controller.dart';

import 'dart:convert';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/data/wire_models.dart';
import 'package:nolleoon_mobile/features/games/game_repository.dart';
import 'package:nolleoon_mobile/features/games/game_screen.dart';
import 'package:nolleoon_mobile/features/games/team/team_game.dart';

import '../games_test.dart' show FakeTransport, ok;

Map<String, Object?> teamRun(
  int n, {
  String status = 'completed',
  bool participant = true,
}) => {
  'runId': 'run-a',
  'roomId': 'room-a',
  'type': 'team',
  'status': status,
  'version': 3,
  'facilitatorMembershipId': 'm1',
  'selectedMembershipIds': [for (var i = 1; i <= n; i++) 'm$i'],
  'createdAt': 1000,
  'startedAt': status == 'draft' ? null : 2000,
  'endedAt': status == 'completed' ? 2000 : null,
  'isParticipant': participant,
  'game': {
    'kind': 'team',
    'teamCount': 2,
    'assignments': status == 'completed'
        ? [
            for (var i = 1; i <= n; i++)
              {'membershipId': 'm$i', 'team': i <= ((n + 1) ~/ 2) ? 1 : 2},
          ]
        : [],
  },
};
void main() {
  late PendingGameCommands owner;
  setUp(() => owner = PendingGameCommands());
  for (final n in [2, 3, 5]) {
    testWidgets(
      'server $n person assignments rendered without generating a draw',
      (tester) async {
        final dto = RunDto.fromJson(teamRun(n));
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: TeamGameView(
                run: dto,
                names: {for (var i = 1; i <= n; i++) 'm$i': '합성$i'},
              ),
            ),
          ),
        );
        expect(find.text('팀 나누기 결과'), findsOneWidget);
        for (var i = 1; i <= n; i++) {
          expect(find.text('합성$i'), findsOneWidget);
        }
        expect(find.textContaining('벌칙'), findsNothing);
      },
    );
  }
  testWidgets(
    'setup sends only chosen teamCount; cancel produces no settings',
    (tester) async {
      Object? result = 'untouched';
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => TextButton(
              onPressed: () async {
                result = await teamSetup(
                  context,
                  ['m1', 'm2', 'm3'],
                  names: {'m1': '합성1'},
                );
              },
              child: const Text('설정 열기'),
            ),
          ),
        ),
      );
      await tester.tap(find.text('설정 열기'));
      await tester.pumpAndSettle();
      expect(find.text('합성1'), findsOneWidget);
      expect(find.textContaining('벌칙'), findsNothing);
      await tester.tap(find.text('설정 적용'));
      await tester.pumpAndSettle();
      expect(result, {'teamCount': 2});
      await tester.tap(find.text('설정 열기'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('team-count')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('3팀').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('설정 적용'));
      await tester.pumpAndSettle();
      expect(result, {'teamCount': 3});
      await tester.tap(find.text('설정 열기'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('취소'));
      await tester.pumpAndSettle();
      expect(result, isNull);
    },
  );
  testWidgets('one participant cannot confirm setup', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => TextButton(
            onPressed: () => teamSetup(context, ['m1']),
            child: const Text('설정 열기'),
          ),
        ),
      ),
    );
    await tester.tap(find.text('설정 열기'));
    await tester.pumpAndSettle();
    expect(find.text('참가자를 2명 이상 선택해 주세요.'), findsOneWidget);
    expect(
      tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, '설정 적용'))
          .onPressed,
      isNull,
    );
  });
  testWidgets(
    'observer sees authorized result but no controls; incomplete never fabricates result',
    (tester) async {
      final t = FakeTransport()
        ..handler = (_) async => ok(teamRun(3, participant: false));
      final repo = GameRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: GameScreen(
            pendingCommands: owner,
            accountScope: 'synthetic-account',
            repository: repo,
            roomId: 'room-a',
            runId: 'run-a',
            viewerMembershipId: 'observer',
            onSessionLost: () {},
            play: (_, run, _) => TeamGameView(run: run),
          ),
        ),
      );
      await tester.pump();
      await tester.pump();
      expect(find.text('팀 나누기 결과'), findsOneWidget);
      expect(find.text('게임 시작'), findsNothing);
      expect(t.requests.every((r) => r.method == 'GET'), true);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TeamGameView(
              run: RunDto.fromJson(teamRun(3, status: 'incomplete')),
            ),
          ),
        ),
      );
      expect(find.text('팀 나누기가 중단됐어요.'), findsOneWidget);
      expect(find.text('팀 나누기 결과'), findsNothing);
    },
  );
  testWidgets(
    'facilitator start uses frozen version, conflict reads fresh server result without automatic resend',
    (tester) async {
      var changed = false;
      final t = FakeTransport()
        ..handler = (r) async {
          if (r.method == 'POST') {
            changed = true;
            return const TransportResponse(
              409,
              '{"error":{"code":"STATE_CONFLICT"}}',
            );
          }
          return ok(teamRun(5, status: changed ? 'completed' : 'draft'));
        };
      final repo = GameRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
        requestId: () => 'start-intent',
      );
      await tester.pumpWidget(
        MaterialApp(
          home: GameScreen(
            pendingCommands: owner,
            accountScope: 'synthetic-account',
            repository: repo,
            roomId: 'room-a',
            runId: 'run-a',
            viewerMembershipId: 'm1',
            onSessionLost: () {},
            play: (_, run, _) => TeamGameView(run: run),
          ),
        ),
      );
      await tester.pump();
      await tester.pump();
      expect(find.text('진행자가 시작하면 팀이 정해져요.'), findsOneWidget);
      await tester.tap(find.text('게임 시작'));
      await tester.pump();
      await tester.pump();
      final sent = t.requests.where((r) => r.method == 'POST').toList();
      expect(sent.length, 1);
      expect(jsonDecode(sent.single.body!), {
        'requestId': 'start-intent',
        'expectedVersion': 3,
      });
      expect(find.text('팀 나누기 결과'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
