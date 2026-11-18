import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/data/io_transport.dart';

class FakeTransport implements ApiTransport {
  final Future<TransportResponse> Function(TransportRequest, CancellationToken)
  handler;
  FakeTransport(this.handler);
  @override
  Future<TransportResponse> send(
    TransportRequest request,
    CancellationToken cancel,
  ) => handler(request, cancel);
}

ApiClient client(
  ApiTransport transport, {
  Duration timeout = const Duration(seconds: 6),
}) => ApiClient(
  transport: transport,
  resolver: const NativeRoutes(),
  accessToken: () async => 'synthetic-test-only',
  timeout: timeout,
);
void main() {
  test(
    'stable mutation intent reuses identical request after uncertain failure',
    () async {
      final sent = <TransportRequest>[];
      final c = client(
        FakeTransport((r, _) async {
          sent.add(r);
          if (sent.length == 1) throw StateError('synthetic failure');
          return const TransportResponse(200, '{"ok":true}');
        }),
      );
      final intent = MutationIntent(
        operation: ApiOperation.startRun,
        parameters: {'roomId': 'r', 'runId': 'g'},
        body: {'requestId': 'request-1', 'expectedVersion': 0},
      );
      await expectLater(
        c.mutate(intent, (x) => x),
        throwsA(
          isA<ApiFailure>().having((e) => e.kind, 'kind', FailureKind.network),
        ),
      );
      await c.mutate(intent, (x) => x);
      expect(sent[0].body, sent[1].body);
      expect(
        sent[0].uri.toString(),
        'https://nolleoon.kukjun.com/api/native/travel-rooms/r/runs/g/start',
      );
      expect(sent[0].headers.keys, isNot(contains('Cookie')));
      expect(sent[0].headers.keys, isNot(contains('Origin')));
      expect(sent[0].headers.keys, isNot(contains('X-Trip-Court-Request')));
    },
  );
  test(
    'invite response loss is not replayed even manually with same intent',
    () async {
      var count = 0;
      final c = client(
        FakeTransport((r, _) async {
          count++;
          throw StateError('lost');
        }),
      );
      final intent = MutationIntent(
        operation: ApiOperation.issueInvite,
        parameters: {'roomId': 'r'},
        body: {'requestId': 'invite-1', 'expectedVersion': 0},
      );
      await expectLater(c.mutate(intent, (x) => x), throwsA(isA<ApiFailure>()));
      await expectLater(
        c.mutate(intent, (x) => x),
        throwsA(
          isA<ApiFailure>().having(
            (e) => e.kind,
            'kind',
            FailureKind.retryNotAllowed,
          ),
        ),
      );
      expect(count, 1);
    },
  );
  test(
    'cancel and timeout are distinct and propagate cancellation to transport',
    () async {
      CancellationToken? observed;
      final c = client(
        FakeTransport((r, cancel) {
          observed = cancel;
          return Completer<TransportResponse>().future;
        }),
        timeout: const Duration(milliseconds: 10),
      );
      await expectLater(
        c.read(ApiOperation.session, (x) => x),
        throwsA(
          isA<ApiFailure>().having((e) => e.kind, 'kind', FailureKind.timeout),
        ),
      );
      expect(observed!.isCancelled, isTrue);
      final cancel = CancellationToken()..cancel();
      await expectLater(
        c.read(ApiOperation.session, (x) => x, cancel: cancel),
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
  test('untrusted path segments and unsupported host cannot escape fixed namespace', () {
    expect(
      () => const NativeRoutes().resolve(ApiOperation.room, {
        'roomId': '../auth/logout',
      }),
      throwsArgumentError,
    );
    expect(
      () => const NativeRoutes().resolve(ApiOperation.room, {
        'roomId': 'https://evil.test',
      }),
      throwsArgumentError,
    );
  });

  test(
    'server conflict and malformed responses never become successful commands',
    () async {
      final conflict = client(
        FakeTransport(
          (r, c) async => const TransportResponse(
            409,
            '{"error":{"code":"STATE_CONFLICT","message":"never display private text"}}',
          ),
        ),
      );
      await expectLater(
        conflict.read(ApiOperation.session, (x) => x),
        throwsA(
          isA<ApiFailure>()
              .having((e) => e.code, 'code', 'STATE_CONFLICT')
              .having(
                (e) => e.toString().contains('private'),
                'safe error',
                isFalse,
              ),
        ),
      );
      final malformed = client(
        FakeTransport((r, c) async => const TransportResponse(200, 'not-json')),
      );
      await expectLater(
        malformed.read(ApiOperation.session, (x) => x),
        throwsA(
          isA<ApiFailure>().having(
            (e) => e.kind,
            'kind',
            FailureKind.invalidResponse,
          ),
        ),
      );
    },
  );
  test('intent copies serialized body and cancellation during auth prevents transport', () async {
    final original = <String, Object?>{
      'requestId': 'same-id',
      'expectedVersion': 0,
      'command': {'kind': 'reveal'},
    };
    final intent = MutationIntent(
      operation: ApiOperation.runAction,
      parameters: {'roomId': 'r', 'runId': 'g'},
      body: original,
    );
    original['expectedVersion'] = 99;
    expect(intent.serializedBody, contains('"expectedVersion":0'));
    var count = 0;
    final auth = Completer<String?>();
    final cancel = CancellationToken();
    final api = ApiClient(
      transport: FakeTransport((r, c) async {
        count++;
        return const TransportResponse(200, '{}');
      }),
      resolver: const NativeRoutes(),
      accessToken: () => auth.future,
    );
    final pending = api.read(ApiOperation.session, (x) => x, cancel: cancel);
    cancel.cancel();
    await expectLater(
      pending,
      throwsA(
        isA<ApiFailure>().having((e) => e.kind, 'kind', FailureKind.cancelled),
      ),
    );
    auth.complete('synthetic-token');
    await Future<void>.delayed(Duration.zero);
    expect(count, 0);
  });

  test(
    'native exchange has no bearer or cookie and no invented requestId',
    () async {
      TransportRequest? captured;
      final api = ApiClient(
        transport: FakeTransport((r, c) async {
          captured = r;
          return const TransportResponse(200, '{}');
        }),
        resolver: const NativeRoutes(),
        accessToken: () async =>
            throw StateError('must not read account token'),
      );
      await api.mutate(
        MutationIntent(
          operation: ApiOperation.authExchange,
          body: {'accessToken': 'synthetic-kakao-only'},
        ),
        (x) => x,
      );
      expect(captured!.uri.path, '/api/native/auth/kakao');
      expect(captured!.headers.containsKey('Authorization'), isFalse);
      expect(captured.toString(), isNot(contains('synthetic-kakao-only')));
    },
  );
  test('IO transport rejects wrong host and forbidden browser headers before networking', () async {
    const io = IoApiTransport();
    await expectLater(
      io.send(
        TransportRequest(
          Uri.parse('http://localhost/api/native/account/session'),
          'GET',
          {},
          null,
        ),
        CancellationToken(),
      ),
      throwsArgumentError,
    );
    await expectLater(
      io.send(
        TransportRequest(
          Uri.parse('https://nolleoon.kukjun.com/api/native/account/session'),
          'GET',
          {'Cookie': 'synthetic'},
          null,
        ),
        CancellationToken(),
      ),
      throwsArgumentError,
    );
  });
}
