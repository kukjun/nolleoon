import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/auth/native_auth_backend.dart';
import 'package:nolleoon_mobile/auth/secure_session_store.dart';
import 'package:nolleoon_mobile/features/account_deletion/deletion_receipt_store.dart';
import 'package:nolleoon_mobile/data/api_origin.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/data/avatar_client.dart';
import 'package:nolleoon_mobile/data/io_transport.dart';

void main() {
  test('compile-time composition never falls back to production in broken test mode', () async {
    const rawFlag = String.fromEnvironment('NATIVE_LOOPBACK_TEST_BUILD');
    const flag = rawFlag == 'true';
    if (!{'', 'true', 'false'}.contains(rawFlag)) {
      expect(() => ApiOrigin.configured, throwsArgumentError);
      return;
    }
    const value = String.fromEnvironment('NATIVE_LOOPBACK_ORIGIN');
    if (!flag && value.isEmpty) {
      expect(
        ApiOrigin.configured.base.toString(),
        'https://nolleoon.kukjun.com/',
      );
      return;
    }
    if (!flag || value.isEmpty || !value.startsWith('http://127.0.0.1:')) {
      expect(() => ApiOrigin.configured, throwsArgumentError);
      expect(() => SecureSessionStore(), throwsArgumentError);
      expect(() => SecureDeletionReceiptStore(), throwsArgumentError);
      return;
    }
    final uri = Uri.parse(value);
    final server = await HttpServer.bind(
      InternetAddress.loopbackIPv4,
      uri.port,
    );
    addTearDown(() => server.close(force: true));
    final paths = <String>[];
    server.listen((request) async {
      paths.add(request.uri.path);
      request.response.statusCode = 503;
      request.response.write('{"error":{"code":"SYNTHETIC_ONLY"}}');
      await request.response.close();
    });
    const transport = IoApiTransport();
    final api = ApiClient(
      transport: transport,
      resolver: const NativeRoutes(),
      accessToken: () async => 'A' * 43,
    );
    await expectLater(
      NativeAuthBackend(transport: transport).exchange('synthetic-no-provider'),
      throwsA(isA<ApiFailure>()),
    );
    await expectLater(
      api.read(ApiOperation.rooms, (v) => v),
      throwsA(isA<ApiFailure>()),
    );
    await expectLater(
      AvatarClient(
        transport: transport,
        accessToken: () async => 'A' * 43,
      ).get(),
      throwsA(isA<ApiFailure>()),
    );
    expect(paths, [
      '/api/native/auth/kakao',
      '/api/native/travel-rooms',
      '/api/native/account/avatar',
    ]);
  });
}
