import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/data/avatar_client.dart';
import 'package:nolleoon_mobile/data/io_transport.dart';

class AvatarFake implements AvatarBinaryTransport {
  final requests = <AvatarBinaryRequest>[];
  late Future<AvatarBinaryResponse> Function(
    AvatarBinaryRequest,
    CancellationToken,
  )
  handler;
  @override
  Future<AvatarBinaryResponse> sendAvatar(
    AvatarBinaryRequest r,
    CancellationToken c,
  ) {
    requests.add(r);
    return handler(r, c);
  }
}

final preset = {
  'kind': 'preset',
  'presetId': 'preset-01',
  'revision': 1,
  'imageUrl': null,
};
AvatarBinaryResponse jsonResponse(Object data, {int status = 200}) =>
    AvatarBinaryResponse(
      status,
      'application/json',
      Uint8List.fromList(utf8.encode(jsonEncode(data))),
    );
void main() {
  late AvatarFake t;
  late AvatarClient c;
  setUp(() {
    t = AvatarFake();
    c = AvatarClient(transport: t, accessToken: () async => 'a' * 43);
  });
  test('preset PUT uses exact revision and bearer, never cookie', () async {
    t.handler = (r, c) async => jsonResponse(preset);
    await c.setPreset('preset-01', 0);
    expect(
      t.requests.single.uri.toString(),
      'https://nolleoon.kukjun.com/api/native/account/avatar',
    );
    expect(t.requests.single.method, 'PUT');
    expect(jsonDecode(utf8.decode(t.requests.single.body!)), {
      'presetId': 'preset-01',
      'expectedRevision': 0,
    });
    expect(
      t.requests.single.headers.keys,
      unorderedEquals(['Accept', 'Authorization', 'Content-Type']),
    );
  });
  test(
    'binary upload remains bytes with exact MIME and avatar revision',
    () async {
      final bytes = Uint8List.fromList([137, 80, 78, 71, 13, 10, 26, 10, 0]);
      t.handler = (r, c) async => jsonResponse(preset);
      await c.upload(bytes, 'image/png', 3);
      expect(t.requests.single.body, bytes);
      expect(t.requests.single.headers['X-Avatar-Revision'], '3');
      expect(t.requests.single.headers['Content-Type'], 'image/png');
    },
  );
  test('image URL rejects browser auth path and offsite destinations before credentials', () async {
    for (final url in [
      'https://evil.example/x',
      '//evil.example/x',
      '/api/account/avatar/image',
      '/api/native/account/avatar/image?token=secret',
      '/api/native/travel-rooms/../../account/avatar/image',
    ]) {
      await expectLater(c.image(url), throwsA(isA<ArgumentError>()));
    }
    expect(t.requests, isEmpty);
  });
  test('cancellation during credential await never sends', () async {
    final credential = Completer<String?>();
    final cancel = CancellationToken();
    c = AvatarClient(transport: t, accessToken: () => credential.future);
    final request = c.get(cancel: cancel);
    cancel.cancel();
    await expectLater(
      request,
      throwsA(
        isA<ApiFailure>().having((e) => e.kind, 'kind', FailureKind.cancelled),
      ),
    );
    credential.complete('a' * 43);
    expect(t.requests, isEmpty);
  });
  test('bounded WebP read and server failures remain typed', () async {
    t.handler = (r, c) async =>
        AvatarBinaryResponse(200, 'image/webp', Uint8List(65537));
    await expectLater(
      c.image('/api/native/account/avatar/image?v=1'),
      throwsA(isA<ApiFailure>()),
    );
    t.handler = (r, c) async => jsonResponse({
      'error': {'code': 'STATE_CONFLICT', 'message': 'private'},
    }, status: 409);
    await expectLater(
      c.setPreset('preset-02', 1),
      throwsA(isA<ApiFailure>().having((e) => e.status, 'status', 409)),
    );
  });
  test('bad MIME oversize and malformed bearer never reach network', () async {
    await expectLater(
      c.upload(Uint8List(1048577), 'image/png', 0),
      throwsArgumentError,
    );
    await expectLater(
      c.upload(Uint8List(8), 'image/svg+xml', 0),
      throwsArgumentError,
    );
    c = AvatarClient(transport: t, accessToken: () async => 'short');
    await expectLater(c.get(), throwsA(isA<ApiFailure>()));
    expect(t.requests, isEmpty);
  });
  test('timeout cancels transport without automatic retry', () async {
    final pending = Completer<AvatarBinaryResponse>();
    CancellationToken? token;
    t.handler = (r, c) {
      token = c;
      return pending.future;
    };
    c = AvatarClient(
      transport: t,
      accessToken: () async => 'a' * 43,
      timeout: const Duration(milliseconds: 10),
    );
    await expectLater(
      c.get(),
      throwsA(
        isA<ApiFailure>().having((e) => e.kind, 'kind', FailureKind.timeout),
      ),
    );
    expect(token!.isCancelled, isTrue);
    expect(t.requests.length, 1);
  });
  test(
    'actual stream collector stops before retaining over-limit chunks',
    () async {
      final cancel = CancellationToken();
      await expectLater(
        collectAvatarBytes(
          Stream.fromIterable([
            List.filled(65536, 0),
            [1],
          ]),
          cancel,
        ),
        throwsA(isA<ApiFailure>()),
      );
      expect(
        await collectAvatarBytes(
          Stream.fromIterable([
            [1, 2],
            [3],
          ]),
          cancel,
        ),
        [1, 2, 3],
      );
      cancel.cancel();
      await expectLater(
        collectAvatarBytes(Stream.value([1]), cancel),
        throwsA(
          isA<ApiFailure>().having(
            (e) => e.kind,
            'kind',
            FailureKind.cancelled,
          ),
        ),
      );
    },
  );
  test(
    'real IO guard rejects offsite credentials and cookie headers before I/O',
    () async {
      const io = IoApiTransport();
      await expectLater(
        io.sendAvatar(
          AvatarBinaryRequest(
            Uri.parse('https://evil.example/api/native/account/avatar'),
            'GET',
            {'Authorization': 'Bearer ${'a' * 43}'},
            null,
          ),
          CancellationToken(),
        ),
        throwsArgumentError,
      );
      await expectLater(
        io.sendAvatar(
          AvatarBinaryRequest(
            Uri.parse('https://nolleoon.kukjun.com/api/native/account/avatar'),
            'GET',
            {'Authorization': 'Bearer ${'a' * 43}', 'Cookie': 'unwanted'},
            null,
          ),
          CancellationToken(),
        ),
        throwsArgumentError,
      );
    },
  );
  test('upload freezes caller bytes before credential await', () async {
    final credentials = Completer<String?>();
    c = AvatarClient(transport: t, accessToken: () => credentials.future);
    t.handler = (r, c) async => jsonResponse(preset);
    final bytes = Uint8List.fromList([137, 80, 78, 71, 13, 10, 26, 10, 1]);
    final expected = Uint8List.fromList(bytes);
    final pending = c.upload(bytes, 'image/png', 0);
    bytes.fillRange(0, bytes.length, 0);
    credentials.complete('a' * 43);
    await pending;
    expect(t.requests.single.body, expected);
  });
}
