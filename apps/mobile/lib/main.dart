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
  const MyApp({super.key, this.auth, this.transport, this.invitationLinks});
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
    debugShowCheckedModeBanner: false,
    theme: buildAppTheme(),
    home: AuthGate(auth: _auth, transport: _transport, invitationLinks: _links),
  );
}
