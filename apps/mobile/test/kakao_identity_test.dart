import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/auth/auth_repository.dart';
import 'package:nolleoon_mobile/auth/kakao_identity.dart';

class Gateway implements KakaoGateway {
  bool installed = false, cancel = false;
  int talk = 0, account = 0;
  @override
  void initialize(String nativeKey) {}
  @override
  Future<bool> talkInstalled() async => installed;
  @override
  Future<String> talkLogin() async {
    talk++;
    if (cancel) throw PlatformException(code: 'CANCELED');
    return 'synthetic';
  }

  @override
  Future<String> accountLogin() async {
    account++;
    return 'synthetic';
  }

  @override
  Future<void> clear() async {}
}

void main() {
  setUp(() => debugDefaultTargetPlatformOverride = TargetPlatform.android);
  tearDown(() => debugDefaultTargetPlatformOverride = null);
  test('missing KakaoTalk uses browser account only', () async {
    final gateway = Gateway();
    final identity = NativeKakaoIdentity(
      nativeAppKey: 'synthetic',
      platformSetupVerified: true,
      gateway: gateway,
    );
    expect(await identity.login(), 'synthetic');
    expect(gateway.account, 1);
    expect(gateway.talk, 0);
  });
  test('Talk cancellation never falls back to browser', () async {
    final gateway = Gateway()
      ..installed = true
      ..cancel = true;
    final identity = NativeKakaoIdentity(
      nativeAppKey: 'synthetic',
      platformSetupVerified: true,
      gateway: gateway,
    );
    await expectLater(identity.login(), throwsA(isA<LoginCancelled>()));
    expect(gateway.talk, 1);
    expect(gateway.account, 0);
  });
}
