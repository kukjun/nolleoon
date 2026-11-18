import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/history/history_repository.dart';
import 'package:nolleoon_mobile/features/history/history_screen.dart';

import 'history_test.dart' show HistoryTransport, record, response;

void main() {
  testWidgets(
    'same-key account and room switch clears old detail and rejects late response',
    (tester) async {
      final t = HistoryTransport()
        ..handler = (r) async => response(
          r.uri.path.endsWith('/history')
              ? {
                  'items': [record('old')],
                  'nextCursor': null,
                }
              : record(
                  'old',
                  type: 'menu',
                  game: {
                    'kind': 'menu',
                    'phase': 'completed',
                    'self': {'eligible': true, 'submission': null},
                    'result': {'outcome': 'selected', 'menu': '이전 비공개 메뉴'},
                  },
                ),
        );
      final repo = HistoryRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
      );
      Widget screen(String account, String room) => MaterialApp(
        home: HistoryScreen(
          key: const ValueKey('same'),
          repository: repo,
          roomId: room,
          accountScope: account,
          onSessionLost: () {},
        ),
      );
      await tester.pumpWidget(screen('a', 'room-a'));
      await tester.pumpAndSettle();
      final pending = Completer<TransportResponse>();
      t.handler = (_) => pending.future;
      await tester.tap(find.text('팀 나누기 · 완료'));
      await tester.pump();
      t.handler = (_) async => response({'items': [], 'nextCursor': null});
      await tester.pumpWidget(screen('b', 'room-b'));
      await tester.pumpAndSettle();
      pending.complete(
        response(
          record(
            'old',
            type: 'menu',
            game: {
              'kind': 'menu',
              'phase': 'completed',
              'self': {'eligible': true, 'submission': null},
              'result': {'outcome': 'selected', 'menu': '이전 비공개 메뉴'},
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('이전 비공개 메뉴'), findsNothing);
      expect(find.text('표시할 기록이 없어요.'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'detail back and inactive clear protected text; long text at 320 remains usable',
    (tester) async {
      tester.view.physicalSize = const Size(320, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final menu = record(
        'menu',
        type: 'menu',
        game: {
          'kind': 'menu',
          'phase': 'completed',
          'self': {'eligible': true, 'submission': null},
          'result': {'outcome': 'selected', 'menu': '긴메뉴이름' * 20},
        },
      );
      final t = HistoryTransport()
        ..handler = (r) async => response(
          r.uri.path.endsWith('/history')
              ? {
                  'items': [menu],
                  'nextCursor': null,
                }
              : menu,
        );
      final repo = HistoryRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: HistoryScreen(
            repository: repo,
            roomId: 'room-a',
            accountScope: 'a',
            onSessionLost: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('메뉴 고르기 · 완료'));
      await tester.pumpAndSettle();
      expect(find.textContaining('선택된 메뉴:'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.tap(find.byTooltip('기록 목록'));
      await tester.pumpAndSettle();
      expect(find.textContaining('선택된 메뉴:'), findsNothing);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();
      expect(find.text('메뉴 고르기 · 완료'), findsNothing);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expect(find.text('메뉴 고르기 · 완료'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
