import 'package:material_ui/material_ui.dart';

import '../../auth/auth_repository.dart';
import '../../design/app_components.dart';

/// Composition must supply the real native backend and explicitly configured
/// SDK adapter. This widget never equates provider return with server login.
class AuthPanel extends StatefulWidget {
  const AuthPanel({super.key, required this.auth});
  final AuthRepository auth;
  @override
  State<AuthPanel> createState() => _AuthPanelState();
}

class _AuthPanelState extends State<AuthPanel> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    widget.auth.resume();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) widget.auth.resume();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.auth,
    builder: (context, _) {
      final auth = widget.auth;
      final busy = auth.phase == AuthPhase.busy;
      return SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Semantics(
                header: true,
                child: Text(
                  '놀러온',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
              ),
              const SizedBox(height: 16),
              if (auth.phase == AuthPhase.signedIn) ...[
                const AppStatus(message: '로그인했어요.'),
                AppAction(label: '로그아웃', onPressed: auth.logout),
              ] else if (auth.phase == AuthPhase.logoutFailed) ...[
                const AppStatus(
                  message: '로그아웃을 완료하지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
                  isError: true,
                ),
                AppAction(label: '로그아웃 다시 시도', onPressed: auth.logout),
              ] else ...[
                if (!auth.identity.configured)
                  const AppStatus(
                    message: '앱 로그인 연결을 준비 중이에요. 아직 카카오 로그인을 시작할 수 없어요.',
                  ),
                if (busy) const AppStatus(message: '로그인 상태를 확인하고 있어요.'),
                if (auth.phase == AuthPhase.error) ...[
                  const AppStatus(
                    message: '로그인 상태를 확인하지 못했어요. 다시 확인해 주세요.',
                    isError: true,
                  ),
                  AppAction(label: '로그인 상태 다시 확인', onPressed: auth.resume),
                ],
                if (auth.hasUnresolvedSession)
                  AppAction(label: '기존 세션 로그아웃', onPressed: auth.logout),
                AppAction(
                  label: '카카오로 로그인',
                  enabled: auth.canLogin,
                  onPressed: auth.login,
                ),
              ],
            ],
          ),
        ),
      );
    },
  );
}
