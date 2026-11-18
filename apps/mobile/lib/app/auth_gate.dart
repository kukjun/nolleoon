import 'dart:async';

import 'invitation_links.dart';
import '../navigation/invite_link.dart';
import '../features/invites/invites_controller.dart';
import '../features/invites/invites_repository.dart';
import '../features/invites/invites_screen.dart';

import 'package:material_ui/material_ui.dart';
import 'package:flutter/scheduler.dart';

import '../auth/auth_repository.dart';
import '../data/api_client.dart';
import '../design/app_components.dart';
import '../features/auth/auth_panel.dart';
import '../features/rooms/rooms_repository.dart';
import '../features/rooms/rooms_controller.dart';
import '../features/rooms/rooms_screen.dart';

/// The private subtree exists only for a freshly verified identity. Losing
/// foreground or verified auth disposes room controllers and cancels requests.
class AuthGate extends StatefulWidget {
  const AuthGate({
    super.key,
    required this.auth,
    required this.transport,
    this.invitationLinks = const DisabledInvitationLinks(),
  });
  final InvitationLinkSource invitationLinks;
  final AuthRepository auth;
  final ApiTransport transport;
  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> with WidgetsBindingObserver {
  bool _foreground = true;
  final _pending = PendingInvitation();
  late final InvitesController _invites;
  StreamSubscription<String>? _links;
  bool _loginForInvite = false;
  String? _destinationRoom, _destinationAccount;
  bool get _showInvite =>
      _pending.current != null &&
      !_loginForInvite &&
      [
        AuthPhase.signedIn,
        AuthPhase.signedOut,
        AuthPhase.unavailable,
      ].contains(widget.auth.phase);
  void _syncInvitation() {
    if (!_foreground || !_showInvite) {
      _invites.suspend();
      return;
    }
    _invites.setAccount(
      widget.auth.phase == AuthPhase.signedIn
          ? widget.auth.session?.accountId
          : null,
    );
    if (!_invites.available && !_invites.busy) _invites.preview();
  }

  void _receiveLink(String value) {
    if (!mounted ||
        InviteLink.parse(value) == null ||
        _pending.current?.uri.toString() == value) {
      return;
    }
    _destinationRoom = null;
    _destinationAccount = null;
    _invites.open(value, load: false);
    _syncInvitation();
    setState(() {});
  }

  RoomsCreateRecovery? _recovery;
  void _clearRecovery() {
    _recovery?.clear();
    _recovery = null;
  }

  Future<void> _logout() async {
    _clearRecovery();
    _invites.setAccount(null);
    _destinationRoom = null;
    _destinationAccount = null;
    await widget.auth.logout();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _invites = InvitesController(
      InvitesRepository(
        ApiClient(
          transport: widget.transport,
          resolver: const NativeRoutes(),
          accessToken: () async => widget.auth.phase == AuthPhase.signedIn
              ? widget.auth.session?.token
              : null,
        ),
      ),
      _pending,
      onSessionLost: widget.auth.resume,
      onJoined: (room) {
        if (!mounted ||
            !_foreground ||
            widget.auth.phase != AuthPhase.signedIn) {
          return;
        }
        setState(() {
          _destinationRoom = room.roomId;
          _destinationAccount = widget.auth.session!.accountId;
          _loginForInvite = false;
        });
      },
    );
    _links = widget.invitationLinks.links.listen(
      _receiveLink,
      onError: (Object _) {
        /* No raw link logging or invented route. */
      },
    );
    widget.auth.addListener(_changed);
    widget.auth.resume();
  }

  void _changed() {
    if (!mounted) return;
    if (widget.auth.phase == AuthPhase.signedOut ||
        widget.auth.phase == AuthPhase.logoutFailed) {
      _clearRecovery();
      _invites.setAccount(null);
      _destinationRoom = null;
      _destinationAccount = null;
    }
    if (widget.auth.phase == AuthPhase.signedIn) {
      _loginForInvite = false;
      if (_destinationAccount != null &&
          _destinationAccount != widget.auth.session?.accountId) {
        _destinationRoom = null;
        _destinationAccount = null;
      }
    }
    _syncInvitation();
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
    if (!active) _invites.suspend();
    if (mounted) setState(() => _foreground = active);
    if (active) widget.auth.resume();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    widget.auth.removeListener(_changed);
    _links?.cancel();
    _invites.dispose();
    _clearRecovery();
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
    if (_showInvite) {
      return InvitationScreen(
        controller: _invites,
        onLoginRequested: () async {
          setState(() => _loginForInvite = true);
          _invites.suspend();
        },
        onCancel: () {
          setState(() => _loginForInvite = false);
        },
      );
    }
    final session = widget.auth.session;
    if (widget.auth.phase != AuthPhase.signedIn || session == null) {
      return Scaffold(
        appBar: _pending.current != null
            ? AppBar(
                leading: IconButton(
                  tooltip: '초대로 돌아가기',
                  icon: const Icon(Icons.arrow_back),
                  onPressed: () {
                    setState(() => _loginForInvite = false);
                    _syncInvitation();
                  },
                ),
              )
            : null,
        body: AuthPanel(auth: widget.auth),
      );
    }
    if (_recovery?.accountId != session.accountId) {
      _clearRecovery();
      _recovery = RoomsCreateRecovery(session.accountId);
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
                onPressed: _logout,
                style: TextButton.styleFrom(minimumSize: const Size(48, 48)),
                child: const Text('로그아웃'),
              ),
            ),
          ),
        ),
        Expanded(
          child: RoomsScreen(
            key: ValueKey(
              'rooms:${session.accountId}:${_destinationRoom ?? ''}',
            ),
            initialRoomId: _destinationAccount == session.accountId
                ? _destinationRoom
                : null,
            accountId: session.accountId,
            createRecovery: _recovery,
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
