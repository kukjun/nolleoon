import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/management/management_controller.dart';
import 'package:nolleoon_mobile/features/management/management_repository.dart';

Map<String, dynamic> roomFixture({bool admin = true, bool active = false}) {
  final room = Map<String, dynamic>.from(
    jsonDecode(
      File('../../contracts/flutter/wire-fixtures.json').readAsStringSync(),
    )['responses']['room'],
  );
  room['self'] = {'membershipId': 'self', 'isAdmin': admin};
  room['members'] = [
    {
      'membershipId': 'self',
      'nickname': '나',
      'presetId': 'preset-01',
      'connected': true,
      'isAdmin': admin,
    },
    {
      'membershipId': 'other',
      'nickname': '친구',
      'presetId': 'preset-02',
      'connected': true,
      'isAdmin': !admin,
    },
  ];
  room['activeRun'] = active
      ? {
          'runId': 'run-example',
          'type': 'draw',
          'status': 'active',
          'facilitatorMembershipId': 'self',
        }
      : null;
  return room;
}

class FakeTransport implements ApiTransport {
  FakeTransport(this.room);
  Map<String, dynamic> room;
  int status = 200;
  final calls = <TransportRequest>[];
  @override
  Future<TransportResponse> send(
    TransportRequest request,
    CancellationToken cancel,
  ) async {
    calls.add(request);
    if (request.method == 'GET') {
      return TransportResponse(200, jsonEncode(room));
    }
    if (status != 200) {
      return TransportResponse(status, '{"error":{"code":"STATE_CONFLICT"}}');
    }
    return TransportResponse(
      200,
      jsonEncode({...room, 'version': room['version'] + 1}),
    );
  }
}

void main() {
  ManagementRepository repo(FakeTransport t) => ManagementRepository(
    ApiClient(
      transport: t,
      resolver: const NativeRoutes(),
      accessToken: () async => 'synthetic',
    ),
    requestId: () => 'request-fixed',
  );
  test('admin participant active and solo administrator permissions use server snapshot', () async {
    final t = FakeTransport(roomFixture());
    final c = ManagementController(
      repo(t),
      'room-example',
      accountId: 'account-a',
      recovery: ManagementRecovery('account-a'),
      onSessionLost: () {},
    );
    await c.refresh();
    expect(c.permits(ApiOperation.deleteRoom), true);
    expect(c.permits(ApiOperation.leaveRoom), false);
    expect(
      c.permits(ApiOperation.transferAdministrator, target: 'other'),
      true,
    );
    t.room = roomFixture(admin: false);
    await c.refresh();
    expect(c.permits(ApiOperation.deleteRoom), false);
    expect(c.permits(ApiOperation.leaveRoom), true);
    t.room = roomFixture(admin: false, active: true);
    await c.refresh();
    expect(c.permits(ApiOperation.leaveRoom), false);
    t.room = roomFixture()..['members'] = [roomFixture()['members'][0]];
    await c.refresh();
    expect(
      c.permits(ApiOperation.transferAdministrator, target: 'other'),
      false,
    );
    expect(c.permits(ApiOperation.deleteRoom), true);
    c.dispose();
  });
  test(
    'uncertain mutation keeps identical bytes and blocks another command',
    () async {
      final t = FakeTransport(roomFixture())..status = 503;
      final c = ManagementController(
        repo(t),
        'room-example',
        accountId: 'account-a',
        recovery: ManagementRecovery('account-a'),
        onSessionLost: () {},
      );
      await c.refresh();
      await c.submit(ApiOperation.roomStatus, values: {'status': 'closed'});
      expect(c.state, ManagementState.uncertain);
      await c.submit(
        ApiOperation.deleteRoom,
        values: {'confirmation': 'DELETE_ROOM'},
      );
      expect(t.calls.length, 2);
      await c.retry();
      expect(t.calls.length, 3);
      expect(t.calls[1].body, t.calls[2].body);
      c.dispose();
    },
  );
  test(
    '409 requires fresh snapshot; 401 clears identity-bearing room',
    () async {
      final t = FakeTransport(roomFixture())..status = 409;
      var lost = 0;
      final c = ManagementController(
        repo(t),
        'room-example',
        accountId: 'account-a',
        recovery: ManagementRecovery('account-a'),
        onSessionLost: () => lost++,
      );
      await c.refresh();
      await c.submit(ApiOperation.roomStatus, values: {'status': 'closed'});
      expect(c.state, ManagementState.conflict);
      expect(c.permits(ApiOperation.deleteRoom), false);
      await c.refresh();
      t.status = 401;
      await c.submit(ApiOperation.roomStatus, values: {'status': 'closed'});
      expect(c.room, null);
      expect(lost, 1);
      c.dispose();
    },
  );
  test('restore keeps deletion version and timestamp, not ordinary expectedVersion', () {
    final r = repo(FakeTransport(roomFixture()));
    final intent = r.restoreIntent(
      const DeletedRoom(
        roomId: 'room-example',
        title: '방',
        deletionVersion: 4,
        deletedAt: 100,
        purgeAfter: 700,
      ),
    );
    expect(jsonDecode(intent.serializedBody), {
      'requestId': 'request-fixed',
      'deletedAt': 100,
      'deletionVersion': 4,
    });
    expect(
      const NativeRoutes().resolve(ApiOperation.restoreRoom, {
        'roomId': 'room-example',
      }).path,
      '/api/native/travel-rooms/room-example/restore',
    );
  });
  test('account-bound uncertain operation survives controller disposal without replay', () async {
    final t = FakeTransport(roomFixture())..status = 503;
    final recovery = ManagementRecovery('account-a');
    final first = ManagementController(
      repo(t),
      'room-example',
      accountId: 'account-a',
      recovery: recovery,
      onSessionLost: () {},
    );
    await first.refresh();
    await first.submit(ApiOperation.roomStatus, values: {'status': 'closed'});
    final body = t.calls.last.body;
    first.dispose();
    final second = ManagementController(
      repo(t),
      'room-example',
      accountId: 'account-a',
      recovery: recovery,
      onSessionLost: () {},
    );
    await second.refresh();
    expect(t.calls.length, 2);
    expect(second.state, ManagementState.uncertain);
    await second.retry();
    expect(t.calls.last.body, body);
    second.dispose();
    expect(
      () => ManagementController(
        repo(t),
        'room-example',
        accountId: 'account-b',
        recovery: recovery,
        onSessionLost: () {},
      ),
      throwsArgumentError,
    );
    recovery.clear();
    expect(recovery.pending, null);
  });
  test('restore rejects ordinary version and invalid deletion proof', () {
    expect(
      () => MutationIntent(
        operation: ApiOperation.restoreRoom,
        parameters: {'roomId': 'room-example'},
        body: {
          'requestId': 'r',
          'expectedVersion': 3,
          'deletedAt': 1,
          'deletionVersion': 2,
        },
      ),
      throwsArgumentError,
    );
    expect(
      () => MutationIntent(
        operation: ApiOperation.restoreRoom,
        parameters: {'roomId': 'room-example'},
        body: {'requestId': 'r', 'deletedAt': 1, 'deletionVersion': 0},
      ),
      throwsArgumentError,
    );
  });
  test('deleted room projection rejects unsafe version integers', () {
    expect(
      () => DeletedRoom.decode({
        'roomId': 'room-example',
        'deletionVersion': 9007199254740992,
        'deletedAt': 1,
        'purgeAfter': 2,
      }),
      throwsFormatException,
    );
  });
}
