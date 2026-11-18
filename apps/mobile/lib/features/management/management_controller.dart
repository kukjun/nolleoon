import 'package:flutter/foundation.dart';

import '../../data/api_client.dart';
import '../../data/wire_models.dart';
import 'management_repository.dart';

enum ManagementState {
  loading,
  ready,
  busy,
  uncertain,
  conflict,
  error,
  finished,
}

class ManagementRecovery {
  ManagementRecovery(this.accountId);
  final String accountId;
  MutationIntent? pending;
  void clear() {
    pending = null;
  }
}

class ManagementController extends ChangeNotifier {
  ManagementController(
    this.repository,
    this.roomId, {
    required this.onSessionLost,
    required this.recovery,
    required String accountId,
  }) {
    if (accountId.isEmpty ||
        recovery.accountId != accountId ||
        (recovery.pending != null &&
            recovery.pending!.parameters['roomId'] != roomId)) {
      throw ArgumentError('Recovery owner mismatch');
    }
    if (pending != null) {
      state = ManagementState.uncertain;
      message = '이전 요청의 처리 여부를 확인해 주세요. 자동으로 다시 보내지 않아요.';
    }
  }
  final ManagementRecovery recovery;
  final ManagementRepository repository;
  final String roomId;
  final VoidCallback onSessionLost;
  RoomDto? room;
  ManagementState state = ManagementState.loading;
  MutationIntent? get pending => recovery.pending;
  set pending(MutationIntent? value) {
    recovery.pending = value;
  }

  DeletedRoom? deletion;
  String? message;
  bool _disposed = false;
  CancellationToken? _cancel;
  bool get admin => (room?.data['self'] as Map?)?['isAdmin'] == true;
  bool get active => room?.data['activeRun'] != null;
  bool get open => room?.data['status'] == 'open';
  bool permits(ApiOperation op, {String? target}) {
    if (room == null || state != ManagementState.ready) return false;
    final own = (room!.data['self'] as Map)['membershipId'];
    final members = room!.data['members'] as List;
    final validTarget =
        target != null &&
        target != own &&
        members.any((m) => (m as Map)['membershipId'] == target);
    return switch (op) {
      ApiOperation.updateRoom => admin && open,
      ApiOperation.roomStatus || ApiOperation.deleteRoom => admin && !active,
      ApiOperation.transferAdministrator => admin && open && validTarget,
      ApiOperation.removeMember => admin && open && !active && validTarget,
      ApiOperation.leaveRoom => !admin && open && !active,
      _ => false,
    };
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  Future<void> refresh() async {
    if (_disposed ||
        state == ManagementState.busy ||
        state == ManagementState.uncertain) {
      return;
    }
    _cancel?.cancel();
    final cancel = _cancel = CancellationToken();
    state = ManagementState.loading;
    room = null;
    message = null;
    _notify();
    try {
      final value = await repository.get(roomId, cancel: cancel);
      if (_disposed || cancel.isCancelled) return;
      room = value;
      state = ManagementState.ready;
    } catch (e) {
      if (_disposed || cancel.isCancelled) return;
      _error(e, false);
    }
    _notify();
  }

  Future<void> submit(
    ApiOperation op, {
    Map<String, Object?> values = const {},
    String? target,
  }) async {
    if (!permits(op, target: target)) return;
    pending = repository.prepare(
      op,
      room!,
      values: {
        ...values,
        if (op == ApiOperation.transferAdministrator) 'membershipId': target,
      },
      memberId: op == ApiOperation.removeMember ? target : null,
    );
    await _send();
  }

  Future<void> retry() async {
    if (state == ManagementState.uncertain && pending != null) await _send();
  }

  Future<void> _send() async {
    if (_disposed || pending == null) return;
    state = ManagementState.busy;
    message = null;
    _notify();
    final cancel = _cancel = CancellationToken();
    try {
      final result = await repository.execute(pending!, cancel: cancel);
      if (_disposed || cancel.isCancelled) return;
      pending = null;
      if (result is RoomDto) {
        room = result;
        state = ManagementState.ready;
        message = '변경했어요.';
      } else {
        room = null;
        state = ManagementState.finished;
        if (result is DeletedRoom) deletion = result;
        message = result is DeletedRoom
            ? '방을 삭제 대기로 옮겼어요. 7일 이내 복원할 수 있어요.'
            : '방에서 나왔어요.';
      }
    } catch (e) {
      if (_disposed || cancel.isCancelled) return;
      _error(e, true);
    }
    _notify();
  }

  void _error(Object e, bool mutation) {
    if (e is ApiFailure &&
        (e.status == 401 || e.kind == FailureKind.unauthenticated)) {
      room = null;
      pending = null;
      state = ManagementState.error;
      message = '다시 로그인해 주세요.';
      onSessionLost();
      return;
    }
    if (e is ApiFailure && (e.status == 403 || e.status == 404)) {
      room = null;
      pending = null;
      state = ManagementState.error;
      message = '이 방을 관리할 권한이 없거나 방이 없어졌어요.';
      return;
    }
    if (e is ApiFailure && e.status == 409) {
      pending = null;
      state = ManagementState.conflict;
      message = '방 상태가 바뀌었어요. 다시 불러온 뒤 확인해 주세요.';
      return;
    }
    if (mutation &&
        (e is! ApiFailure || e.status == null || e.status! >= 500)) {
      state = ManagementState.uncertain;
      message = '서버 처리 여부를 확인하지 못했어요. 같은 요청만 다시 확인할 수 있어요.';
      return;
    }
    pending = null;
    state = ManagementState.error;
    message = '요청을 완료하지 못했어요. 상태를 다시 확인해 주세요.';
  }

  @override
  void dispose() {
    _disposed = true;
    _cancel?.cancel();
    room = null;
    super.dispose();
  }
}
