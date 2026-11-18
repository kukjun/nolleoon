import 'dart:async';
import 'dart:convert';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/data/wire_models.dart';
import 'package:nolleoon_mobile/features/games/game_controller.dart';
import 'package:nolleoon_mobile/features/games/game_repository.dart';
import 'package:nolleoon_mobile/features/games/game_screen.dart';
import 'package:nolleoon_mobile/features/games/trial/trial_game.dart';

import '../games_test.dart' show FakeTransport, ok;

final roundOne = {
  'number': 1,
  'counts': {'guilty': 1, 'notGuilty': 1, 'abstain': 1},
  'reasons': [
    {'choice': 'guilty', 'reason': '익명 이유 A'},
    {'choice': 'not-guilty', 'reason': '익명 이유 B'},
  ],
};
Map<String, Object?> trialRun({
  String phase = 'preparing',
  bool defendant = false,
  bool voted = false,
  int round = 1,
  String consent = 'accepted',
  String? outcome,
  Object? vote,
  List<Object?> rounds = const [],
  List<Object?> defenses = const [],
  String id = 'run-a',
  bool restricted = false,
}) => {
  'runId': id,
  'roomId': 'room-a',
  'type': 'trial',
  'status': phase == 'preparing'
      ? 'draft'
      : phase == 'completed'
      ? 'completed'
      : phase == 'interrupted'
      ? 'incomplete'
      : 'active',
  'version': 7,
  'facilitatorMembershipId': 'm1',
  'selectedMembershipIds': ['m1', 'm2', 'm3', 'm4'],
  'createdAt': 1000,
  'startedAt': phase == 'preparing' ? null : 2000,
  'endedAt': ['completed', 'interrupted'].contains(phase) ? 3000 : null,
  'isParticipant': !restricted,
  'game': restricted
      ? {'kind': 'trial', 'restricted': true, 'phase': phase}
      : phase == 'interrupted'
      ? {'kind': 'trial', 'restricted': false, 'phase': 'interrupted'}
      : {
          'kind': 'trial',
          'restricted': false,
          'phase': phase,
          'caseText': '합성 사건',
          'penaltyText': '합성 벌칙',
          'durationSeconds': 180,
          'defendantMembershipId': 'm2',
          'consent': consent,
          'roundNumber': round,
          'deadline': phase == 'voting' ? 9999999999999 : null,
          'submittedCount': voted ? 1 : 0,
          'self': {'isDefendant': defendant, 'voted': voted, 'vote': vote},
          'defenses': defenses,
          'rounds': rounds,
          'outcome': outcome,
        },
};
void main() {
  late FakeTransport t;
  late GameRepository repo;
  late PendingGameCommands owner;
  setUp(() {
    t = FakeTransport();
    repo = GameRepository(
      ApiClient(
        transport: t,
        resolver: const NativeRoutes(),
        accessToken: () async => 'synthetic',
      ),
      requestId: () => 'trial-intent',
    );
    owner = PendingGameCommands();
  });
  Widget screen({String viewer = 'm1', String id = 'run-a'}) => MaterialApp(
    home: GameScreen(
      repository: repo,
      roomId: 'room-a',
      runId: id,
      accountScope: 'account-a',
      pendingCommands: owner,
      viewerMembershipId: viewer,
      onSessionLost: () {},
      play: (_, r, c) =>
          TrialGameView(run: r, controller: c, viewerMembershipId: viewer),
      restrictedControls: (_, r, c) => TrialRestrictedControls(
        run: r,
        controller: c,
        viewerMembershipId: viewer,
      ),
    ),
  );
  testWidgets(
    'setup chooses defendant and default 3 minutes with required case and penalty',
    (tester) async {
      JsonMap? settings;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TrialSetupForm(
              selected: const ['m1', 'm2', 'm3'],
              names: const {'m2': '피고친구'},
              onComplete: (v) => settings = v,
            ),
          ),
        ),
      );
      expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, '설정 적용'))
            .onPressed,
        isNull,
      );
      await tester.enterText(find.byKey(const Key('trial-case')), '합성 사건');
      await tester.enterText(find.byKey(const Key('trial-penalty')), '합성 벌칙');
      await tester.pump();
      await tester.tap(find.byKey(const Key('trial-defendant')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('피고친구').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('설정 적용'));
      await tester.pump();
      expect(settings, {
        'caseText': '합성 사건',
        'penaltyText': '합성 벌칙',
        'durationMinutes': 3,
        'defendantMembershipId': 'm2',
      });
    },
  );
  testWidgets(
    'defendant alone consents; defense and explicit skip are server commands',
    (tester) async {
      t.handler = (r) async => ok(
        r.method == 'GET'
            ? trialRun(defendant: true, consent: 'pending')
            : trialRun(defendant: true, consent: 'accepted'),
      );
      await tester.pumpWidget(screen(viewer: 'm2'));
      await tester.pump();
      await tester.pump();
      expect(find.text('벌칙에 동의'), findsOneWidget);
      expect(find.text('게임 시작'), findsNothing);
      await tester.tap(find.text('벌칙에 동의'));
      await tester.pump();
      await tester.pump();
      expect(jsonDecode(t.requests.last.body!)['command'], {
        'action': 'consent',
        'decision': 'accepted',
      });
      t.handler = (r) async => ok(trialRun(phase: 'defense', defendant: true));
      await tester.tap(find.text('최신 상태 확인'));
      await tester.pump();
      await tester.pump();
      await tester.enterText(find.byKey(const Key('trial-defense')), '내 변론');
      await tester.pump();
      await tester.tap(find.text('변론 제출'));
      await tester.pump();
      await tester.pump();
      expect(jsonDecode(t.requests.last.body!)['command'], {
        'action': 'defense',
        'decision': 'submit',
        'text': '내 변론',
      });
      await tester.tap(find.text('변론 생략'));
      await tester.pump();
      await tester.pump();
      expect(jsonDecode(t.requests.last.body!)['command'], {
        'action': 'defense',
        'decision': 'skip',
        'text': '',
      });
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'trial server phases include first tie then final defense then second acquittal without client tally',
    (tester) async {
      var state = trialRun();
      t.handler = (r) async {
        if (r.method != 'GET') {
          final priorVersion = state['version'] as int;
          final b = jsonDecode(r.body!) as Map;
          final a = (b['command'] as Map?)?['action'];
          if (r.uri.path.endsWith('/start')) {
            state = trialRun(phase: 'defense');
          } else if (a == 'begin-vote') {
            state = trialRun(
              phase: 'voting',
              round: (state['game'] as Map)['phase'] == 'final-defense' ? 2 : 1,
              rounds: (state['game'] as Map)['phase'] == 'final-defense'
                  ? [roundOne]
                  : [],
            );
          } else if (a == 'vote') {
            final second = (state['game'] as Map)['roundNumber'] == 2;
            state = trialRun(
              phase: second ? 'completed' : 'first-result',
              round: second ? 2 : 1,
              outcome: second ? 'not-guilty' : 'tie',
              rounds: second
                  ? [
                      roundOne,
                      {...roundOne, 'number': 2},
                    ]
                  : [roundOne],
            );
          } else if (a == 'final-defense') {
            state = trialRun(
              phase: 'final-defense',
              rounds: [roundOne],
              outcome: 'tie',
            );
          }
          state = {...state, 'version': priorVersion + 1};
        }
        return ok(state);
      };
      await tester.pumpWidget(screen());
      await tester.pump();
      await tester.pump();
      await tester.tap(find.text('게임 시작'));
      await tester.pump();
      await tester.pump();
      await tester.tap(find.text('모두 함께 투표 시작'));
      await tester.pump();
      await tester.pump();
      expect(find.text('익명 투표 · 1차'), findsOneWidget);
      await tester.tap(find.text('기권'));
      await tester.pump();
      await tester.tap(find.text('투표 제출'));
      await tester.pump();
      await tester.pump();
      expect(find.text('1차 결과 · 동률'), findsOneWidget);
      expect(find.text('최후 변론으로'), findsOneWidget);
      await tester.tap(find.text('최후 변론으로'));
      await tester.pump();
      await tester.pump();
      expect(find.text('최후 변론'), findsOneWidget);
      await tester.tap(find.text('모두 함께 투표 시작'));
      await tester.pump();
      await tester.pump();
      expect(find.text('익명 투표 · 2차'), findsOneWidget);
      await tester.tap(find.text('기권'));
      await tester.pump();
      await tester.tap(find.text('투표 제출'));
      await tester.pump();
      await tester.pump();
      expect(find.text('최종 판결 · 무죄'), findsOneWidget);
      expect(t.requests.where((r) => r.method == 'POST').length, 6);
      expect(
        t.requests
            .where((r) => r.method == 'POST')
            .map((r) => jsonDecode(r.body!)['expectedVersion'])
            .toList(),
        [7, 8, 9, 10, 11, 12],
      );
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'guilty requires reason, abstain is optional, no optimistic vote and duplicate is blocked',
    (tester) async {
      final pending = Completer<TransportResponse>();
      t.handler = (r) async =>
          r.method == 'GET' ? ok(trialRun(phase: 'voting')) : pending.future;
      await tester.pumpWidget(screen());
      await tester.pump();
      await tester.pump();
      await tester.tap(find.text('유죄'));
      await tester.pump();
      expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, '투표 제출'))
            .onPressed,
        isNull,
      );
      await tester.enterText(find.byKey(const Key('trial-reason')), '합성 이유');
      await tester.pump();
      await tester.tap(find.text('투표 제출'));
      await tester.pump();
      expect(find.text('내 투표가 접수됐어요.'), findsNothing);
      expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, '투표 제출'))
            .onPressed,
        isNull,
      );
      expect(t.requests.where((r) => r.method == 'POST').length, 1);
      pending.complete(
        ok(
          trialRun(
            phase: 'voting',
            voted: true,
            vote: {'choice': 'guilty', 'reason': '합성 이유'},
          ),
        ),
      );
      await tester.pump();
      await tester.pump();
      expect(find.text('내 투표가 접수됐어요.'), findsOneWidget);
      expect(find.text('투표 제출'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'defendant cannot vote and nonparticipant facilitator sees only minimal phase controls',
    (tester) async {
      t.handler = (_) async => ok(trialRun(phase: 'voting', defendant: true));
      await tester.pumpWidget(screen(viewer: 'm2'));
      await tester.pump();
      await tester.pump();
      expect(find.text('투표 제출'), findsNothing);
      expect(find.text('피고는 투표에 참여하지 않아요.'), findsOneWidget);
      t.handler = (_) async => ok(trialRun(phase: 'defense', restricted: true));
      await tester.pumpWidget(screen(viewer: 'm1'));
      await tester.pump();
      await tester.pump();
      expect(find.text('합성 사건'), findsNothing);
      expect(find.text('합성 벌칙'), findsNothing);
      expect(find.byKey(const Key('trial-defense')), findsNothing);
      expect(find.text('모두 함께 투표 시작'), findsOneWidget);
      await tester.tap(find.text('모두 함께 투표 시작'));
      await tester.pump();
      await tester.pump();
      expect(jsonDecode(t.requests.last.body!)['command'], {
        'action': 'begin-vote',
      });
      await tester.pumpWidget(screen(viewer: 'observer'));
      await tester.pump();
      await tester.pump();
      expect(find.text('모두 함께 투표 시작'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'server deadline conflict refreshes outcome instead of locally settling or automatically retrying',
    (tester) async {
      var ended = false;
      t.handler = (r) async {
        if (r.method == 'POST') {
          ended = true;
          return const TransportResponse(
            409,
            '{"error":{"code":"STATE_CONFLICT"}}',
          );
        }
        return ok(
          ended
              ? trialRun(
                  phase: 'completed',
                  outcome: 'no-verdict',
                  rounds: [
                    {
                      'number': 1,
                      'counts': {'guilty': 0, 'notGuilty': 0, 'abstain': 3},
                      'reasons': [],
                    },
                  ],
                )
              : trialRun(phase: 'voting'),
        );
      };
      await tester.pumpWidget(screen());
      await tester.pump();
      await tester.pump();
      await tester.tap(find.text('기권'));
      await tester.pump();
      await tester.tap(find.text('투표 제출'));
      await tester.pump();
      await tester.pump();
      expect(find.text('판결 없음 · 모두 기권'), findsOneWidget);
      expect(t.requests.where((r) => r.method == 'POST').length, 1);
      expect(find.text('투표 제출'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets('interruption never renders previous case or vote inputs', (
    tester,
  ) async {
    t.handler = (_) async => ok(trialRun(phase: 'interrupted'));
    await tester.pumpWidget(screen());
    await tester.pump();
    await tester.pump();
    expect(find.text('재판이 중단됐어요.'), findsOneWidget);
    expect(find.text('합성 사건'), findsNothing);
    expect(find.text('투표 제출'), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
    'vote ambiguous retry preserves original reason and request identity',
    (tester) async {
      var fail = true;
      t.handler = (r) async {
        if (r.method == 'GET') return ok(trialRun(phase: 'voting'));
        if (fail) throw const ApiFailure(FailureKind.network);
        return ok(
          trialRun(
            phase: 'voting',
            voted: true,
            vote: {'choice': 'not-guilty', 'reason': '합성 무죄 이유'},
          ),
        );
      };
      await tester.pumpWidget(screen());
      await tester.pump();
      await tester.pump();
      await tester.tap(find.text('무죄'));
      await tester.pump();
      await tester.enterText(find.byKey(const Key('trial-reason')), '합성 무죄 이유');
      await tester.pump();
      await tester.tap(find.text('투표 제출'));
      await tester.pump();
      await tester.pump();
      final original = t.requests.last.body;
      fail = false;
      await tester.tap(find.text('같은 요청 다시 보내기'));
      await tester.pump();
      await tester.pump();
      expect(t.requests.last.body, original);
      expect(find.text('내 투표가 접수됐어요.'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'rejected draft edit preserves old settings and server response resets consent',
    (tester) async {
      var state = trialRun(consent: 'rejected');
      t.handler = (r) async {
        if (r.method == 'PATCH') {
          final b = jsonDecode(r.body!) as Map;
          expect(b['settings'], {
            'caseText': '수정 사건',
            'penaltyText': '합성 벌칙',
            'durationMinutes': 3,
            'defendantMembershipId': 'm2',
          });
          state = {...trialRun(consent: 'pending'), 'version': 8};
        }
        return ok(state);
      };
      await tester.pumpWidget(
        MaterialApp(
          home: GameScreen(
            repository: repo,
            roomId: 'room-a',
            runId: 'run-a',
            accountScope: 'account-a',
            pendingCommands: owner,
            viewerMembershipId: 'm1',
            onSessionLost: () {},
            play: (_, r, c) =>
                TrialGameView(run: r, controller: c, viewerMembershipId: 'm1'),
            editConfigure: (_, r, done) {
              final g = r.game!.data;
              return TrialSetupForm(
                selected: (r.data['selectedMembershipIds'] as List)
                    .cast<String>(),
                initialSettings: {
                  'caseText': g['caseText'],
                  'penaltyText': g['penaltyText'],
                  'defendantMembershipId': g['defendantMembershipId'],
                  'durationMinutes': (g['durationSeconds'] as int) ~/ 60,
                },
                onComplete: done,
              );
            },
          ),
        ),
      );
      await tester.pump();
      await tester.pump();
      expect(find.text('동의 상태: 거절'), findsOneWidget);
      await tester.tap(find.text('설정 수정'));
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<TextField>(find.byKey(const Key('trial-case')))
            .controller!
            .text,
        '합성 사건',
      );
      expect(
        tester
            .widget<TextField>(find.byKey(const Key('trial-penalty')))
            .controller!
            .text,
        '합성 벌칙',
      );
      await tester.enterText(find.byKey(const Key('trial-case')), '수정 사건');
      await tester.pump();
      await tester.tap(find.text('설정 적용'));
      await tester.pumpAndSettle();
      expect(find.text('동의 상태: 대기'), findsOneWidget);
      expect(t.requests.where((r) => r.method == 'PATCH').length, 1);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'published reasons are anonymous and redacted replacement drops all prose',
    (tester) async {
      var state = trialRun(
        phase: 'completed',
        outcome: 'guilty',
        rounds: [roundOne],
      );
      t.handler = (_) async => ok(state);
      await tester.pumpWidget(screen());
      await tester.pump();
      await tester.pump();
      await tester.tap(find.text('1차 공개 결과'));
      await tester.pumpAndSettle();
      expect(find.textContaining('익명 이유 A'), findsOneWidget);
      expect(find.text('m1'), findsNothing);
      state = {
        ...state,
        'facilitatorMembershipId': null,
        'selectedMembershipIds': <String>[],
        'game': {
          'kind': 'trial',
          'redacted': true,
          'summary': {
            'participantCount': 4,
            'rounds': [
              {
                'number': 1,
                'guilty': 1,
                'notGuilty': 1,
                'abstain': 1,
                'total': 3,
              },
            ],
          },
        },
      };
      await tester.ensureVisible(find.text('최신 상태 확인'));
      await tester.tap(find.text('최신 상태 확인'));
      await tester.pump();
      await tester.pump();
      expect(find.textContaining('익명 이유 A'), findsNothing);
      expect(find.text('합성 사건'), findsNothing);
      expect(find.textContaining('개인 내용은 표시하지'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'background discards private reason and late old run does not overwrite replacement',
    (tester) async {
      final pending = Completer<TransportResponse>();
      t.handler = (r) async {
        if (r.method == 'POST') return pending.future;
        return ok(
          trialRun(
            phase: 'voting',
            id: r.uri.path.endsWith('/run-b') ? 'run-b' : 'run-a',
          ),
        );
      };
      await tester.pumpWidget(screen());
      await tester.pump();
      await tester.pump();
      await tester.enterText(find.byKey(const Key('trial-reason')), '비공개 입력');
      await tester.pump();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();
      expect(find.byKey(const Key('trial-reason')), findsNothing);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      await tester.pump();
      expect(
        tester
            .widget<TextField>(find.byKey(const Key('trial-reason')))
            .controller!
            .text,
        isEmpty,
      );
      await tester.tap(find.text('기권'));
      await tester.pump();
      await tester.tap(find.text('투표 제출'));
      await tester.pump();
      await tester.pumpWidget(screen(id: 'run-b'));
      await tester.pump();
      await tester.pump();
      pending.complete(ok(trialRun(phase: 'completed', outcome: 'guilty')));
      await tester.pump();
      await tester.pump();
      expect(find.text('최종 판결 · 유죄'), findsNothing);
      expect(find.text('익명 투표 · 1차'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'only facilitator changes server duration before voting, server rejection has no automatic retry',
    (tester) async {
      t.handler = (r) async => r.method == 'GET'
          ? ok(trialRun(phase: 'defense'))
          : const TransportResponse(409, '{"error":{"code":"STATE_CONFLICT"}}');
      await tester.pumpWidget(screen());
      await tester.pump();
      await tester.pump();
      await tester.tap(find.text('투표 제한시간 180초'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('trial-duration')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('4분').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('시간 적용'));
      await tester.pump();
      await tester.pump();
      expect(
        jsonDecode(
          t.requests.firstWhere((r) => r.method == 'POST').body!,
        )['command'],
        {'action': 'duration', 'durationMinutes': 4},
      );
      expect(t.requests.where((r) => r.method == 'POST').length, 1);
      expect(find.text('투표 제한시간 180초'), findsOneWidget);
      await tester.pumpWidget(screen(viewer: 'm3'));
      await tester.pump();
      await tester.pump();
      expect(find.text('시간 적용'), findsNothing);
      expect(find.text('모두 함께 투표 시작'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
