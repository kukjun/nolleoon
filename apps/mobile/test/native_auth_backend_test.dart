import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/auth/auth_repository.dart';
import 'package:nolleoon_mobile/auth/native_auth_backend.dart';
import 'package:nolleoon_mobile/data/api_client.dart';

class Transport implements ApiTransport {
  final requests = <TransportRequest>[];
  late TransportResponse response;
  @override
  Future<TransportResponse> send(
    TransportRequest request,
    CancellationToken cancel,
  ) async {
    requests.add(request);
    return response;
  }
}

void main() {
  late Transport transport;
  late NativeAuthBackend backend;
  const token = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  setUp(() {
    transport = Transport();
    backend = NativeAuthBackend(transport: transport);
  });
  test(
    'exchange no bearer/cookie; session and logout use only app bearer',
    () async {
      final account = jsonDecode(
        File('../../contracts/flutter/wire-fixtures.json').readAsStringSync(),
      )['responses']['signedIn']['account'];
      final expiresAt = DateTime.utc(2040).millisecondsSinceEpoch;
      transport.response = TransportResponse(
        201,
        jsonEncode({
          'token': token,
          'expiresAt': expiresAt,
          'account': account,
        }),
      );
      final session = await backend.exchange('synthetic-provider');
      expect(session.token, token);
      expect(transport.requests.last.uri.path, '/api/native/auth/kakao');
      expect(
        transport.requests.last.headers.keys.map((s) => s.toLowerCase()),
        isNot(contains('authorization')),
      );
      expect(
        transport.requests.last.headers.keys.map((s) => s.toLowerCase()),
        isNot(contains('cookie')),
      );
      expect(jsonDecode(transport.requests.last.body!), {
        'accessToken': 'synthetic-provider',
      });
      transport.response = TransportResponse(
        200,
        jsonEncode({
          'authenticated': true,
          'expiresAt': expiresAt,
          'account': account,
        }),
      );
      expect((await backend.probe(token)).accountId, account['id']);
      expect(transport.requests.last.headers['Authorization'], 'Bearer $token');
      transport.response = const TransportResponse(
        201,
        '{"authenticated":false}',
      );
      await backend.logout(token);
      expect(transport.requests.last.uri.path, '/api/native/auth/logout');
      expect(transport.requests.last.body, '{}');
    },
  );
  test(
    '401 expires session; malformed exchange rejected without retry',
    () async {
      transport.response = const TransportResponse(
        401,
        '{"error":{"code":"UNAUTHENTICATED"}}',
      );
      await expectLater(backend.probe(token), throwsA(isA<SessionExpired>()));
      transport.response = const TransportResponse(201, '{"token":"bad"}');
      await expectLater(
        backend.exchange('synthetic'),
        throwsA(isA<ApiFailure>()),
      );
      expect(transport.requests.length, 2);
    },
  );
}
