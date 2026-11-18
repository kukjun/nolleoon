import '../receipt_fake.dart';

import 'dart:convert';
import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/main.dart';
import 'package:nolleoon_mobile/auth/auth_repository.dart';
import 'package:nolleoon_mobile/data/api_client.dart';

import '../auth_test.dart' as fakes;

class Transport implements ApiTransport {
  int lists = 0;
  @override
  Future<TransportResponse> send(
    TransportRequest request,
    CancellationToken cancel,
  ) async {
    lists++;
    return TransportResponse(
      200,
      jsonEncode({
        'items': [
          {
            'roomId': 'room-test',
            'title': '비공개 여행방',
            'startDate': null,
            'endDate': null,
            'status': 'open',
            'version': 0,
            'isAdmin': true,
            'memberCount': 1,
          },
        ],
        'nextCursor': null,
      }),
    );
  }
}

class PendingCreateTransport implements ApiTransport {
  final creates = <String>[];
  final first = Completer<TransportResponse>();
  @override
  Future<TransportResponse> send(
    TransportRequest request,
    CancellationToken cancel,
  ) async {
    if (request.method == 'POST') {
      creates.add(request.body!);
      if (creates.length == 1) return first.future;
      return const TransportResponse(
        503,
        '{"error":{"code":"TEMPORARILY_UNAVAILABLE"}}',
      );
    }
    return const TransportResponse(200, '{"items":[],"nextCursor":null}');
  }
}

class SwitchBackend extends fakes.Backend {
  String account = 'account-a';
  @override
  AuthSession get session => AuthSession(
    token: 'synthetic-bearer',
    expiresAt: DateTime.utc(2040),
    accountId: account,
    displayName: '테스트',
  );
}

Future<void> startPendingCreate(WidgetTester tester) async {
  await tester.tap(find.text('새 여행방 만들기'));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextField), '복귀할 여행방');
  await tester.pump();
  await tester.tap(find.widgetWithText(FilledButton, '여행방 만들기'));
  await tester.pump();
}

void main() {
  testWidgets(
    'verified login loads real rooms feature; logout removes private subtree',
    (tester) async {
      final auth = AuthRepository(
        identity: fakes.Provider(),
        backend: fakes.Backend(),
        store: fakes.Store(),
      );
      final transport = Transport();
      await tester.pumpWidget(
        MyApp(
          deletionReceiptStore: ReceiptFake(),
          auth: auth,
          transport: transport,
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('비공개 여행방'), findsNothing);
      expect(transport.lists, 0);
      await tester.tap(find.text('카카오로 로그인'));
      await tester.pumpAndSettle();
      expect(find.text('비공개 여행방'), findsOneWidget);
      expect(transport.lists, 1);
      await tester.tap(find.text('로그아웃'));
      await tester.pumpAndSettle();
      expect(find.text('비공개 여행방'), findsNothing);
      expect(auth.phase, AuthPhase.signedOut);
      await tester.pumpWidget(const SizedBox());
      auth.dispose();
    },
  );
  testWidgets(
    'foreground probe failure and expiry never retain private room content',
    (tester) async {
      final store = fakes.Store()..value = 'saved';
      final backend = fakes.Backend();
      final auth = AuthRepository(
        identity: fakes.Provider(),
        backend: backend,
        store: store,
      );
      await tester.pumpWidget(
        MyApp(
          deletionReceiptStore: ReceiptFake(),
          auth: auth,
          transport: Transport(),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('비공개 여행방'), findsOneWidget);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();
      expect(find.text('비공개 여행방'), findsNothing);
      backend.offline = true;
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expect(find.text('비공개 여행방'), findsNothing);
      expect(find.text('기존 세션 로그아웃'), findsOneWidget);
      backend.offline = false;
      backend.expired = true;
      await tester.tap(find.text('로그인 상태 다시 확인'));
      await tester.pumpAndSettle();
      expect(store.value, null);
      expect(find.text('비공개 여행방'), findsNothing);
      await tester.pumpWidget(const SizedBox());
      auth.dispose();
    },
  );
  testWidgets(
    'same account resumes uncertain create with identical intent and no automatic resend',
    (tester) async {
      final auth = AuthRepository(
        identity: fakes.Provider(),
        backend: SwitchBackend(),
        store: fakes.Store()..value = 'saved',
      );
      final transport = PendingCreateTransport();
      await tester.pumpWidget(
        MyApp(
          deletionReceiptStore: ReceiptFake(),
          auth: auth,
          transport: transport,
        ),
      );
      await tester.pumpAndSettle();
      await startPendingCreate(tester);
      expect(transport.creates.length, 1);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();
      expect(find.text('복귀할 여행방'), findsNothing);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expect(transport.creates.length, 1);
      expect(find.text('같은 요청 다시 확인'), findsOneWidget);
      await tester.tap(find.text('같은 요청 다시 확인'));
      await tester.pumpAndSettle();
      expect(transport.creates.length, 2);
      expect(transport.creates[1], transport.creates[0]);
      transport.first.complete(const TransportResponse(503, '{}'));
      await tester.pumpWidget(const SizedBox());
      await tester.pumpAndSettle();
      auth.dispose();
    },
  );
  testWidgets(
    'different verified account never inherits another accounts pending creation',
    (tester) async {
      final backend = SwitchBackend();
      final auth = AuthRepository(
        identity: fakes.Provider(),
        backend: backend,
        store: fakes.Store()..value = 'saved',
      );
      final transport = PendingCreateTransport();
      await tester.pumpWidget(
        MyApp(
          deletionReceiptStore: ReceiptFake(),
          auth: auth,
          transport: transport,
        ),
      );
      await tester.pumpAndSettle();
      await startPendingCreate(tester);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();
      backend.account = 'account-b';
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expect(find.text('같은 요청 다시 확인'), findsNothing);
      expect(transport.creates.length, 1);
      await startPendingCreate(tester);
      await tester.pumpAndSettle();
      expect(transport.creates.length, 2);
      expect(
        jsonDecode(transport.creates[1])['requestId'],
        isNot(jsonDecode(transport.creates[0])['requestId']),
      );
      transport.first.complete(const TransportResponse(503, '{}'));
      await tester.pumpWidget(const SizedBox());
      await tester.pumpAndSettle();
      auth.dispose();
    },
  );

  testWidgets(
    'explicit logout clears uncertain create even for next login to same account',
    (tester) async {
      final auth = AuthRepository(
        identity: fakes.Provider(),
        backend: SwitchBackend(),
        store: fakes.Store()..value = 'saved',
      );
      final transport = PendingCreateTransport();
      await tester.pumpWidget(
        MyApp(
          deletionReceiptStore: ReceiptFake(),
          auth: auth,
          transport: transport,
        ),
      );
      await tester.pumpAndSettle();
      await startPendingCreate(tester);
      await tester.tap(find.text('로그아웃'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('카카오로 로그인'));
      await tester.pumpAndSettle();
      expect(find.text('같은 요청 다시 확인'), findsNothing);
      expect(transport.creates.length, 1);
      transport.first.complete(const TransportResponse(503, '{}'));
      await tester.pumpWidget(const SizedBox());
      await tester.pumpAndSettle();
      auth.dispose();
    },
  );
}
