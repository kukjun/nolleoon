import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/main.dart';
import 'package:nolleoon_mobile/app/invitation_links.dart';
import 'package:nolleoon_mobile/auth/auth_repository.dart';
import 'package:nolleoon_mobile/data/api_client.dart';

import '../../auth_test.dart' as fake;
import '../../features/invites/invites_test.dart' show room, linkA, linkB;

class Links implements InvitationLinkSource {
  Links({this.initial});
  final String? initial;
  final controller = StreamController<String>();
  @override
  Stream<String> get links {
    if (initial != null) scheduleMicrotask(() => controller.add(initial!));
    return controller.stream;
  }
}

class Transport implements ApiTransport {
  final requests = <TransportRequest>[];
  @override
  Future<TransportResponse> send(
    TransportRequest r,
    CancellationToken cancel,
  ) async {
    requests.add(r);
    if (r.uri.path.endsWith('/preview')) {
      return const TransportResponse(
        200,
        '{"available":true,"loginRequired":true}',
      );
    }
    if (r.uri.path.endsWith('/join') || r.uri.path.endsWith('/room-a')) {
      return TransportResponse(200, jsonEncode(room()));
    }
    return const TransportResponse(200, '{"items":[],"nextCursor":null}');
  }
}

class HoldingTransport extends Transport {
  final firstJoin = Completer<TransportResponse>();
  bool held = false;
  @override
  Future<TransportResponse> send(TransportRequest r, CancellationToken c) {
    if (r.uri.path.endsWith('/join') && !held) {
      held = true;
      requests.add(r);
      return firstJoin.future;
    }
    return super.send(r, c);
  }
}

void main() {
  test('platform link source stays disabled without verified setup', () async {
    final source = createInvitationLinkSource(platformVerified: false);
    expect(await source.links.toList(), isEmpty);
  });
  testWidgets(
    'cold full HTTPS invite waits for verified login and explicit join then opens target room',
    (tester) async {
      final auth = AuthRepository(
            identity: fake.Provider(),
            backend: fake.Backend(),
            store: fake.Store(),
          ),
          transport = Transport(),
          links = Links(initial: linkA);
      await tester.pumpWidget(
        MyApp(auth: auth, transport: transport, invitationLinks: links),
      );
      await tester.pumpAndSettle();
      expect(find.text('여행방 초대'), findsOneWidget);
      expect(transport.requests.where((r) => r.method == 'POST'), isEmpty);
      await tester.tap(find.text('로그인하고 초대 확인'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('카카오로 로그인'));
      await tester.pumpAndSettle();
      expect(find.text('여행방 참가'), findsOneWidget);
      expect(transport.requests.where((r) => r.method == 'POST'), isEmpty);
      await tester.tap(find.text('여행방 참가'));
      await tester.pumpAndSettle();
      expect(
        transport.requests.where((r) => r.uri.path.endsWith('/join')).length,
        1,
      );
      expect(
        transport.requests.where((r) => r.uri.path.endsWith('/room-a')).length,
        1,
      );
      expect(find.text('합성 여행'), findsWidgets);
      await tester.pumpWidget(const SizedBox());
      unawaited(links.controller.close());
      auth.dispose();
      await tester.pump();
    },
  );
  testWidgets(
    'warm duplicates and invalid delivery do not replace pending invite; cancelled login keeps latest',
    (tester) async {
      final provider = fake.Provider()..cancelled = true;
      final auth = AuthRepository(
        identity: provider,
        backend: fake.Backend(),
        store: fake.Store(),
      );
      final transport = Transport(), links = Links();
      await tester.pumpWidget(
        MyApp(auth: auth, transport: transport, invitationLinks: links),
      );
      await tester.pumpAndSettle();
      for (final value in [
        'kakao123://oauth',
        '/travel/invite/aaaaaaaaaaaaaaaaaaaa',
        '$linkA%0a',
        '$linkA\n',
        linkA.replaceFirst('https:', 'http:'),
      ]) {
        links.controller.add(value);
      }
      await tester.pumpAndSettle();
      expect(transport.requests, isEmpty);
      links.controller.add(linkA);
      await tester.pumpAndSettle();
      final count = transport.requests.length;
      links.controller.add(linkA);
      await tester.pumpAndSettle();
      expect(transport.requests.length, count);
      await tester.tap(find.text('로그인하고 초대 확인'));
      await tester.pumpAndSettle();
      links.controller.add(linkB);
      await tester.pumpAndSettle();
      expect(
        transport.requests.length,
        count,
      ); // Hidden invitation never fetches.
      await tester.tap(find.text('카카오로 로그인'));
      await tester.pumpAndSettle();
      expect(transport.requests.where((r) => r.method == 'POST'), isEmpty);
      await tester.tap(find.byTooltip('초대로 돌아가기'));
      await tester.pumpAndSettle();
      expect(find.text('여행방 초대'), findsOneWidget);
      expect(
        transport.requests.last.uri.path,
        contains(Uri.parse(linkB).pathSegments.last),
      );
      provider.cancelled = false;
      await tester.tap(find.text('로그인하고 초대 확인'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('카카오로 로그인'));
      await tester.pumpAndSettle();
      expect(transport.requests.where((r) => r.method == 'POST'), isEmpty);
      await tester.tap(find.text('여행방 참가'));
      await tester.pumpAndSettle();
      expect(
        transport.requests
            .singleWhere((r) => r.uri.path.endsWith('/join'))
            .uri
            .path,
        contains(Uri.parse(linkB).pathSegments.last),
      );
      await tester.pumpWidget(const SizedBox());
      unawaited(links.controller.close());
      auth.dispose();
      await tester.pump();
    },
  );
  testWidgets(
    'background hides invitation and late joined DTO; foreground same identity retries exact bytes manually',
    (tester) async {
      final store = fake.Store()..value = 'synthetic';
      final auth = AuthRepository(
        identity: fake.Provider(),
        backend: fake.Backend(),
        store: store,
      );
      final t = HoldingTransport(), links = Links(initial: linkA);
      await tester.pumpWidget(
        MyApp(auth: auth, transport: t, invitationLinks: links),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('여행방 참가'));
      await tester.pump();
      final original = t.requests.singleWhere((r) => r.method == 'POST').body;
      tester.binding.handleAppLifecycleStateChanged(
        AppLifecycleState.paused,
      );
      await tester.pump();
      expect(find.text('여행방 초대'), findsNothing);
      t.firstJoin.complete(TransportResponse(200, jsonEncode(room())));
      await tester.pump();
      expect(find.text('합성 여행'), findsNothing);
      final count = t.requests.length;
      await tester.pump(const Duration(seconds: 10));
      expect(t.requests.length, count);
      tester.binding.handleAppLifecycleStateChanged(
        AppLifecycleState.resumed,
      );
      await tester.pumpAndSettle();
      expect(t.requests.where((r) => r.method == 'POST').length, 1);
      expect(find.text('합성 여행'), findsNothing);
      await tester.tap(find.text('여행방 참가'));
      await tester.pumpAndSettle();
      final posts = t.requests.where((r) => r.method == 'POST').toList();
      expect(posts.length, 2);
      expect(posts.last.body, original);
      expect(find.text('합성 여행'), findsWidgets);
      await tester.pumpWidget(const SizedBox());
      unawaited(links.controller.close());
      auth.dispose();
      await tester.pump();
    },
  );
}
