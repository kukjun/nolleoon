import 'package:flutter/foundation.dart';

import '../../data/api_client.dart';
import '../../data/wire_models.dart';
import '../../navigation/invite_link.dart';
import 'invites_repository.dart';

class InvitesController extends ChangeNotifier {
  InvitesController(
    this.repository,
    this.pending, {
    this.onSessionLost,
    this.onJoined,
  });
  final InvitesRepository repository;
  final PendingInvitation pending;
  final VoidCallback? onSessionLost;
  final ValueChanged<RoomDto>? onJoined;
  InvitationIntent? _intent;
  InviteLink? get link => _intent?.link;
  String? accountId, error;
  bool available = false, busy = false;
  RoomDto? joined;
  MutationIntent? _join;
  CancellationToken? _request;
  int _generation = 0;
  bool _disposed = false;
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void _stop() {
    _generation++;
    _request?.cancel();
    _request = null;
    busy = false;
  }

  bool _current(int generation) =>
      !_disposed &&
      generation == _generation &&
      _intent != null &&
      identical(pending.current, _intent!.link);
  Future<bool> open(String value) async {
    final intent = pending.accept(value);
    if (intent == null) return false;
    _stop();
    _intent = intent;
    available = false;
    joined = null;
    _join = null;
    error = null;
    await preview();
    return true;
  }

  void setAccount(String? id) {
    if (accountId == id) return;
    _stop();
    accountId = id;
    joined = null;
    _join = null;
    _notify();
  }

  Future<void> preview() async {
    if (_disposed ||
        busy ||
        _intent == null ||
        !identical(pending.current, _intent!.link)) {
      return;
    }
    available = false;
    await _perform((cancel, g) async {
      await repository.preview(_intent!.link, cancel: cancel);
      if (_current(g)) available = true;
    });
  }

  Future<void> join() async {
    if (_disposed ||
        busy ||
        !available ||
        accountId == null ||
        _intent == null ||
        joined != null ||
        !identical(pending.current, _intent!.link)) {
      return;
    }
    _join ??= repository.prepareJoin(_intent!.link);
    await _perform((cancel, g) async {
      final room = await repository.join(_join!, cancel: cancel);
      if (!_current(g)) return;
      joined = room;
      pending.complete(_intent!);
      _join = null;
      busy = false;
      _notify();
      onJoined?.call(room);
    });
  }

  Future<void> _perform(
    Future<void> Function(CancellationToken, int) action,
  ) async {
    final generation = ++_generation, cancel = CancellationToken();
    _request = cancel;
    busy = true;
    error = null;
    _notify();
    try {
      await action(cancel, generation);
    } catch (e) {
      if (!_current(generation)) return;
      if (e is ApiFailure && e.kind == FailureKind.cancelled) return;
      final failure = e is ApiFailure ? e : null;
      if (failure?.status == 401 ||
          failure?.kind == FailureKind.unauthenticated) {
        accountId = null;
        _join = null;
        error = '로그인이 만료됐어요. 다시 로그인한 뒤 참가해 주세요.';
        onSessionLost?.call();
      } else if ([403, 404, 410].contains(failure?.status) ||
          ['NOT_FOUND', 'ROOM_CLOSED', 'FORBIDDEN'].contains(failure?.code)) {
        available = false;
        _join = null;
        error = '초대가 만료되거나 취소됐어요. 새 링크를 요청해 주세요.';
      } else if (failure?.code == 'STATE_CONFLICT') {
        available = false;
        _join = null;
        error = '참가 상태가 바뀌었어요. 초대를 다시 확인해 주세요.';
      } else {
        error = '완료 여부를 확인하지 못했어요. 같은 요청으로 다시 시도해 주세요.';
      }
    } finally {
      if (!_disposed && generation == _generation) {
        busy = false;
        _request = null;
        _notify();
      }
    }
  }

  void cancel() {
    _stop();
    if (_intent != null) pending.complete(_intent!);
    _intent = null;
    available = false;
    joined = null;
    _join = null;
    error = null;
    _notify();
  }

  @override
  void dispose() {
    _stop();
    _disposed = true;
    super.dispose();
  }
}
