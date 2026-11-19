import 'data/api_origin.dart';
import 'features/profile/photo_source.dart';
import 'features/profile/native_photo_source.dart';
import 'features/account_deletion/deletion_receipt_store.dart';
import 'app/invitation_links.dart';

import 'package:material_ui/material_ui.dart';

import 'app/auth_gate.dart';
import 'auth/auth_repository.dart';
import 'auth/native_auth.dart';
import 'data/api_client.dart';
import 'data/io_transport.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({
    super.key,
    this.auth,
    this.transport,
    this.invitationLinks,
    this.deletionReceiptStore,
    this.photoSource,
  });
  final ProfilePhotoSource? photoSource;
  final DeletionReceiptStore? deletionReceiptStore;
  final InvitationLinkSource? invitationLinks;
  final AuthRepository? auth;
  final ApiTransport? transport;
  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  late final InvitationLinkSource _links =
      widget.invitationLinks ??
      createInvitationLinkSource(
        platformVerified: const bool.fromEnvironment(
          'NATIVE_INVITE_LINKS_VERIFIED',
          defaultValue: false,
        ),
      );
  late final AuthRepository _auth =
      widget.auth ??
      createNativeAuth(
        nativeAppKey: const String.fromEnvironment('KAKAO_NATIVE_APP_KEY'),
        platformSetupVerified: const bool.fromEnvironment(
          'NATIVE_AUTH_PLATFORM_VERIFIED',
          defaultValue: false,
        ),
      );
  late final ProfilePhotoSource? _photos =
      widget.photoSource ??
      configuredNativePhotoSource(
        nativeConfigurationVerified: const bool.fromEnvironment(
          'NATIVE_PHOTO_PLATFORM_VERIFIED',
          defaultValue: false,
        ),
      );
  late final DeletionReceiptStore _receipts =
      widget.deletionReceiptStore ?? SecureDeletionReceiptStore();
  late final ApiTransport _transport =
      widget.transport ?? const IoApiTransport();
  @override
  void dispose() {
    if (widget.auth == null) _auth.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: '놀러온',
    builder: (context, child) => ApiOrigin.configured.isVerification
        ? Column(
            children: [
              const Material(
                child: SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: EdgeInsets.all(8),
                    child: Text(
                      '카카오 연동 확인용 · 로컬 시험 서버\n계정 탈퇴·연결 해제는 이 앱에서 할 수 없어요.',
                    ),
                  ),
                ),
              ),
              Expanded(child: child ?? const SizedBox.shrink()),
            ],
          )
        : child ?? const SizedBox.shrink(),
    debugShowCheckedModeBanner: false,
    theme: buildAppTheme(),
    home: AuthGate(
      auth: _auth,
      transport: _transport,
      invitationLinks: _links,
      deletionReceiptStore: _receipts,
      photoSource: _photos,
    ),
  );
}
