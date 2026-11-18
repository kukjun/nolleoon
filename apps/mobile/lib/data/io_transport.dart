import 'dart:convert';
import 'dart:io';

import 'api_client.dart';

/// Standard-library HTTPS transport. No cookies, redirects, logs or persistence.
/// Credential storage and native login are not implemented here.
final class IoApiTransport implements ApiTransport {
  const IoApiTransport();
  @override
  Future<TransportResponse> send(
    TransportRequest request,
    CancellationToken cancel,
  ) async {
    if (request.uri.scheme != 'https' ||
        request.uri.host != 'nolleoon.kukjun.com' ||
        request.uri.port != 443 ||
        request.uri.userInfo.isNotEmpty ||
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
}
