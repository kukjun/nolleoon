import 'api_origin.dart';

import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'api_client.dart';
import 'wire_models.dart';

/// Only the native account avatar and current-room avatar image namespace.
final class AvatarBinaryRequest {
  AvatarBinaryRequest(
    this.uri,
    this.method,
    Map<String, String> headers,
    Uint8List? body,
  ) : headers = Map.unmodifiable(headers),
      body = body == null
          ? null
          : Uint8List.fromList(body).asUnmodifiableView();
  final Uri uri;
  final String method;
  final Map<String, String> headers;
  final Uint8List? body;
  @override
  String toString() => 'AvatarBinaryRequest(redacted)';
}

final class AvatarBinaryResponse {
  AvatarBinaryResponse(this.status, this.mime, Uint8List bytes)
    : bytes = Uint8List.fromList(bytes).asUnmodifiableView();
  final int status;
  final String mime;
  final Uint8List bytes;
  @override
  String toString() => 'AvatarBinaryResponse(redacted)';
}

abstract interface class AvatarBinaryTransport {
  /// Must bound response stream at 64KiB BEFORE buffering, cancel socket I/O,
  /// never redirect, attach cookies, persist images, or log credentials/content.
  Future<AvatarBinaryResponse> sendAvatar(
    AvatarBinaryRequest request,
    CancellationToken cancel,
  );
}

bool validNativeAvatarImagePath(String path) => RegExp(
  r'^/api/native/(account/avatar/image|travel-rooms/[A-Za-z0-9_-]{1,128}/avatars/[A-Za-z0-9_-]{1,128}/image)(\?v=[0-9]+)?$',
).hasMatch(path);
void validateAvatarRequest(AvatarBinaryRequest r, {ApiOrigin? origin}) {
  final u = r.uri;
  if (!(origin ?? ApiOrigin.configured).allows(u) ||
      !{'GET', 'PUT'}.contains(r.method)) {
    throw ArgumentError('Unapproved avatar request');
  }
  final path = u.path + (u.hasQuery ? '?${u.query}' : '');
  final metadata = path == '/api/native/account/avatar';
  final upload =
      path == '/api/native/account/avatar/image' && r.method == 'PUT';
  if (!metadata &&
      !upload &&
      !(r.method == 'GET' && validNativeAvatarImagePath(path))) {
    throw ArgumentError('Unapproved avatar path');
  }
  const headers = {
    'Accept',
    'Authorization',
    'Content-Type',
    'X-Avatar-Revision',
  };
  if (r.headers.keys.any((k) => !headers.contains(k)) ||
      !RegExp(r'^Bearer [A-Za-z0-9_-]{43}$')
          .hasMatch(r.headers['Authorization'] ?? '')) {
    throw ArgumentError('Invalid avatar headers');
  }
  if (r.method == 'GET' && r.body != null) {
    throw ArgumentError('Unexpected body');
  }
  if (r.method == 'PUT' &&
      (r.body == null || r.body!.isEmpty || r.body!.length > 1048576)) {
    throw ArgumentError('Invalid avatar body');
  }
  if (upload &&
      (!{
            'image/jpeg',
            'image/png',
            'image/webp',
          }.contains(r.headers['Content-Type']) ||
          !RegExp(r'^\d+$').hasMatch(r.headers['X-Avatar-Revision'] ?? ''))) {
    throw ArgumentError('Invalid upload');
  }
  if (metadata &&
      r.method == 'PUT' &&
      (r.headers['Content-Type'] != 'application/json' ||
          r.body!.length > 4096)) {
    throw ArgumentError('Invalid avatar metadata');
  }
}

class AvatarClient {
  AvatarClient({
    required this.transport,
    required this.accessToken,
    ApiOrigin? origin,
    this.timeout = const Duration(seconds: 6),
  }) : origin = origin ?? ApiOrigin.configured;
  final ApiOrigin origin;
  final AvatarBinaryTransport transport;
  final Future<String?> Function() accessToken;
  final Duration timeout;
  Future<AvatarDto> get({CancellationToken? cancel}) async =>
      _dto(await _request('/api/native/account/avatar', 'GET', cancel: cancel));
  Future<AvatarDto> setPreset(
    String presetId,
    int revision, {
    CancellationToken? cancel,
  }) async {
    _revision(revision);
    if (!RegExp(r'^preset-(0[1-9]|10)$').hasMatch(presetId)) {
      throw ArgumentError('Invalid preset');
    }
    return _dto(
      await _request(
        '/api/native/account/avatar',
        'PUT',
        body: Uint8List.fromList(
          utf8.encode(
            jsonEncode({'presetId': presetId, 'expectedRevision': revision}),
          ),
        ),
        mime: 'application/json',
        cancel: cancel,
      ),
    );
  }

  Future<AvatarDto> upload(
    Uint8List bytes,
    String mime,
    int revision, {
    CancellationToken? cancel,
  }) async {
    _revision(revision);
    if (bytes.isEmpty ||
        bytes.length > 1048576 ||
        !{'image/png', 'image/jpeg', 'image/webp'}.contains(mime)) {
      throw ArgumentError('Invalid photo');
    }
    // Snapshot before credential acquisition yields; UI may clear its preview
    // on navigation/logout while this request is awaiting secure storage.
    final owned = Uint8List.fromList(bytes);
    try {
      return _dto(
        await _request(
          '/api/native/account/avatar/image',
          'PUT',
          body: owned,
          mime: mime,
          revision: revision,
          cancel: cancel,
        ),
      );
    } finally {
      owned.fillRange(0, owned.length, 0);
    }
  }

  Future<Uint8List> image(String path, {CancellationToken? cancel}) async {
    if (!validNativeAvatarImagePath(path)) {
      throw ArgumentError('Unapproved image URL');
    }
    final response = await _request(path, 'GET', cancel: cancel);
    final b = response.bytes;
    if (response.mime != 'image/webp' ||
        b.length < 12 ||
        ascii.decode(b.sublist(0, 4), allowInvalid: true) != 'RIFF' ||
        ascii.decode(b.sublist(8, 12), allowInvalid: true) != 'WEBP') {
      throw const ApiFailure(FailureKind.invalidResponse);
    }
    return Uint8List.fromList(b);
  }

  void _revision(int x) {
    if (x < 0 || x > 9007199254740991) throw ArgumentError('Invalid revision');
  }

  AvatarDto _dto(AvatarBinaryResponse r) {
    try {
      if (r.mime != 'application/json') throw const FormatException();
      return AvatarDto.fromJson(jsonDecode(utf8.decode(r.bytes)));
    } catch (_) {
      throw const ApiFailure(FailureKind.invalidResponse);
    }
  }

  Future<AvatarBinaryResponse> _request(
    String path,
    String method, {
    Uint8List? body,
    String? mime,
    int? revision,
    CancellationToken? cancel,
  }) async {
    final local = CancellationToken();
    final stopped = Completer<AvatarBinaryResponse>();
    void stop(FailureKind kind) {
      if (!stopped.isCompleted) {
        local.cancel();
        stopped.completeError(ApiFailure(kind));
      }
    }

    // Attach an error listener before asynchronous credential work begins.
    final stopFuture = stopped.future;
    final timer = Timer(timeout, () => stop(FailureKind.timeout));
    var finished = false;
    if (cancel?.isCancelled ?? false) stop(FailureKind.cancelled);
    cancel?.whenCancelled.then((_) {
      if (!finished) stop(FailureKind.cancelled);
    });
    Future<AvatarBinaryResponse> perform() async {
      final bearer = await accessToken();
      if (local.isCancelled) throw const ApiFailure(FailureKind.cancelled);
      if (bearer == null || !RegExp(r'^[A-Za-z0-9_-]{43}$').hasMatch(bearer)) {
        throw const ApiFailure(FailureKind.unauthenticated);
      }
      final request = AvatarBinaryRequest(origin.base.resolve(path), method, {
        'Accept': path.contains('/image') && method == 'GET'
            ? 'image/webp'
            : 'application/json',
        'Authorization': 'Bearer $bearer',
        'Content-Type': ?mime,
        if (revision != null) 'X-Avatar-Revision': '$revision',
      }, body);
      validateAvatarRequest(request, origin: origin);
      final response = await transport.sendAvatar(request, local);
      if (response.bytes.length > 65536) {
        throw const ApiFailure(FailureKind.invalidResponse);
      }
      if (response.status < 200 || response.status >= 300) {
        String? code;
        try {
          final v = jsonDecode(utf8.decode(response.bytes));
          final c = v is Map && v['error'] is Map ? v['error']['code'] : null;
          if (c is String && RegExp(r'^[A-Z_]{1,64}$').hasMatch(c)) code = c;
        } catch (_) {}
        throw ApiFailure(
          FailureKind.server,
          status: response.status,
          code: code,
        );
      }
      return response;
    }

    try {
      return await Future.any([perform(), stopFuture]);
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

/// Shared stream collector used by the real IO transport; never buffers an
/// over-budget chunk and observes cancellation between chunks.
Future<Uint8List> collectAvatarBytes(
  Stream<List<int>> stream,
  CancellationToken cancel,
) async {
  final bytes = BytesBuilder(copy: false);
  var length = 0;
  await for (final chunk in stream) {
    if (cancel.isCancelled) throw const ApiFailure(FailureKind.cancelled);
    length += chunk.length;
    if (length > 65536) throw const ApiFailure(FailureKind.invalidResponse);
    bytes.add(chunk);
  }
  if (cancel.isCancelled) throw const ApiFailure(FailureKind.cancelled);
  return bytes.takeBytes();
}
