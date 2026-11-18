import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../data/api_client.dart';
import '../../data/wire_models.dart';
import 'rooms_repository.dart';

/// Account-bound memory only. Auth composition clears this on logout/account
/// switch, but may retain across inactive -> verified same-account remount.
class RoomsCreateRecovery {
  RoomsCreateRecovery(this.accountId);
  final String accountId;
  MutationIntent? _intent;
  void clear() {
    _intent = null;
  }

  @override
  String toString() => 'RoomsCreateRecovery(redacted)';
}

class RoomsController extends ChangeNotifier {
  RoomsController(
    this.repository, {
    this.onSessionLost,
    this.createRecovery,
    String? accountId,
  }) {
    if (createRecovery != null &&
        (accountId == null || accountId != createRecovery!.accountId)) {
      throw ArgumentError('Pending room intent belongs to a different account');
    }
  }
  final RoomsCreateRecovery? createRecovery;
  final RoomsRepository repository;
  final VoidCallback? onSessionLost;
  List<JsonMap> items = const [];
  String? nextCursor, roomId, error;
  RoomDto? room;
  bool busy = false, foreground = true;
  bool _disposed = false;
  int _generation = 0;
  CancellationToken? _request;
  Timer? _poll;
  MutationIntent? _localCreate;
  MutationIntent? get _create =>
      createRecovery == null ? _localCreate : createRecovery!._intent;
  set _create(MutationIntent? value) {
    if (createRecovery == null) {
      _localCreate = value;
    } else {
      createRecovery!._intent = value;
    }
  }

  Map<String, Object?>? get pendingDraft => _create == null
      ? null
      : Map<String, Object?>.unmodifiable(
          jsonDecode(_create!.serializedBody) as Map<String, dynamic>,
        );
  bool get pendingCreate => _create != null;
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void _stop() {
    _generation++;
    _request?.cancel();
    _request = null;
    _poll?.cancel();
    _poll = null;
    busy = false;
  }

  void _schedule() {
    _poll?.cancel();
    if (!_disposed && foreground && roomId != null && error == null) {
      _poll = Timer(const Duration(seconds: 10), () => refresh());
    }
  }

  Future<void> _perform(
    Future<void> Function(CancellationToken, int) task,
  ) async {
    if (_disposed || !foreground || busy) return;
    final generation = ++_generation;
    final cancel = CancellationToken();
    _request = cancel;
    busy = true;
    error = null;
    _poll?.cancel();
    _notify();
    try {
      await task(cancel, generation);
    } catch (e) {
      if (!_current(generation)) return;
      if (e is ApiFailure && e.kind == FailureKind.cancelled) return;
      final code = e is ApiFailure ? e.code : null;
      final unauthorized =
          e is ApiFailure &&
          (e.kind == FailureKind.unauthenticated || e.status == 401);
      if (unauthorized ||
          (e is ApiFailure && [403, 404, 410].contains(e.status)) ||
          ['FORBIDDEN', 'NOT_FOUND', 'ROOM_CLOSED'].contains(code)) {
        room = null;
        items = const [];
        nextCursor = null;
        // No polling a revoked resource. Explicit retry must re-authorize.
      }
      error = unauthorized
          ? '로그인이 만료됐어요. 다시 로그인해 주세요.'
          : code == 'FORBIDDEN' || code == 'NOT_FOUND'
          ? '이 여행방에 접근할 수 없어요.'
          : code == 'INVALID_INPUT'
          ? '입력 내용을 확인해 주세요.'
          : code == 'STATE_CONFLICT'
          ? '상태가 바뀌었어요. 새로고침 후 다시 확인해 주세요.'
          : '연결을 확인하고 다시 시도해 주세요.';
      if (unauthorized) {
        _create = null;
        onSessionLost?.call();
      }
    } finally {
      if (_current(generation)) {
        busy = false;
        _request = null;
        _notify();
        _schedule();
      }
    }
  }

  bool _current(int generation) =>
      !_disposed && foreground && generation == _generation;
  Future<void> refresh() async {
    await _perform((cancel, generation) async {
      final id = roomId;
      if (id != null) {
        final result = await repository.get(id, cancel: cancel);
        if (_current(generation)) room = result;
      } else {
        final result = await repository.list(cancel: cancel);
        if (_current(generation)) {
          items = result.items;
          nextCursor = result.nextCursor;
        }
      }
    });
  }

  Future<void> loadMore() async {
    final cursor = nextCursor;
    if (cursor == null || roomId != null) return;
    await _perform((cancel, generation) async {
      final result = await repository.list(cursor: cursor, cancel: cancel);
      if (_current(generation)) {
        final merged = {
          for (final item in items) item['roomId']: item,
          for (final item in result.items) item['roomId']: item,
        };
        items = List.unmodifiable(merged.values);
        nextCursor = result.nextCursor == cursor ? null : result.nextCursor;
      }
    });
  }

  Future<void> open(String id) async {
    _stop();
    roomId = id;
    room = null;
    items = const [];
    nextCursor = null;
    error = null;
    await refresh();
  }

  Future<void> backToList() async {
    _stop();
    roomId = null;
    room = null;
    items = const [];
    nextCursor = null;
    _create = null;
    error = null;
    await refresh();
  }

  Future<void> create(String title, String? start, String? end) async {
    if (_disposed || !foreground || busy) return;
    _create ??= repository.prepareCreate(title, start, end);
    await _perform((cancel, generation) async {
      try {
        final result = await repository.create(_create!, cancel: cancel);
        if (_current(generation)) {
          _create = null;
          roomId = result.roomId;
          room = result;
          items = const [];
          nextCursor = null;
        }
      } on ApiFailure catch (e) {
        // Server validation is a known rejection; network/timeout/malformed success
        // may have committed and MUST retain this same mutation identity.
        if (_current(generation) &&
            e.kind == FailureKind.server &&
            e.status != null &&
            e.status! >= 400 &&
            e.status! < 500) {
          _create = null;
        }
        rethrow;
      }
    });
  }

  void setForeground(bool active) {
    if (_disposed || foreground == active) return;
    _stop();
    foreground = active;
    room = null;
    items = const [];
    nextCursor = null;
    error = null;
    _notify();
    if (active) refresh();
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _stop();
    room = null;
    items = const [];
    _localCreate = null;
    super.dispose();
  }
}
