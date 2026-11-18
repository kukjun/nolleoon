import 'package:material_ui/material_ui.dart';
import 'package:flutter/scheduler.dart';

import '../auth/auth_repository.dart';
import '../data/api_client.dart';
import '../design/app_components.dart';
import '../features/auth/auth_panel.dart';
import '../features/rooms/rooms_repository.dart';
import '../features/rooms/rooms_screen.dart';

/// The private subtree exists only for a freshly verified identity. Losing
/// foreground or verified auth disposes room controllers and cancels requests.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key, required this.auth, required this.transport});
  final AuthRepository auth;
  final ApiTransport transport;
  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> with WidgetsBindingObserver {
  bool _foreground = true;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    widget.auth.addListener(_changed);
    widget.auth.resume();
  }

  void _changed() {
    if (!mounted) return;
    if (SchedulerBinding.instance.schedulerPhase ==
        SchedulerPhase.persistentCallbacks) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() {});
      });
    } else {
      setState(() {});
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final active = state == AppLifecycleState.resumed;
    if (mounted) setState(() => _foreground = active);
    if (active) widget.auth.resume();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    widget.auth.removeListener(_changed);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_foreground) {
      return const Scaffold(
        body: SafeArea(
          child: Center(child: AppStatus(message: '앱으로 돌아오면 로그인 상태를 다시 확인해요.')),
        ),
      );
    }
    final session = widget.auth.session;
    if (widget.auth.phase != AuthPhase.signedIn || session == null) {
      return Scaffold(body: AuthPanel(auth: widget.auth));
    }
    return Column(
      key: ValueKey(session.accountId),
      children: [
        Material(
          child: SafeArea(
            bottom: false,
            child: Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: widget.auth.logout,
                style: TextButton.styleFrom(minimumSize: const Size(48, 48)),
                child: const Text('로그아웃'),
              ),
            ),
          ),
        ),
        Expanded(
          child: RoomsScreen(
            key: ValueKey('rooms:${session.accountId}'),
            repository: RoomsRepository(
              ApiClient(
                transport: widget.transport,
                resolver: const NativeRoutes(),
                accessToken: () async => session.token,
              ),
            ),
            onSessionLost: widget.auth.resume,
            // Game routes arrive in the next feature. Null callback remains honest.
          ),
        ),
      ],
    );
  }
}
