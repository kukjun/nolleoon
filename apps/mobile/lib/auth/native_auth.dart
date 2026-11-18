import '../data/io_transport.dart';
import 'auth_repository.dart';
import 'kakao_identity.dart';
import 'native_auth_backend.dart';
import 'secure_session_store.dart';

/// Not invoked by the preparation shell. Release composition must explicitly
/// confirm native platform registration and supply the same Kakao app's native
/// key (never a REST secret). No runtime environment discovery or fake login.
AuthRepository createNativeAuth({
  String nativeAppKey = '',
  bool platformSetupVerified = false,
}) => AuthRepository(
  identity: NativeKakaoIdentity(
    nativeAppKey: nativeAppKey,
    platformSetupVerified: platformSetupVerified,
  ),
  backend: NativeAuthBackend(transport: const IoApiTransport()),
  store: SecureSessionStore(),
);
