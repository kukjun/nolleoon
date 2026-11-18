import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/data/wire_models.dart';
import 'package:nolleoon_mobile/features/invites/invites_repository.dart';
import 'package:nolleoon_mobile/features/invites/invite_sharing.dart';

import 'invites_test.dart' show Transport, ok, room;

Map<String, Object?> adminRoom(int version) {
  final r = room();
  r['version'] = version;
  r['self'] = {'membershipId': 'member-a', 'isAdmin': true};
  return r;
}

void main() {
  late Transport t;
  late InviteSharingController c;
  int id = 0;
  setUp(() {
    t = Transport();
    c = InviteSharingController(
      InvitesRepository(
        ApiClient(
          transport: t,
          resolver: const NativeRoutes(),
          accessToken: () async => 'synthetic',
        ),
        requestId: () => 'id-${++id}',
      ),
      RoomDto.fromJson(adminRoom(2)),
    );
  });
  tearDown(() => c.dispose());
  test('issue shares only validated canonical invite and revoke uses returned room version', () async {
    t.handler = (r) async => r.uri.path.endsWith('/invite')
        ? ok({'snapshot': adminRoom(3), 'inviteToken': 'a' * 43})
        : ok(adminRoom(4));
    await c.issue();
    expect(
      c.link?.uri.toString(),
      'https://nolleoon.kukjun.com/travel/invite/${'a' * 43}',
    );
    expect(jsonDecode(t.requests.first.body!), {
      'requestId': 'id-1',
      'expectedVersion': 2,
    });
    await c.revoke();
    expect(jsonDecode(t.requests.last.body!), {
      'requestId': 'id-2',
      'expectedVersion': 3,
    });
    expect(c.link, null);
    expect(c.room.data['version'], 4);
  });
  test('ambiguous issue never blindly retries or shares guessed link; refresh is explicit', () async {
    t.handler = (r) async => throw const ApiFailure(FailureKind.network);
    await c.issue();
    await c.issue();
    expect(t.requests.length, 1);
    expect(c.requiresRefresh, true);
    expect(c.link, null);
    c.updateRoom(RoomDto.fromJson(adminRoom(3)));
    await c.issue();
    expect(t.requests.length, 2);
    expect(t.requests.first.body, isNot(t.requests.last.body));
  });
  test('revoke retains request identity on network retry and old response cannot replace refreshed room', () async {
    int writes = 0;
    t.handler = (r) async {
      if (++writes == 1) throw const ApiFailure(FailureKind.network);
      return ok(adminRoom(3));
    };
    await c.revoke();
    await c.revoke();
    expect(t.requests[0].body, t.requests[1].body);
    final late = Completer<TransportResponse>();
    t.handler = (r) => late.future;
    final issuing = c.issue();
    await Future<void>.delayed(Duration.zero);
    c.updateRoom(RoomDto.fromJson(adminRoom(5)));
    late.complete(ok({'snapshot': adminRoom(4), 'inviteToken': 'a' * 43}));
    await issuing;
    expect(c.room.data['version'], 5);
    expect(c.link, null);
  });
  test('nonadministrator has no issue/revoke calls', () async {
    c.updateRoom(RoomDto.fromJson(room()));
    await c.issue();
    await c.revoke();
    expect(t.requests, isEmpty);
  });
}
