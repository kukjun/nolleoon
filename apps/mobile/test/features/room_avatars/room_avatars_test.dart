import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/data/avatar_client.dart';
import 'package:nolleoon_mobile/features/room_avatars/room_avatars.dart';

Map<String, Object?> metadata(
  int revision, {
  String member = 'member-a',
  String room = 'room-a',
}) => {
  'memberId': member,
  'avatar': {
    'kind': 'image',
    'presetId': null,
    'revision': revision,
    'imageUrl':
        '/api/native/travel-rooms/$room/avatars/$member/image?v=$revision',
  },
};

class Source implements RoomAvatarSource {
  List<Object?> rows = [metadata(1)];
  int loads = 0, images = 0, active = 0, peak = 0;
  Object? failure;
  Completer<Uint8List>? held;
  @override
  Future<RoomAvatarsDto> load(String room, CancellationToken c) async {
    loads++;
    if (failure != null) throw failure!;
    return RoomAvatarsDto.fromJson({'members': rows}, room);
  }

  @override
  Future<Uint8List> image(String path, CancellationToken c) async {
    images++;
    active++;
    if (active > peak) peak = active;
    try {
      return await (held?.future ??
          Future.value(Uint8List.fromList([1, 2, 3])));
    } finally {
      active--;
    }
  }
}

Future<void> flush() => Future<void>.delayed(Duration.zero);

class JsonTransport implements ApiTransport {
  final calls = <TransportRequest>[];
  @override
  Future<TransportResponse> send(
    TransportRequest r,
    CancellationToken c,
  ) async {
    calls.add(r);
    return TransportResponse(
      200,
      jsonEncode({
        'members': [metadata(1)],
      }),
    );
  }
}

class BinaryTransport implements AvatarBinaryTransport {
  final calls = <AvatarBinaryRequest>[];
  @override
  Future<AvatarBinaryResponse> sendAvatar(
    AvatarBinaryRequest r,
    CancellationToken c,
  ) async {
    calls.add(r);
    return AvatarBinaryResponse(
      200,
      'image/webp',
      Uint8List.fromList(ascii.encode('RIFF0000WEBP')),
    );
  }
}

void main() {
  test('repository uses actual native metadata route and existing bounded bearer binary client', () async {
    final json = JsonTransport(), binary = BinaryTransport();
    Future<String?> token() async => 'a' * 43;
    final repo = RoomAvatarsRepository(
      ApiClient(
        transport: json,
        resolver: const NativeRoutes(),
        accessToken: token,
      ),
      AvatarClient(transport: binary, accessToken: token),
    );
    final dto = await repo.load('room-a', CancellationToken());
    expect(
      json.calls.single.uri.path,
      '/api/native/travel-rooms/room-a/avatars',
    );
    final data = await repo.image(
      dto.members['member-a']!.data['imageUrl'] as String,
      CancellationToken(),
    );
    expect(data.length, 12);
    expect(binary.calls.single.uri.query, 'v=1');
    expect(binary.calls.single.headers['Authorization'], 'Bearer ${'a' * 43}');
    expect(
      binary.calls.single.headers.keys.any((k) => k.toLowerCase() == 'cookie'),
      false,
    );
  });

  test('invalid refreshed metadata clears old images instead of keeping stale private state', () async {
    final s = Source();
    final c = RoomAvatarsController(s, roomId: 'room-a');
    c.retain('member-a');
    await c.refresh();
    await flush();
    final old = c.bytes('member-a')!;
    s.rows = [metadata(2, room: 'other')];
    await c.refresh();
    expect(c.bytes('member-a'), isNull);
    expect(old, everyElement(0));
    c.dispose();
  });

  test('retained private image count is capped at16; releasing one permits next visible member', () async {
    final s = Source()
      ..rows = List.generate(17, (i) => metadata(1, member: 'm$i'));
    final p = RoomAvatarsController(s, roomId: 'room-a');
    for (var i = 0; i < 17; i++) {
      p.retain('m$i');
    }
    await p.refresh();
    await flush();
    expect(s.images, 16);
    expect(p.bytes('m16'), isNull);
    p.release('m0');
    await flush();
    expect(s.images, 17);
    expect(p.bytes('m16'), isNotNull);
    p.dispose();
  });

  test(
    'strict sidecar matches memberId and native room/member/revision URL',
    () {
      expect(
        RoomAvatarsDto.fromJson({
          'members': [metadata(1)],
        }, 'room-a').members.length,
        1,
      );
      for (final bad in [
        {
          'members': [metadata(1, room: 'other')],
        },
        {
          'members': [metadata(1), metadata(1)],
        },
        {
          'members': [metadata(1)..['accountId'] = 'private'],
        },
        {
          'members': [metadata(1)],
          'extra': true,
        },
        {
          'members': [
            {
              'memberId': 'member-a',
              'avatar': {
                'kind': 'image',
                'presetId': null,
                'revision': 1,
                'imageUrl': '/api/native/account/avatar/image?v=1',
              },
            },
          ],
        },
      ]) {
        expect(
          () => RoomAvatarsDto.fromJson(bad, 'room-a'),
          throwsFormatException,
        );
      }
    },
  );
  test('only watched images load; unchanged metadata does not redownload; changed revision zeroes old bytes', () async {
    final s = Source(), c = RoomAvatarsController(Source(), roomId: 'unused');
    c.dispose();
    final p = RoomAvatarsController(s, roomId: 'room-a');
    await p.refresh();
    await flush();
    expect(s.images, 0);
    p.retain('member-a');
    await flush();
    expect(s.images, 1);
    final old = p.bytes('member-a')!;
    await p.refresh();
    await flush();
    expect(s.images, 1);
    s.rows = [metadata(2)];
    await p.refresh();
    await flush();
    expect(s.images, 2);
    expect(old, everyElement(0));
    p.dispose();
  });
  test(
    'background/late replies and denied metadata cannot restore private images',
    () async {
      final s = Source()..held = Completer<Uint8List>();
      final p = RoomAvatarsController(s, roomId: 'room-a');
      p.retain('member-a');
      await p.refresh();
      await flush();
      p.setActive(false);
      final late = Uint8List.fromList([1, 2]);
      s.held!.complete(late);
      await flush();
      expect(p.bytes('member-a'), isNull);
      expect(late, everyElement(0));
      s.held = null;
      await p.setActive(true);
      await flush();
      expect(p.bytes('member-a'), isNotNull);
      final old = p.bytes('member-a')!;
      s.failure = const ApiFailure(FailureKind.server, status: 403);
      await p.refresh();
      expect(p.bytes('member-a'), isNull);
      expect(old, everyElement(0));
      final n = s.loads;
      await p.refresh();
      expect(s.loads, n);
      p.dispose();
    },
  );
  test(
    'binary requests are bounded to two and losing final observer erases bytes',
    () async {
      final s = Source()
        ..rows = List.generate(4, (i) => metadata(1, member: 'm$i'))
        ..held = Completer<Uint8List>();
      final p = RoomAvatarsController(s, roomId: 'room-a');
      for (var i = 0; i < 4; i++) {
        p.retain('m$i');
      }
      await p.refresh();
      await flush();
      expect(s.images, 2);
      expect(s.peak, 2);
      s.held!.complete(Uint8List.fromList([1, 2]));
      await flush();
      await flush();
      expect(s.peak, lessThanOrEqualTo(2));
      final bytes = p.bytes('m0')!;
      p.release('m0');
      expect(p.bytes('m0'), isNull);
      expect(bytes, everyElement(0));
      p.dispose();
    },
  );
  test(
    'image denial removes all cached member photos, not only failing image',
    () async {
      final s = Source();
      final p = RoomAvatarsController(s, roomId: 'room-a');
      p.retain('member-a');
      await p.refresh();
      await flush();
      final old = p.bytes('member-a')!;
      s.rows = [metadata(2)];
      s.held = Completer<Uint8List>();
      await p.refresh();
      await flush();
      s.held!.completeError(const ApiFailure(FailureKind.server, status: 410));
      await flush();
      expect(p.bytes('member-a'), isNull);
      expect(old, everyElement(0));
      p.dispose();
    },
  );
}
