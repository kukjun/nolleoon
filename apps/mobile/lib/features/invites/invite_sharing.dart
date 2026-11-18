import 'package:material_ui/material_ui.dart';

import '../../data/api_client.dart';
import '../../data/wire_models.dart';
import '../../navigation/invite_link.dart';
import '../../design/app_components.dart';
import 'invites_repository.dart';

/// This small panel is not an administrator screen. Server authorization remains authoritative.
class InviteSharingController extends ChangeNotifier {
  InviteSharingController(this.repository, this.room, {this.onRoomChanged});
  final InvitesRepository repository;
  final ValueChanged<RoomDto>? onRoomChanged;
  RoomDto room;
  InviteLink? link;
  String? error;
  bool busy = false, requiresRefresh = false;
  MutationIntent? _revoke;
  CancellationToken? _cancel;
  int _epoch = 0;
  bool _disposed = false;
  bool get canManage =>
      room.data['status'] == 'open' &&
      (room.data['self'] as Map)['isAdmin'] == true;
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void updateRoom(RoomDto value) {
    if (value.roomId != room.roomId) throw ArgumentError('Wrong room');
    _epoch++;
    _cancel?.cancel();
    room = value;
    busy = false;
    requiresRefresh = false;
    _revoke = null;
    link = null;
    error = null;
    _notify();
  }

  Future<void> issue() async {
    if (_disposed || busy || requiresRefresh || !canManage) return;
    final intent = repository.prepareIssue(
      room.roomId,
      room.data['version'] as int,
    );
    await _perform((cancel) async {
      final result = await repository.issue(intent, cancel: cancel);
      return (result.snapshot, result.link);
    }, issuing: true);
  }

  Future<void> revoke() async {
    if (_disposed || busy || requiresRefresh || !canManage) return;
    _revoke ??= repository.prepareRevoke(
      room.roomId,
      room.data['version'] as int,
    );
    await _perform(
      (cancel) async =>
          (await repository.revoke(_revoke!, cancel: cancel), null),
      issuing: false,
    );
  }

  Future<void> _perform(
    Future<(RoomDto, InviteLink?)> Function(CancellationToken) work, {
    required bool issuing,
  }) async {
    final epoch = ++_epoch, cancel = CancellationToken();
    _cancel = cancel;
    busy = true;
    error = null;
    link = null;
    _notify();
    try {
      final result = await work(cancel);
      if (_disposed || epoch != _epoch) return;
      if (result.$1.roomId != room.roomId) {
        throw const FormatException('Wrong room response');
      }
      room = result.$1;
      link = result.$2;
      _revoke = null;
      onRoomChanged?.call(room);
    } catch (e) {
      if (_disposed || epoch != _epoch) return;
      requiresRefresh =
          issuing ||
          e is! ApiFailure ||
          ![FailureKind.network, FailureKind.timeout].contains(e.kind);
      error = requiresRefresh
          ? '완료 여부를 확인할 수 없어요. 방을 새로고침한 뒤 다시 확인해 주세요.'
          : '같은 취소 요청을 다시 확인해 주세요.';
    } finally {
      if (!_disposed && epoch == _epoch) {
        busy = false;
        _cancel = null;
        _notify();
      }
    }
  }

  @override
  void dispose() {
    _epoch++;
    _cancel?.cancel();
    _disposed = true;
    super.dispose();
  }
}

class InviteSharingPanel extends StatelessWidget {
  const InviteSharingPanel({
    super.key,
    required this.controller,
    required this.onRefresh,
    this.onShare,
  });
  final InviteSharingController controller;
  final Future<void> Function() onRefresh;
  final Future<void> Function(Uri)? onShare;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('초대 링크'),
        const Text('새 링크를 만들면 이전 링크는 사용할 수 없어요.'),
        if (!controller.canManage)
          const AppStatus(message: '현재 방 관리자만 초대를 관리할 수 있어요.'),
        if (controller.error != null)
          AppStatus(message: controller.error!, isError: true),
        if (controller.requiresRefresh)
          AppAction(label: '방 새로고침', onPressed: onRefresh),
        AppAction(
          label: '새 초대 링크 만들기',
          enabled:
              controller.canManage &&
              !controller.busy &&
              !controller.requiresRefresh,
          onPressed: controller.issue,
        ),
        if (controller.link != null && onShare != null)
          AppAction(
            label: '초대 링크 공유',
            enabled: !controller.busy,
            onPressed: () async {
              final link = controller.link;
              if (link != null) await onShare!(link.uri);
            },
          ),
        AppAction(
          label: '초대 링크 취소',
          enabled:
              controller.canManage &&
              !controller.busy &&
              !controller.requiresRefresh,
          onPressed: controller.revoke,
        ),
      ],
    ),
  );
}
