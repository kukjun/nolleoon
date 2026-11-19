import 'api_origin.dart';

import 'dart:convert';
import 'dart:io';

import 'avatar_client.dart';

import 'api_client.dart';

/// Standard-library HTTPS transport. No cookies, redirects, logs or persistence.
/// Credential storage and native login are not implemented here.
final class IoApiTransport implements ApiTransport, AvatarBinaryTransport {
  const IoApiTransport({this.origin});
  final ApiOrigin? origin;
  @override
  Future<TransportResponse> send(
    TransportRequest request,
    CancellationToken cancel,
  ) async {
    if (!(origin ?? ApiOrigin.configured).allows(request.uri) ||
        !request.uri.path.startsWith('/api/native/')) {
      throw ArgumentError('Unapproved API destination');
    }
    const allowed = {'accept', 'content-type', 'authorization'};
    if (request.headers.keys.any(
      (key) => !allowed.contains(key.toLowerCase()),
    )) {
      throw ArgumentError('Unapproved API header');
    }
    if (cancel.isCancelled) throw const ApiFailure(FailureKind.cancelled);
    final client = HttpClient();
    HttpClientRequest? outgoing;
    var finished = false;
    cancel.whenCancelled.then((_) {
      if (!finished) {
        outgoing?.abort();
        client.close(force: true);
      }
    });
    try {
      outgoing = await client.openUrl(request.method, request.uri);
      outgoing.followRedirects = false;
      if (cancel.isCancelled) {
        outgoing.abort();
        throw const ApiFailure(FailureKind.cancelled);
      }
      request.headers.forEach(
        (key, value) => outgoing!.headers.set(key, value),
      );
      if (request.body != null) outgoing.write(request.body);
      final response = await outgoing.close();
      final bytes = <int>[];
      await for (final chunk in response) {
        if (cancel.isCancelled) throw const ApiFailure(FailureKind.cancelled);
        if (bytes.length + chunk.length > 1048576) {
          throw const ApiFailure(FailureKind.invalidResponse);
        }
        bytes.addAll(chunk);
      }
      return TransportResponse(
        response.statusCode,
        utf8.decode(bytes, allowMalformed: false),
      );
    } finally {
      finished = true;
      client.close(force: true);
    }
  }

  @override
  Future<AvatarBinaryResponse> sendAvatar(
    AvatarBinaryRequest request,
    CancellationToken cancel,
  ) async {
    validateAvatarRequest(request, origin: origin);
    if (cancel.isCancelled) throw const ApiFailure(FailureKind.cancelled);
    final client = HttpClient();
    HttpClientRequest? outgoing;
    var finished = false;
    cancel.whenCancelled.then((_) {
      if (!finished) {
        outgoing?.abort();
        client.close(force: true);
      }
    });
    try {
      outgoing = await client.openUrl(request.method, request.uri);
      outgoing.followRedirects = false;
      if (cancel.isCancelled) throw const ApiFailure(FailureKind.cancelled);
      request.headers.forEach(
        (key, value) => outgoing!.headers.set(key, value),
      );
      if (request.body != null) outgoing.add(request.body!);
      final response = await outgoing.close();
      if (response.contentLength > 65536) {
        throw const ApiFailure(FailureKind.invalidResponse);
      }
      final bytes = await collectAvatarBytes(response, cancel);
      return AvatarBinaryResponse(
        response.statusCode,
        response.headers.contentType?.mimeType ?? '',
        bytes,
      );
    } finally {
      finished = true;
      client.close(force: true);
    }
  }
}
