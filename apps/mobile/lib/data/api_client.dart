import 'dart:async';
import 'dart:convert';

/// No browser-cookie fallback. Native endpoint implementation is verified separately
/// in #162; this layer is only tested with injected synthetic transports.
enum ApiOperation {
  authExchange,
  deleteAccount,
  logout,
  session,
  profile,
  rooms,
  createRoom,
  room,
  updateRoom,
  roomStatus,
  previewInvite,
  joinInvite,
  issueInvite,
  revokeInvite,
  transferAdministrator,
  leaveRoom,
  removeMember,
  deletedRooms,
  deleteRoom,
  restoreRoom,
  history,
  run,
  createRun,
  editRun,
  startRun,
  cancelRun,
  runAction,
}

enum FailureKind {
  network,
  timeout,
  cancelled,
  invalidResponse,
  server,
  unauthenticated,
  retryNotAllowed,
}

final class ApiFailure implements Exception {
  final FailureKind kind;
  final String? code;
  final int? status;
  const ApiFailure(this.kind, {this.code, this.status});
  @override
  String toString() => 'ApiFailure(${kind.name})';
}

final class CancellationToken {
  final Completer<void> _done = Completer<void>();
  bool get isCancelled => _done.isCompleted;
  Future<void> get whenCancelled => _done.future;
  void cancel() {
    if (!isCancelled) _done.complete();
  }
}

final class TransportRequest {
  final Uri uri;
  final String method;
  final Map<String, String> headers;
  final String? body;
  TransportRequest(
    this.uri,
    this.method,
    Map<String, String> headers,
    this.body,
  ) : headers = Map.unmodifiable(headers);
  @override
  String toString() => 'TransportRequest(redacted)';
}

final class TransportResponse {
  final int status;
  final String body;
  const TransportResponse(this.status, this.body);
  @override
  String toString() => 'TransportResponse(redacted)';
}

/// A transport MUST stop its underlying request on cancellation and MUST NOT
/// follow redirects, log bodies/headers, attach browser cookies, or change host.
abstract interface class ApiTransport {
  Future<TransportResponse> send(
    TransportRequest request,
    CancellationToken cancel,
  );
}

final class ResolvedRoute {
  final String path;
  final String method;
  final bool authenticationRequired;
  const ResolvedRoute(
    this.path,
    this.method, {
    this.authenticationRequired = true,
  });
}

abstract interface class ApiPathResolver {
  ResolvedRoute resolve(ApiOperation operation, Map<String, String> parameters);
}

/// Names confirmed with #162's implementer. Server integration/real auth remain
/// a separate gate; there is deliberately no default resolver in ApiClient.
final class NativeRoutes implements ApiPathResolver {
  const NativeRoutes();
  @override
  ResolvedRoute resolve(ApiOperation op, Map<String, String> parameters) {
    final needed = switch (op) {
      ApiOperation.room ||
      ApiOperation.updateRoom ||
      ApiOperation.roomStatus ||
      ApiOperation.issueInvite ||
      ApiOperation.revokeInvite ||
      ApiOperation.transferAdministrator ||
      ApiOperation.leaveRoom ||
      ApiOperation.history ||
      ApiOperation.createRun ||
      ApiOperation.deleteRoom ||
      ApiOperation.restoreRoom => ['roomId'],
      ApiOperation.run ||
      ApiOperation.editRun ||
      ApiOperation.startRun ||
      ApiOperation.cancelRun ||
      ApiOperation.runAction => ['roomId', 'runId'],
      ApiOperation.removeMember => ['roomId', 'membershipId'],
      ApiOperation.previewInvite || ApiOperation.joinInvite => ['token'],
      _ => <String>[],
    };
    if (parameters.length != needed.length ||
        needed.any((k) => !parameters.containsKey(k))) {
      throw ArgumentError('Invalid route parameters');
    }
    for (final value in parameters.values) {
      if (!RegExp(r'^[A-Za-z0-9_-]{1,128}$').hasMatch(value)) {
        throw ArgumentError('Invalid route parameters');
      }
    }
    final room = '/api/native/travel-rooms/${parameters['roomId']}';
    final run = '$room/runs/${parameters['runId']}';
    return switch (op) {
      ApiOperation.authExchange => const ResolvedRoute(
        '/api/native/auth/kakao',
        'POST',
        authenticationRequired: false,
      ),
      ApiOperation.logout => const ResolvedRoute(
        '/api/native/auth/logout',
        'POST',
      ),
      ApiOperation.session => const ResolvedRoute(
        '/api/native/account/session',
        'GET',
      ),
      ApiOperation.deleteAccount => const ResolvedRoute(
        '/api/native/account/delete',
        'POST',
      ),
      ApiOperation.profile => const ResolvedRoute(
        '/api/native/account/profile',
        'POST',
      ),
      ApiOperation.rooms => const ResolvedRoute(
        '/api/native/travel-rooms',
        'GET',
      ),
      ApiOperation.createRoom => const ResolvedRoute(
        '/api/native/travel-rooms',
        'POST',
      ),
      ApiOperation.room => ResolvedRoute(room, 'GET'),
      ApiOperation.updateRoom => ResolvedRoute(room, 'PATCH'),
      ApiOperation.roomStatus => ResolvedRoute('$room/status', 'POST'),
      ApiOperation.previewInvite => ResolvedRoute(
        '/api/native/travel-invites/${parameters['token']}/preview',
        'GET',
        authenticationRequired: false,
      ),
      ApiOperation.joinInvite => ResolvedRoute(
        '/api/native/travel-invites/${parameters['token']}/join',
        'POST',
      ),
      ApiOperation.issueInvite => ResolvedRoute('$room/invite', 'POST'),
      ApiOperation.revokeInvite => ResolvedRoute('$room/invite/revoke', 'POST'),
      ApiOperation.transferAdministrator => ResolvedRoute(
        '$room/administrator',
        'POST',
      ),
      ApiOperation.leaveRoom => ResolvedRoute('$room/leave', 'POST'),
      ApiOperation.removeMember => ResolvedRoute(
        '$room/members/${parameters['membershipId']}/remove',
        'POST',
      ),
      ApiOperation.deletedRooms => const ResolvedRoute(
        '/api/native/travel-deleted-rooms',
        'GET',
      ),
      ApiOperation.deleteRoom => ResolvedRoute('$room/deletion', 'POST'),
      ApiOperation.restoreRoom => ResolvedRoute('$room/restore', 'POST'),
      ApiOperation.history => ResolvedRoute('$room/history', 'GET'),
      ApiOperation.run => ResolvedRoute(run, 'GET'),
      ApiOperation.createRun => ResolvedRoute('$room/runs', 'POST'),
      ApiOperation.editRun => ResolvedRoute(run, 'PATCH'),
      ApiOperation.startRun => ResolvedRoute('$run/start', 'POST'),
      ApiOperation.cancelRun => ResolvedRoute('$run/cancel', 'POST'),
      ApiOperation.runAction => ResolvedRoute('$run/actions', 'POST'),
    };
  }
}

/// Freeze serialized bytes ONCE. Reusing this instance cannot silently substitute
/// a new expectedVersion/requestId after an uncertain transport outcome.
final class MutationIntent {
  final ApiOperation operation;
  final Map<String, String> parameters;
  final String serializedBody;
  bool _attempted = false;
  bool _pending = false;
  MutationIntent({
    required this.operation,
    Map<String, String> parameters = const {},
    required Map<String, Object?> body,
  }) : parameters = Map.unmodifiable(parameters),
       serializedBody = jsonEncode(body) {
    final route = const NativeRoutes().resolve(operation, this.parameters);
    if (route.method == 'GET') {
      throw ArgumentError('Mutation operation required');
    }
    if (![
      ApiOperation.profile,
      ApiOperation.authExchange,
      ApiOperation.logout,
    ].contains(operation)) {
      final id = body['requestId'];
      if (id is! String || !RegExp(r'^[A-Za-z0-9_-]{1,100}$').hasMatch(id)) {
        throw ArgumentError('requestId required');
      }
    }
    if (operation == ApiOperation.restoreRoom) {
      final version = body['deletionVersion'], deletedAt = body['deletedAt'];
      if (body.length != 3 ||
          body.containsKey('expectedVersion') ||
          version is! int ||
          version < 1 ||
          version > 9007199254740991 ||
          deletedAt is! int ||
          deletedAt < 0 ||
          deletedAt > 9007199254740991) {
        throw ArgumentError('Invalid deletion proof');
      }
    }
    if (![
          ApiOperation.profile,
          ApiOperation.authExchange,
          ApiOperation.logout,
          ApiOperation.deleteAccount,
          ApiOperation.createRoom,
          ApiOperation.joinInvite,
          ApiOperation.restoreRoom,
        ].contains(operation) ||
        body.containsKey('expectedVersion')) {
      final version = body['expectedVersion'];
      if (version is! int || version < 0 || version > 9007199254740991) {
        throw ArgumentError('Invalid version');
      }
    }
  }
  @override
  String toString() => 'MutationIntent(redacted)';
}

final class ApiClient {
  static final Uri _base = Uri.parse('https://nolleoon.kukjun.com/');
  final ApiTransport transport;
  final ApiPathResolver resolver;
  final Future<String?> Function() accessToken;
  final Duration timeout;
  ApiClient({
    required this.transport,
    required this.resolver,
    required this.accessToken,
    this.timeout = const Duration(seconds: 6),
  }) {
    if (timeout <= Duration.zero) {
      throw ArgumentError('Positive timeout required');
    }
  }
  Future<T> read<T>(
    ApiOperation operation,
    T Function(Object?) decode, {
    Map<String, String> parameters = const {},
    String? cursor,
    CancellationToken? cancel,
  }) {
    final route = resolver.resolve(operation, parameters);
    if (route.method != 'GET') throw ArgumentError('Read operation required');
    if (cursor != null &&
        !{ApiOperation.rooms, ApiOperation.history}.contains(operation)) {
      throw ArgumentError('Cursor not allowed');
    }
    return _execute(route, decode, cursor: cursor, cancel: cancel);
  }

  Future<T> mutate<T>(
    MutationIntent intent,
    T Function(Object?) decode, {
    CancellationToken? cancel,
  }) async {
    if (intent._pending) throw const ApiFailure(FailureKind.retryNotAllowed);
    if ([
          ApiOperation.issueInvite,
          ApiOperation.authExchange,
        ].contains(intent.operation) &&
        intent._attempted) {
      throw const ApiFailure(FailureKind.retryNotAllowed);
    }
    if (cancel?.isCancelled ?? false) {
      throw const ApiFailure(FailureKind.cancelled);
    }
    final route = resolver.resolve(intent.operation, intent.parameters);
    if (!{'POST', 'PATCH'}.contains(route.method)) {
      throw ArgumentError('Mutation operation required');
    }
    intent._pending = true;
    intent._attempted = true;
    try {
      return await _execute(
        route,
        decode,
        body: intent.serializedBody,
        cancel: cancel,
      );
    } finally {
      intent._pending = false;
    }
  }

  Future<T> _execute<T>(
    ResolvedRoute route,
    T Function(Object?) decode, {
    String? body,
    String? cursor,
    CancellationToken? cancel,
  }) async {
    final path = Uri.tryParse(route.path);
    if (path == null ||
        path.hasScheme ||
        path.hasAuthority ||
        path.hasQuery ||
        path.hasFragment ||
        !RegExp(r'^/api/native/[A-Za-z0-9_/-]+$').hasMatch(route.path) ||
        route.path.contains('//') ||
        route.path.contains('..') ||
        !{'GET', 'POST', 'PATCH'}.contains(route.method)) {
      throw ArgumentError('Unapproved API route');
    }
    if (cursor != null && (cursor.isEmpty || cursor.length > 4096)) {
      throw ArgumentError('Invalid cursor');
    }
    final uri = _base
        .resolve(route.path)
        .replace(queryParameters: cursor == null ? null : {'cursor': cursor});
    if (uri.scheme != 'https' ||
        uri.host != 'nolleoon.kukjun.com' ||
        uri.port != 443 ||
        uri.userInfo.isNotEmpty) {
      throw ArgumentError('Unapproved API host');
    }
    if (cancel?.isCancelled ?? false) {
      throw const ApiFailure(FailureKind.cancelled);
    }
    final local = CancellationToken();
    final stop = Completer<TransportResponse>();
    var finished = false;
    final timer = Timer(timeout, () {
      if (!finished && !stop.isCompleted) {
        local.cancel();
        stop.completeError(const ApiFailure(FailureKind.timeout));
      }
    });
    cancel?.whenCancelled.then((_) {
      if (!finished && !stop.isCompleted) {
        local.cancel();
        stop.completeError(const ApiFailure(FailureKind.cancelled));
      }
    });
    Future<TransportResponse> send() async {
      final headers = <String, String>{'Accept': 'application/json'};
      if (body != null) headers['Content-Type'] = 'application/json';
      if (route.authenticationRequired) {
        final token = await accessToken();
        if (token == null ||
            token.isEmpty ||
            RegExp(r'[\s\x00-\x1f\x7f]').hasMatch(token)) {
          throw const ApiFailure(FailureKind.unauthenticated);
        }
        headers['Authorization'] = 'Bearer $token';
      }
      if (local.isCancelled) throw const ApiFailure(FailureKind.cancelled);
      return transport.send(
        TransportRequest(uri, route.method, headers, body),
        local,
      );
    }

    try {
      final response = await Future.any([send(), stop.future]);
      if (response.body.length > 1048576) {
        throw const ApiFailure(FailureKind.invalidResponse);
      }
      Object? data;
      try {
        data = jsonDecode(response.body);
      } catch (_) {
        throw const ApiFailure(FailureKind.invalidResponse);
      }
      if (response.status < 200 || response.status >= 300) {
        final error = data is Map ? data['error'] : null;
        final rawCode = error is Map ? error['code'] : null;
        final code =
            rawCode is String && RegExp(r'^[A-Z_]{1,64}$').hasMatch(rawCode)
            ? rawCode
            : 'REQUEST_FAILED';
        throw ApiFailure(
          FailureKind.server,
          code: code,
          status: response.status,
        );
      }
      try {
        return decode(data);
      } catch (_) {
        throw const ApiFailure(FailureKind.invalidResponse);
      }
    } on ApiFailure {
      rethrow;
    } catch (_) {
      throw const ApiFailure(FailureKind.network);
    } finally {
      finished = true;
      timer.cancel();
      local.cancel();
    }
  }
}
