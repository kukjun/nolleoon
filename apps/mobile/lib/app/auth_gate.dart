import '../features/profile/photo_source.dart';

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
import 'feature_session.dart';
import 'feature_shell.dart';
import '../data/avatar_client.dart';
import '../features/account_deletion/account_deletion.dart';
import '../features/account_deletion/account_deletion_screen.dart';

/// The private subtree exists only for a freshly verified identity. Losing
/// foreground or verified auth disposes room controllers and cancels requests.
class AuthGate extends StatefulWidget {
  const AuthGate({
    super.key,
    required this.auth,
    required this.transport,
    required this.deletionReceiptStore,
    this.photoSource,
    this.invitationLinks = const DisabledInvitationLinks(),
  });
  final ProfilePhotoSource? photoSource;
  final DeletionReceiptStore deletionReceiptStore;
  final InvitationLinkSource invitationLinks;
  final AuthRepository auth;
  final ApiTransport transport;
  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> with WidgetsBindingObserver {
  bool _foreground = true;
  bool _bootstrapping = true;
  String? _bootstrapError;
  bool _resetConfirm = false, _resetBusy = false;
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
    if (_bootstrapping ||
        _bootstrapError != null ||
        _hasReceipt ||
        !_foreground ||
        !_showInvite) {
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
        _hasReceipt ||
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

  FeatureSession? _features;
  bool _deletionLocalCleaned = false;
  bool get _hasReceipt => _features?.deletion.hasPending ?? false;
  void _beginDeletion() {
    final session = widget.auth.session;
    final owner = _features;
    if (widget.auth.phase != AuthPhase.signedIn ||
        session == null ||
        owner == null ||
        owner.accountId != session.accountId) {
      return;
    }
    owner.deletionRepository ??= AccountDeletionRepository(
      accountScope: owner.accountId,
      token: session.token,
      transport: widget.transport,
      receiptStore: widget.deletionReceiptStore,
      expiresAt: session.expiresAt.millisecondsSinceEpoch,
    );
    owner.open(FeatureRoute.deletion);
    setState(() {});
  }

  Future<void> _completeDeletion(String account) async {
    final owner = _features;
    if (owner == null ||
        owner.accountId != account ||
        (widget.auth.session != null &&
            widget.auth.session!.accountId != account)) {
      throw StateError('Account changed');
    }
    if (_deletionLocalCleaned) return;
    owner.clearPrivate();
    _invites.cancel();
    _pending.clear();
    _destinationRoom = null;
    _destinationAccount = null;
    final receipt = await widget.deletionReceiptStore.read();
    if (receipt == null ||
        !receipt.serverConfirmed ||
        receipt.accountScope != account) {
      throw StateError('Confirmed receipt missing');
    }
    await widget.auth.clearDeletedReceipt(
      accountScope: account,
      tokenDigest: receipt.tokenDigest,
    );
    await widget.deletionReceiptStore.clear();
    if (!mounted || !identical(owner, _features)) return;
    setState(() => _deletionLocalCleaned = true);
  }

  void _clearRecovery() {
    _deletionLocalCleaned = false;
    final previous = _features;
    _features = null;
    previous?.dispose();
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
          if (_features?.accountId == widget.auth.session!.accountId) {
            _features!.openRoom(room.roomId);
          }
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
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _bootstrapping = true;
      _bootstrapError = null;
    });
    try {
      final receipt = await widget.deletionReceiptStore.read();
      if (!mounted) return;
      if (receipt != null) {
        final recovery = DeletionRecovery.restore(
          receipt,
          transport: widget.transport,
          store: widget.deletionReceiptStore,
        );
        _features =
            FeatureSession(receipt.accountScope, recoveredDeletion: recovery)
              ..deletionRepository = recovery.pendingRepository
              ..route = FeatureRoute.deletion;
      } else {
        unawaited(widget.auth.resume());
      }
      if (mounted) {
        setState(() => _bootstrapping = false);
        _syncInvitation();
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _bootstrapping = false;
          _bootstrapError = "저장된 탈퇴 요청을 안전하게 확인할 수 없어요. 자동 로그인과 재전송을 중단했어요.";
        });
      }
    }
  }

  Future<void> _resetLocalRecovery() async {
    if (!_resetConfirm || _resetBusy || _bootstrapError == null) return;
    setState(() => _resetBusy = true);
    try {
      await widget.auth.discardLocalIdentityForReceiptRecovery(
        confirmation: 'CLEAR_LOCAL_AUTH',
      );
      await widget.deletionReceiptStore.clear();
      if (!mounted) return;
      _clearRecovery();
      _pending.clear();
      _invites.cancel();
      _resetConfirm = false;
      await _bootstrap();
    } catch (_) {
      if (mounted) {
        setState(
          () => _bootstrapError =
              '이 기기의 정리를 끝내지 못했어요. 로그인은 열지 않았어요. 로컬 정리만 다시 시도해 주세요.',
        );
      }
    } finally {
      if (mounted) setState(() => _resetBusy = false);
    }
  }

  void _changed() {
    if (!mounted) return;
    if (!_hasReceipt &&
        (widget.auth.phase == AuthPhase.signedOut ||
            widget.auth.phase == AuthPhase.logoutFailed)) {
      _clearRecovery();
      _invites.setAccount(null);
      _destinationRoom = null;
      _destinationAccount = null;
    }
    if (widget.auth.phase == AuthPhase.signedIn) {
      if (_features != null &&
          _features!.accountId != widget.auth.session?.accountId) {
        _clearRecovery();
      }
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
    if (active && !_bootstrapping && _bootstrapError == null && !_hasReceipt) {
      widget.auth.resume();
    }
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
    if (_bootstrapping || _bootstrapError != null) {
      return Scaffold(
        body: SafeArea(
          child: Center(
            child: _bootstrapping
                ? const CircularProgressIndicator()
                : ListView(
                    shrinkWrap: true,
                    padding: const EdgeInsets.all(20),
                    children: [
                      Text(_bootstrapError!),
                      TextButton(
                        onPressed: _resetBusy ? null : _bootstrap,
                        child: const Text('다시 확인'),
                      ),
                      if (!_resetConfirm)
                        OutlinedButton(
                          onPressed: () => setState(() => _resetConfirm = true),
                          child: const Text('이 기기의 복구 정보 정리'),
                        ),
                      if (_resetConfirm) ...[
                        const Text(
                          '서버 탈퇴 완료 여부는 확인되지 않았어요. 이 동작은 서버 계정이나 게임 기록을 삭제하지 않아요.',
                        ),
                        const Text(
                          '이 기기에 저장된 다른 계정의 로그인 정보도 함께 지워져요. 탈퇴 영수증의 임시 복구 기록을 지우면 여기서 같은 요청을 다시 확인할 수 없어요.',
                        ),
                        TextButton(
                          onPressed: _resetBusy
                              ? null
                              : () => setState(() => _resetConfirm = false),
                          child: const Text('취소'),
                        ),
                        FilledButton(
                          onPressed: _resetBusy ? null : _resetLocalRecovery,
                          child: const Text('이 기기 정보만 지우고 다시 시작'),
                        ),
                      ],
                      if (_resetBusy) const LinearProgressIndicator(),
                    ],
                  ),
          ),
        ),
      );
    }
    final owner = _features;
    if (owner != null &&
        owner.route == FeatureRoute.deletion &&
        owner.deletionRepository != null &&
        (owner.deletion.hasPending ||
            (widget.auth.phase == AuthPhase.signedIn &&
                widget.auth.session?.accountId == owner.accountId))) {
      if (_deletionLocalCleaned) {
        return Scaffold(
          body: SafeArea(
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('계정 탈퇴와 기기 정보 정리를 완료했어요.'),
                  TextButton(
                    onPressed: () {
                      setState(_clearRecovery);
                    },
                    child: const Text('로그인 화면으로'),
                  ),
                ],
              ),
            ),
          ),
        );
      }
      return Column(
        children: [
          if (!owner.deletion.hasPending)
            SafeArea(
              bottom: false,
              child: TextButton(
                onPressed: () {
                  owner.home();
                  setState(() {});
                },
                child: const Text('탈퇴 취소'),
              ),
            ),
          Expanded(
            child: AccountDeletionScreen(
              repository: owner.deletionRepository!,
              recovery: owner.deletion,
              onDeleted: _completeDeletion,
            ),
          ),
        ],
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
    if (_features?.accountId != session.accountId) {
      _clearRecovery();
      _features = FeatureSession(session.accountId);
      if (_destinationAccount == session.accountId &&
          _destinationRoom != null) {
        _features!.openRoom(_destinationRoom!);
      }
    }
    final scope = _features!;
    Future<String?> token() async =>
        widget.auth.phase == AuthPhase.signedIn &&
            widget.auth.session?.accountId == scope.accountId
        ? widget.auth.session?.token
        : null;
    final api = ApiClient(
      transport: widget.transport,
      resolver: const NativeRoutes(),
      accessToken: token,
    );
    final binary = widget.transport is AvatarBinaryTransport
        ? widget.transport as AvatarBinaryTransport
        : const UnavailableAvatarTransport();
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
          child: FeatureShell(
            session: scope,
            api: api,
            avatars: AvatarClient(transport: binary, accessToken: token),
            onSessionLost: widget.auth.resume,
            onDeleteAccount: _beginDeletion,
            photoSource: scope.photoSource(widget.photoSource),
          ),
        ),
      ],
    );
  }
}
