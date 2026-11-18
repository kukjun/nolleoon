import '../../receipt_fake.dart';

import 'dart:convert';
import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/main.dart';
import 'package:nolleoon_mobile/auth/auth_repository.dart';
import 'package:nolleoon_mobile/data/api_client.dart';

import '../../auth_test.dart' as f;
import 'feature_wiring_test.dart' as shell;
import '../../features/games/trial/trial_test.dart' as trial;

class ActiveTransport extends shell.ShellTransport {
  ActiveTransport(this.kind);
  final String kind;
  bool responded = false;
  Map<String, Object?> gameRun() => {
    ...makeRun(responded ? 'completed' : 'active'),
    'type': kind,
    'game': kind == 'draw'
        ? {
            'kind': 'draw',
            'winnerCount': 1,
            'penaltyText': '합성 설거지',
            'revealed': responded
                ? [
                    {'membershipId': 'member-a', 'winner': true},
                  ]
                : [],
            'self': {
              'participating': true,
              'revealed': responded,
              'canReveal': !responded,
            },
            'blockedPolicy': null,
          }
        : {
            'kind': 'menu',
            'phase': responded ? 'completed' : 'collecting',
            'self': {'eligible': true, 'submission': null},
            'result': responded
                ? {'outcome': 'selected', 'menu': '합성 카레'}
                : null,
          },
  };
  @override
  Future<TransportResponse> send(
    TransportRequest r,
    CancellationToken c,
  ) async {
    if (r.uri.path == '/api/native/travel-rooms/room-a') {
      requests.add(r);
      return TransportResponse(
        200,
        jsonEncode({
          ...shell.room(),
          'activeRun': {
            'runId': 'run-a',
            'type': kind,
            'status': 'active',
            'facilitatorMembershipId': 'member-a',
          },
        }),
      );
    }
    if (r.uri.path.contains('/runs/run-a')) {
      requests.add(r);
      if (r.uri.path.endsWith('/actions')) responded = true;
      return TransportResponse(200, jsonEncode(gameRun()));
    }
    return super.send(r, c);
  }
}

class TrialTransport extends ActiveTransport {
  TrialTransport() : super('trial');
  @override
  Map<String, Object?> gameRun() => {
    ...trial.trialRun(
      phase: 'voting',
      voted: responded,
      vote: responded ? {'choice': 'abstain', 'reason': ''} : null,
    ),
    'facilitatorMembershipId': 'member-a',
  };
}

class PendingTransport extends ActiveTransport {
  PendingTransport() : super('draw');
  final held = Completer<TransportResponse>();
  int actionCount = 0;
  @override
  Future<TransportResponse> send(
    TransportRequest r,
    CancellationToken c,
  ) async {
    if (r.uri.path.endsWith('/actions')) {
      actionCount++;
      if (actionCount == 1) {
        requests.add(r);
        return held.future;
      }
    }
    return super.send(r, c);
  }
}

void main() {
  for (final kind in ['draw', 'menu']) {
    testWidgets('root opens $kind and submits only explicit own action', (
      tester,
    ) async {
      final auth = AuthRepository(
        identity: f.Provider(),
        backend: shell.ShellBackend(),
        store: f.Store(),
      );
      final t = ActiveTransport(kind);
      await tester.pumpWidget(
        MyApp(deletionReceiptStore: ReceiptFake(), auth: auth, transport: t),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('카카오로 로그인'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('합성 여행'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('현재 판 보기'),
        150,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('현재 판 보기'));
      await tester.pumpAndSettle();
      expect(t.responded, false);
      final label = kind == 'draw' ? '내 제비 공개' : '이번에는 패스';
      await tester.scrollUntilVisible(
        find.text(label),
        150,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text(label));
      await tester.pumpAndSettle();
      expect(t.responded, true);
      final action = t.requests.singleWhere(
        (r) => r.uri.path.endsWith('/actions'),
      );
      final body = jsonDecode(action.body!) as Map;
      expect(
        body['command'],
        kind == 'draw' ? {'kind': 'reveal'} : {'type': 'pass'},
      );
      if (kind == 'menu') expect(find.text('합성 카레'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      auth.dispose();
    });
  }
  testWidgets(
    'root background retains uncertain action without automatic replay',
    (tester) async {
      final auth = AuthRepository(
        identity: f.Provider(),
        backend: shell.ShellBackend(),
        store: f.Store(),
      );
      final t = PendingTransport();
      await tester.pumpWidget(
        MyApp(deletionReceiptStore: ReceiptFake(), auth: auth, transport: t),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('카카오로 로그인'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('합성 여행'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('현재 판 보기'),
        150,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('현재 판 보기'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('내 제비 공개'),
        150,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('내 제비 공개'));
      await tester.pump();
      expect(t.actionCount, 1);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();
      expect(find.text('합성 설거지'), findsNothing);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expect(t.actionCount, 1);
      await tester.scrollUntilVisible(
        find.text('같은 요청 다시 보내기'),
        150,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('같은 요청 다시 보내기'));
      await tester.pumpAndSettle();
      expect(t.actionCount, 2);
      final actions = t.requests
          .where((r) => r.uri.path.endsWith('/actions'))
          .toList();
      expect(actions[0].body, actions[1].body);
      t.held.complete(TransportResponse(200, jsonEncode(t.gameRun())));
      await tester.pumpAndSettle();
      expect(t.actionCount, 2);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      auth.dispose();
    },
  );
  testWidgets(
    'root trial registry exposes explicit abstention without leaking votes',
    (tester) async {
      final auth = AuthRepository(
        identity: f.Provider(),
        backend: shell.ShellBackend(),
        store: f.Store(),
      );
      final t = TrialTransport();
      await tester.pumpWidget(
        MyApp(deletionReceiptStore: ReceiptFake(), auth: auth, transport: t),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('카카오로 로그인'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('합성 여행'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('현재 판 보기'),
        150,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('현재 판 보기'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('사건과 합의한 벌칙'));
      await tester.pumpAndSettle();
      expect(find.text('합성 사건'), findsOneWidget);
      expect(find.text('익명 이유 A'), findsNothing);
      await tester.scrollUntilVisible(
        find.text('기권'),
        150,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('기권'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('투표 제출'),
        150,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('투표 제출'));
      await tester.pumpAndSettle();
      final action = t.requests.singleWhere(
        (r) => r.uri.path.endsWith('/actions'),
      );
      expect((jsonDecode(action.body!) as Map)['command'], {
        'action': 'vote',
        'choice': 'abstain',
        'reason': '',
      });
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      auth.dispose();
    },
  );
}
