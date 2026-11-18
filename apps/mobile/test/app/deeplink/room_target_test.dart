import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/rooms/rooms_repository.dart';
import 'package:nolleoon_mobile/features/rooms/rooms_screen.dart';

import '../../features/rooms/rooms_test.dart' as f;

void main() {
  testWidgets(
    'same key target and account changes cancel stale private room responses',
    (tester) async {
      final t = f.FakeTransport(), old = Completer<TransportResponse>();
      t.handler = (r) async => r.uri.path.endsWith('room-a')
          ? old.future
          : f.ok({...f.room(), 'roomId': 'room-b', 'title': '새 계정의 방'});
      final repo = RoomsRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
      );
      Widget view(String account, String id) => MaterialApp(
        home: RoomsScreen(
          key: const ValueKey('same'),
          repository: repo,
          onSessionLost: () {},
          accountId: account,
          initialRoomId: id,
        ),
      );
      await tester.pumpWidget(view('a', 'room-a'));
      await tester.pump();
      await tester.pumpWidget(view('b', 'room-b'));
      await tester.pumpAndSettle();
      expect(find.text('새 계정의 방'), findsOneWidget);
      old.complete(f.ok({...f.room(), 'title': '오래된 비공개 방'}));
      await tester.pumpAndSettle();
      expect(find.text('오래된 비공개 방'), findsNothing);
      expect(find.text('새 계정의 방'), findsOneWidget);
      expect(t.requests.where((r) => r.method != 'GET'), isEmpty);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
