import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/data/avatar_client.dart';
import 'package:nolleoon_mobile/features/profile/profile_controller.dart';
import 'package:nolleoon_mobile/features/profile/profile_repository.dart';

import '../../data/avatar_client_test.dart' as binary;

Map<String, Object?> account({
  int revision = 1,
  String preset = 'preset-01',
  bool photo = false,
}) => {
  'id': 'account-a',
  'displayName': '여행자',
  'presetId': preset,
  'revision': revision,
  'avatar': photo
      ? {
          'kind': 'image',
          'presetId': null,
          'revision': revision,
          'imageUrl': '/api/native/account/avatar/image?v=$revision',
        }
      : {
          'kind': 'preset',
          'presetId': preset,
          'revision': revision,
          'imageUrl': null,
        },
};

class JsonFake implements ApiTransport {
  final requests = <TransportRequest>[];
  late Future<TransportResponse> Function(TransportRequest) handler;
  @override
  Future<TransportResponse> send(TransportRequest r, CancellationToken c) {
    requests.add(r);
    return handler(r);
  }
}

TransportResponse jsonOk(Object o) => TransportResponse(200, jsonEncode(o));
void main() {
  late JsonFake j;
  late binary.AvatarFake a;
  late ProfileController c;
  setUp(() {
    j = JsonFake();
    a = binary.AvatarFake();
    j.handler = (r) async => jsonOk({
      'authenticated': true,
      'expiresAt': 9999,
      'account': account(),
    });
    c = ProfileController(
      ProfileRepository(
        ApiClient(
          transport: j,
          resolver: const NativeRoutes(),
          accessToken: () async => 'a' * 43,
        ),
        AvatarClient(transport: a, accessToken: () async => 'a' * 43),
      ),
    );
  });
  tearDown(() => c.dispose());
  test(
    'name uses profile revision and same preset preserving existing photo',
    () async {
      j.handler = (r) async => r.method == 'GET'
          ? jsonOk({
              'authenticated': true,
              'expiresAt': 9999,
              'account': account(photo: true),
            })
          : jsonOk({
              'authenticated': true,
              'account': account(revision: 2, photo: true),
            });
      a.handler = (r, c) async => AvatarBinaryResponse(
        200,
        'image/webp',
        Uint8List.fromList(utf8.encode('RIFF0000WEBP')),
      );
      await c.load();
      await c.saveName('새 이름');
      expect(jsonDecode(j.requests.last.body!), {
        'displayName': '새 이름',
        'presetId': 'preset-01',
        'expectedRevision': 1,
      });
      expect(c.account!['avatar'], isA<Map>());
    },
  );
  test(
    'preset mutation reloads account revision before later name save',
    () async {
      await c.load();
      a.handler = (r, c) async => binary.jsonResponse({
        'kind': 'preset',
        'presetId': 'preset-02',
        'revision': 2,
        'imageUrl': null,
      });
      j.handler = (r) async => r.method == 'GET'
          ? jsonOk({
              'authenticated': true,
              'expiresAt': 9999,
              'account': account(revision: 2, preset: 'preset-02'),
            })
          : jsonOk({
              'authenticated': true,
              'account': account(revision: 3, preset: 'preset-02'),
            });
      await c.savePreset('preset-02');
      await c.saveName('수정');
      expect(jsonDecode(j.requests.last.body!)['expectedRevision'], 2);
      expect(jsonDecode(j.requests.last.body!)['presetId'], 'preset-02');
    },
  );
  test(
    'CAS409 reloads authoritative revision but does not report save success',
    () async {
      await c.load();
      j.handler = (r) async => r.method == 'POST'
          ? const TransportResponse(409, '{"error":{"code":"STATE_CONFLICT"}}')
          : jsonOk({
              'authenticated': true,
              'expiresAt': 9999,
              'account': account(revision: 8),
            });
      await c.saveName('내 초안');
      expect(c.saved, isFalse);
      expect(c.account!['revision'], 8);
      expect(c.error, contains('다른 곳'));
    },
  );
  test(
    'auth loss drops profile and image bytes; late result cannot restore',
    () async {
      await c.load();
      final pending = Completer<TransportResponse>();
      j.handler = (r) => pending.future;
      final load = c.load();
      c.setForeground(false);
      pending.complete(
        jsonOk({
          'authenticated': true,
          'expiresAt': 9999,
          'account': account(),
        }),
      );
      await load;
      expect(c.account, isNull);
      expect(c.imageBytes, isNull);
    },
  );
  test(
    'invalid name rejected locally without network or hidden trim mutation',
    () async {
      await c.load();
      final count = j.requests.length;
      await c.saveName(' ');
      expect(j.requests.length, count);
      expect(c.saved, isFalse);
      await c.saveName('a' * 21);
      expect(j.requests.length, count);
    },
  );
  test('private thumbnail bytes are zeroed on logout disposal', () async {
    j.handler = (r) async => jsonOk({
      'authenticated': true,
      'expiresAt': 9999,
      'account': account(photo: true),
    });
    a.handler = (r, c) async => AvatarBinaryResponse(
      200,
      'image/webp',
      Uint8List.fromList(utf8.encode('RIFF0000WEBP')),
    );
    await c.load();
    final cached = c.imageBytes!;
    expect(cached.any((b) => b != 0), isTrue);
    c.dispose();
    expect(cached.every((b) => b == 0), isTrue);
    expect(c.account, isNull);
  });
  test('remote 401 clears profile and notifies auth owner', () async {
    var lost = 0;
    c.dispose();
    c = ProfileController(
      ProfileRepository(
        ApiClient(
          transport: j,
          resolver: const NativeRoutes(),
          accessToken: () async => 'a' * 43,
        ),
        AvatarClient(transport: a, accessToken: () async => 'a' * 43),
      ),
      onSessionLost: () => lost++,
    );
    await c.load();
    j.handler = (r) async =>
        const TransportResponse(401, '{"error":{"code":"SESSION_REQUIRED"}}');
    await c.load();
    expect(c.account, isNull);
    expect(lost, 1);
  });
}
