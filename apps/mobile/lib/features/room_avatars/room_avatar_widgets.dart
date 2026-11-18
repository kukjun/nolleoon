import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../profile/profile_avatar.dart';
import 'room_avatars.dart';

/// Supply a stable repository for one verified account. Photos represent CURRENT
/// members in an open room, never historical snapshots or redacted identities.
class RoomAvatarsScope extends StatefulWidget {
  const RoomAvatarsScope({
    super.key,
    required this.accountScope,
    required this.roomId,
    required this.closed,
    required this.repository,
    required this.child,
    this.refreshKey,
    this.onSessionLost,
  });
  final String accountScope, roomId;
  final bool closed;
  final RoomAvatarSource repository;
  final Widget child;
  final Object? refreshKey;
  final VoidCallback? onSessionLost;
  static RoomAvatarsController? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<_Avatars>()?.notifier;
  @override
  State<RoomAvatarsScope> createState() => _RoomAvatarsScopeState();
}

class _RoomAvatarsScopeState extends State<RoomAvatarsScope>
    with WidgetsBindingObserver {
  late RoomAvatarsController controller;
  Timer? timer;
  bool foreground = true;
  bool get enabled => foreground && !widget.closed;
  void _bind() {
    if (widget.accountScope.isEmpty) {
      throw ArgumentError('Verified account scope required');
    }
    controller = RoomAvatarsController(
      widget.repository,
      roomId: widget.roomId,
      onSessionLost: () => widget.onSessionLost?.call(),
    );
    if (enabled) {
      controller.refresh();
    } else {
      controller.setActive(false);
    }
    timer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (enabled) controller.refresh();
    });
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final state = WidgetsBinding.instance.lifecycleState;
    foreground = state == null || state == AppLifecycleState.resumed;
    _bind();
  }

  @override
  void didUpdateWidget(covariant RoomAvatarsScope old) {
    super.didUpdateWidget(old);
    if (old.accountScope != widget.accountScope ||
        old.roomId != widget.roomId ||
        !identical(old.repository, widget.repository)) {
      timer?.cancel();
      controller.dispose();
      _bind();
    } else if (old.closed != widget.closed) {
      controller.setActive(enabled);
    } else if (old.refreshKey != widget.refreshKey && enabled) {
      controller.refresh(retryImages: true);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    foreground = state == AppLifecycleState.resumed;
    controller.setActive(enabled);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    timer?.cancel();
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      _Avatars(controller: controller, child: widget.child);
}

class _Avatars extends InheritedNotifier<RoomAvatarsController> {
  const _Avatars({
    required RoomAvatarsController controller,
    required super.child,
  }) : super(notifier: controller);
}

/// Outside a scope this is a public preset only. Do NOT pass historic/redacted
/// identities merely to obtain a photo; server-visible current membership only.
class RoomMemberAvatar extends StatefulWidget {
  const RoomMemberAvatar({
    super.key,
    required this.membershipId,
    this.presetId = 'preset-01',
    this.size = 48,
    this.label = '참가자 아바타',
  });
  final String membershipId, presetId, label;
  final double size;
  @override
  State<RoomMemberAvatar> createState() => _RoomMemberAvatarState();
}

class _RoomMemberAvatarState extends State<RoomMemberAvatar> {
  RoomAvatarsController? controller;
  String? retained;
  void _watch(RoomAvatarsController? next) {
    if (identical(controller, next) && retained == widget.membershipId) return;
    if (retained != null) controller?.release(retained!);
    controller = next;
    retained = widget.membershipId;
    controller?.retain(retained!);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _watch(RoomAvatarsScope.maybeOf(context));
  }

  @override
  void didUpdateWidget(covariant RoomMemberAvatar old) {
    super.didUpdateWidget(old);
    if (old.membershipId != widget.membershipId) _watch(controller);
  }

  @override
  void dispose() {
    if (retained != null) controller?.release(retained!);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final avatar = controller?.avatar(widget.membershipId);
    return ProfileAvatar(
      bytes: controller?.bytes(widget.membershipId),
      presetId: avatar?.data['presetId'] as String? ?? widget.presetId,
      size: widget.size,
      label: widget.label,
    );
  }
}
