import '../data/api_client.dart';
import '../data/wire_models.dart';
import 'auth_repository.dart';

class NativeAuthBackend implements AuthBackend {
  NativeAuthBackend({required this.transport});
  final ApiTransport transport;
  ApiClient _client(String? bearer) => ApiClient(
    transport: transport,
    resolver: const NativeRoutes(),
    accessToken: () async => bearer,
  );
  AuthSession _session(String token, NativeSessionDto dto) => AuthSession(
    token: token,
    expiresAt: DateTime.fromMillisecondsSinceEpoch(dto.expiresAt, isUtc: true),
    accountId: dto.account['id'] as String,
    displayName: dto.account['displayName'] as String,
  );
  @override
  Future<AuthSession> exchange(String kakaoAccessToken) => _client(null).mutate(
    MutationIntent(
      operation: ApiOperation.authExchange,
      body: {'accessToken': kakaoAccessToken},
    ),
    (value) {
      if (value is! Map<String, dynamic> ||
          value.length != 3 ||
          !value.keys.toSet().containsAll({'token', 'expiresAt', 'account'})) {
        throw const FormatException('Invalid auth response');
      }
      final token = value['token'];
      if (token is! String || !RegExp(r'^[A-Za-z0-9_-]{43}$').hasMatch(token)) {
        throw const FormatException('Invalid auth response');
      }
      final dto = NativeSessionDto.fromJson({
        'authenticated': true,
        'expiresAt': value['expiresAt'],
        'account': value['account'],
      });
      if (dto.expiresAt <= DateTime.now().millisecondsSinceEpoch) {
        throw const FormatException('Expired auth response');
      }
      return _session(token, dto);
    },
  );
  @override
  Future<AuthSession> probe(String bearer) async {
    try {
      return _session(
        bearer,
        await _client(bearer)
            .read(ApiOperation.session, NativeSessionDto.fromJson),
      );
    } on ApiFailure catch (e) {
      if (e.kind == FailureKind.unauthenticated || e.status == 401) {
        throw const SessionExpired();
      }
      rethrow;
    }
  }

  @override
  Future<void> logout(String bearer) async {
    try {
      await _client(bearer).mutate(
        MutationIntent(operation: ApiOperation.logout, body: const {}),
        (value) {
          if (value is! Map<String, dynamic> ||
              value.length != 1 ||
              value['authenticated'] != false) {
            throw const FormatException('Invalid logout response');
          }
        },
      );
    } on ApiFailure catch (e) {
      if (e.kind == FailureKind.unauthenticated || e.status == 401) {
        throw const SessionExpired();
      }
      rethrow;
    }
  }
}
