import 'dart:convert';

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
      await tester.pumpWidget(MyApp(auth: auth, transport: transport));
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
      await tester.pumpWidget(MyApp(auth: auth, transport: Transport()));
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
}
