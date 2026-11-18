import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:kakao_flutter_sdk_user/kakao_flutter_sdk_user.dart';

import 'auth_repository.dart';

/// SDK provider credentials live only until the server exchange completes.
class EphemeralKakaoTokens implements TokenManager {
  OAuthToken? _token;
  @override
  Future<OAuthToken?> getToken() async => _token;
  @override
  Future<void> setToken(OAuthToken token) async {
    _token = token;
  }

  @override
  Future<void> clear() async {
    _token = null;
  }
}

abstract interface class KakaoGateway {
  void initialize(String nativeKey);
  Future<bool> talkInstalled();
  Future<String> talkLogin();
  Future<String> accountLogin();
  Future<void> clear();
}

class SdkKakaoGateway implements KakaoGateway {
  final _tokens = EphemeralKakaoTokens();
  @override
  void initialize(String nativeKey) {
    KakaoSdk.init(nativeAppKey: nativeKey, loggingEnabled: false);
    TokenManagerProvider.instance.manager = _tokens;
  }

  @override
  Future<bool> talkInstalled() => isKakaoTalkInstalled();
  @override
  Future<String> talkLogin() async =>
      (await UserApi.instance.loginWithKakaoTalk()).accessToken;
  @override
  Future<String> accountLogin() async =>
      (await UserApi.instance.loginWithKakaoAccount()).accessToken;
  @override
  Future<void> clear() => _tokens.clear();
}

class NativeKakaoIdentity implements KakaoIdentity {
  NativeKakaoIdentity({
    required this.nativeAppKey,
    this.platformSetupVerified = false,
    KakaoGateway? gateway,
  }) : _gateway = gateway ?? SdkKakaoGateway();
  final String nativeAppKey;
  // Explicit release gate: key alone does not prove URL scheme/key hash setup.
  final bool platformSetupVerified;
  final KakaoGateway _gateway;
  bool _initialized = false;
  @override
  bool get configured =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.iOS ||
          defaultTargetPlatform == TargetPlatform.android) &&
      nativeAppKey.trim().isNotEmpty &&
      platformSetupVerified;
  @override
  Future<String> login() async {
    if (!configured) throw StateError('Native login unavailable');
    if (!_initialized) {
      _gateway.initialize(nativeAppKey);
      _initialized = true;
    }
    try {
      // No fallback after cancellation or a failed provider request.
      return await _gateway.talkInstalled()
          ? await _gateway.talkLogin()
          : await _gateway.accountLogin();
    } on PlatformException catch (e) {
      if (e.code == 'CANCELED') throw const LoginCancelled();
      rethrow;
    } on KakaoClientException catch (e) {
      if (e.reason == ClientErrorCause.cancelled) throw const LoginCancelled();
      rethrow;
    }
  }

  @override
  Future<void> clear() => _gateway.clear();
}
