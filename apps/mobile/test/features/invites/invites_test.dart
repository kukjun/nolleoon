import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/navigation/invite_link.dart';
import 'package:nolleoon_mobile/features/invites/invites_repository.dart';
import 'package:nolleoon_mobile/features/invites/invites_controller.dart';

const linkA = 'https://nolleoon.kukjun.com/travel/invite/aaaaaaaaaaaaaaaaaaaa';
const linkB = 'https://nolleoon.kukjun.com/travel/invite/bbbbbbbbbbbbbbbbbbbb';

class Transport implements ApiTransport {
  final requests = <TransportRequest>[];
  late Future<TransportResponse> Function(TransportRequest) handler;
  @override
  Future<TransportResponse> send(
    TransportRequest request,
    CancellationToken cancel,
  ) {
    requests.add(request);
    return handler(request);
  }
}

TransportResponse ok(Object body) => TransportResponse(200, jsonEncode(body));
Map<String, Object?> room() => {
  'roomId': 'room-a',
  'title': '합성 여행',
  'startDate': null,
  'endDate': null,
  'status': 'open',
  'version': 1,
  'self': {'membershipId': 'member-a', 'isAdmin': false},
  'members': [
    {
      'membershipId': 'member-a',
      'nickname': '참가자',
      'presetId': 'preset-01',
      'connected': true,
      'isAdmin': false,
    },
  ],
  'activeRun': null,
};
void main() {
  late Transport t;
  late InvitesController c;
  late PendingInvitation pending;
  int ids = 0;
  setUp(() {
    t = Transport();
    pending = PendingInvitation();
    c = InvitesController(
      InvitesRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
        requestId: () => 'request-${++ids}',
      ),
      pending,
    );
  });
  tearDown(() => c.dispose());
  test('preview is minimal, login never autojoins and cancellation retains invitation', () async {
    t.handler = (r) async => ok({'available': true, 'loginRequired': true});
    await c.open(linkA);
    expect(c.available, true);
    expect(c.accountId, null);
    await c.join();
    expect(t.requests.length, 1);
    expect(t.requests.single.headers.containsKey('Authorization'), false);
    c.setAccount('account-a');
    expect(t.requests.length, 1);
    expect(pending.current?.uri.toString(), linkA);
    expect(c.joined, null);
  });
  test('join is explicit, same-frame duplicate is suppressed, success consumes current intent', () async {
    final result = Completer<TransportResponse>();
    t.handler = (r) async => r.method == 'GET'
        ? ok({'available': true, 'loginRequired': true})
        : result.future;
    await c.open(linkA);
    c.setAccount('a');
    final first = c.join();
    await Future<void>.delayed(Duration.zero);
    await c.join();
    expect(t.requests.where((r) => r.method == 'POST').length, 1);
    result.complete(ok(room()));
    await first;
    expect(c.joined?.roomId, 'room-a');
    expect(pending.current, null);
  });
  test('ambiguous network failure retries exact intent, account switch creates new intent', () async {
    int posts = 0;
    t.handler = (r) async {
      if (r.method == 'GET') {
        return ok({'available': true, 'loginRequired': true});
      }
      posts++;
      if (posts < 3) throw const ApiFailure(FailureKind.network);
      return ok(room());
    };
    await c.open(linkA);
    c.setAccount('a');
    await c.join();
    await c.join();
    final writes = t.requests.where((r) => r.method == 'POST').toList();
    expect(writes[0].body, writes[1].body);
    expect(c.joined, null);
    c.setAccount('b');
    await c.join();
    expect(t.requests.last.body, isNot(writes[0].body));
    expect(c.joined?.roomId, 'room-a');
  });
  test('late old preview and join cannot replace a newer invitation', () async {
    final old = Completer<TransportResponse>();
    t.handler = (r) async => r.uri.path.contains('aaaaaaaa')
        ? old.future
        : ok({'available': true, 'loginRequired': true});
    final first = c.open(linkA);
    await Future<void>.delayed(Duration.zero);
    await c.open(linkB);
    old.complete(ok({'available': true, 'loginRequired': true}));
    await first;
    expect(c.link?.uri.toString(), linkB);
    expect(c.available, true);
    final join = Completer<TransportResponse>();
    t.handler = (r) async => r.method == 'POST'
        ? join.future
        : ok({'available': true, 'loginRequired': true});
    c.setAccount('a');
    final joining = c.join();
    await Future<void>.delayed(Duration.zero);
    await c.open(linkA);
    join.complete(ok(room()));
    await joining;
    expect(c.joined, null);
    expect(pending.current?.uri.toString(), linkA);
  });
  test('revoked and expired session do not manufacture membership or clear pending link', () async {
    t.handler = (r) async =>
        const TransportResponse(404, '{"code":"NOT_FOUND"}');
    await c.open(linkA);
    expect(c.available, false);
    expect(c.error, isNotNull);
    c.setAccount('a');
    await c.join();
    expect(t.requests.length, 1);
    t.handler = (r) async => r.method == 'GET'
        ? ok({'available': true, 'loginRequired': true})
        : const TransportResponse(401, '{"code":"SESSION_REQUIRED"}');
    await c.preview();
    await c.join();
    expect(c.accountId, null);
    expect(c.joined, null);
    expect(pending.current?.uri.toString(), linkA);
  });
  test(
    'strict preview and issued-link DTO reject private/invalid response',
    () {
      expect(
        () => InvitePreview.fromJson({
          'available': true,
          'loginRequired': true,
          'title': 'private',
        }),
        throwsFormatException,
      );
      expect(
        () => IssuedInvitation.fromJson({
          'snapshot': room(),
          'inviteToken': 'https://evil.example',
        }),
        throwsFormatException,
      );
    },
  );
  test(
    'externally newer pending intent disables an older mounted join action',
    () async {
      t.handler = (r) async => ok({'available': true, 'loginRequired': true});
      await c.open(linkA);
      c.setAccount('a');
      pending.accept(linkB);
      await c.join();
      expect(t.requests.length, 1);
      expect(pending.current?.uri.toString(), linkB);
    },
  );
}
