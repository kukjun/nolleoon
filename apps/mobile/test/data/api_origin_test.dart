import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_origin.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/data/avatar_client.dart';
import 'package:nolleoon_mobile/data/io_transport.dart';

void main() {
  test(
    'real verification is exclusive, debug-only loopback and distinct storage',
    () {
      final o = ApiOrigin.fromConfiguration(
        verificationBuild: true,
        value: 'http://127.0.0.1:4188',
      );
      expect(o.base.host, '127.0.0.1');
      expect(o.storageKey('key'), contains('.verification.'));
      expect(
        () => ApiOrigin.fromConfiguration(verificationBuild: true),
        throwsArgumentError,
      );
      expect(
        () => ApiOrigin.fromConfiguration(
          verificationBuild: true,
          testBuild: true,
          value: 'http://127.0.0.1:4188',
        ),
        throwsArgumentError,
      );
      expect(
        () => ApiOrigin.fromConfiguration(
          verificationBuild: true,
          releaseBuild: true,
          value: 'http://127.0.0.1:4188',
        ),
        throwsArgumentError,
      );
      expect(
        () => ApiOrigin.fromConfiguration(
          verificationBuild: true,
          value: 'https://nolleoon.kukjun.com',
        ),
        throwsArgumentError,
      );
    },
  );
  test('production default; test requires explicit debug opt-in and literal loopback', () {
    expect(
      ApiOrigin.fromConfiguration().base.toString(),
      'https://nolleoon.kukjun.com/',
    );
    for (final url in [
      'http://localhost:4100',
      'http://10.0.2.2:4100',
      'https://example.com',
      'http://127.0.0.1.evil:4100',
      'http://127.0.0.1:4100/path',
      'http://user@127.0.0.1:4100',
      'http://127.0.0.1:4100?x=1',
      'http://127.0.0.1:4100#x',
    ]) {
      expect(
        () => ApiOrigin.fromConfiguration(testBuild: true, value: url),
        throwsArgumentError,
      );
    }
    expect(
      () => ApiOrigin.fromConfiguration(value: 'http://127.0.0.1:4100'),
      throwsArgumentError,
    );
    expect(
      () => ApiOrigin.fromConfiguration(testBuild: true),
      throwsArgumentError,
    );
    expect(
      () => ApiOrigin.fromConfiguration(
        testBuild: true,
        value: 'http://127.0.0.1:4100',
        releaseBuild: true,
      ),
      throwsArgumentError,
    );
    expect(
      ApiOrigin.fromConfiguration(
        testBuild: true,
        value: 'http://[::1]:4100',
      ).base.host,
      '::1',
    );
  });

  test('real loopback sockets carry auth and avatar only to configured port; redirects never followed', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final other = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(() async {
      await server.close(force: true);
      await other.close(force: true);
    });
    final seen = <String>[];
    var leaked = 0;
    other.listen((r) {
      leaked++;
      r.response.close();
    });
    server.listen((r) async {
      seen.add(r.uri.path);
      if (r.uri.path.endsWith('/rooms')) {
        r.response.statusCode = 302;
        r.response.headers.set(
          'location',
          'http://127.0.0.1:${other.port}/api/native/session',
        );
      } else if (r.uri.path.endsWith('/image')) {
        r.response.headers.contentType = ContentType('image', 'webp');
        r.response.add([1, 2, 3]);
      } else {
        r.response.write('{"ok":true}');
      }
      await r.response.close();
    });
    final origin = ApiOrigin.fromConfiguration(
      testBuild: true,
      value: 'http://127.0.0.1:${server.port}',
    );
    final transport = IoApiTransport(origin: origin);
    final api = ApiClient(
      transport: transport,
      resolver: const NativeRoutes(),
      accessToken: () async => 'A' * 43,
      origin: origin,
    );
    expect(await api.read(ApiOperation.session, (v) => v), {'ok': true});
    final image = await transport.sendAvatar(
      AvatarBinaryRequest(
        origin.base.resolve('/api/native/account/avatar/image'),
        'GET',
        {'Authorization': 'Bearer ${'A' * 43}'},
        null,
      ),
      CancellationToken(),
    );
    expect(image.bytes, Uint8List.fromList([1, 2, 3]));
    final redirect = await transport.send(
      TransportRequest(
        origin.base.resolve('/api/native/rooms'),
        'GET',
        {},
        null,
      ),
      CancellationToken(),
    );
    expect(redirect.status, 302);
    await expectLater(
      transport.send(
        TransportRequest(
          Uri.parse('http://127.0.0.1:${other.port}/api/native/session'),
          'GET',
          {},
          null,
        ),
        CancellationToken(),
      ),
      throwsArgumentError,
    );
    await expectLater(
      const IoApiTransport().send(
        TransportRequest(
          origin.base.resolve('/api/native/session'),
          'GET',
          {},
          null,
        ),
        CancellationToken(),
      ),
      throwsArgumentError,
    );
    expect(leaked, 0);
    expect(seen, [
      '/api/native/account/session',
      '/api/native/account/avatar/image',
      '/api/native/rooms',
    ]);
  });
}
