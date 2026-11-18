import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../data/api_client.dart';
import '../../data/wire_models.dart';
import 'game_repository.dart';

class GameController extends ChangeNotifier {
  GameController(this.repository, {this.onSessionLost});
  final GameRepository repository;
  final VoidCallback? onSessionLost;
  RunDto? run;
  RoomDto? room;
  String? roomId, runId, error;
  bool busy = false, foreground = true;
  bool _disposed = false;
  int _generation = 0;
  Timer? _poll;
  CancellationToken? _cancel;
  MutationIntent? _pending;
  bool get hasPendingIntent => _pending != null;
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  bool _current(int generation) =>
      !_disposed && foreground && generation == _generation;
  void _stop() {
    _generation++;
    _poll?.cancel();
    _poll = null;
    _cancel?.cancel();
    _cancel = null;
    busy = false;
  }

  void _clear() {
    run = null;
    room = null;
    _pending = null;
  }

  void _schedule() {
    _poll?.cancel();
    if (!_disposed && foreground && roomId != null && error == null) {
      _poll = Timer(
        runId == null
            ? const Duration(seconds: 10)
            : const Duration(milliseconds: 2500),
        refresh,
      );
    }
  }

  Future<void> _perform(
    Future<void> Function(CancellationToken, int) work,
  ) async {
    if (_disposed || !foreground || busy) return;
    final generation = ++_generation;
    final cancel = CancellationToken();
    _cancel = cancel;
    busy = true;
    error = null;
    _poll?.cancel();
    _notify();
    try {
      await work(cancel, generation);
    } catch (e) {
      if (!_current(generation)) return;
      if (e is ApiFailure && e.kind == FailureKind.cancelled) return;
      final unauthorized =
          e is ApiFailure &&
          (e.kind == FailureKind.unauthenticated || e.status == 401);
      final denied = e is ApiFailure && [403, 404, 410].contains(e.status);
      if (unauthorized || denied) _clear();
      error = unauthorized
          ? '로그인이 만료됐어요. 다시 로그인해 주세요.'
          : denied
          ? '이 게임에 접근할 수 없어요.'
          : '연결을 확인하고 다시 시도해 주세요.';
      if (unauthorized) {
        foreground = false;
        _stop();
        _notify();
        onSessionLost?.call();
      }
    } finally {
      if (_current(generation)) {
        busy = false;
        _cancel = null;
        _notify();
        _schedule();
      }
    }
  }

  Future<void> open(String room, String? id) async {
    _stop();
    _clear();
    roomId = room;
    runId = id;
    error = null;
    await refresh();
  }

  Future<void> _read(CancellationToken cancel, int generation) async {
    final roomKey = roomId;
    if (roomKey == null) return;
    final id = runId;
    if (id != null) {
      final value = await repository.get(roomKey, id, cancel: cancel);
      if (_current(generation)) run = value;
    } else {
      final value = await repository.room(roomKey, cancel: cancel);
      if (_current(generation)) {
        room = value;
        final active = value.data['activeRun'];
        if (active is Map) {
          runId = active['runId'] as String;
          await _read(cancel, generation);
        }
      }
    }
  }

  Future<void> refresh() => _perform(_read);
  Future<void> submit(MutationIntent intent) async {
    if (_disposed || !foreground || busy || _pending != null) return;
    if (intent.parameters['roomId'] != roomId ||
        (intent.operation != ApiOperation.createRun &&
            intent.parameters['runId'] != runId)) {
      throw ArgumentError('Intent belongs to another game');
    }
    _pending = intent;
    await retry();
  }

  Future<void> retry() async {
    final intent = _pending;
    if (intent == null) return;
    await _perform((cancel, generation) async {
      try {
        final result = await repository.send(intent, cancel: cancel);
        if (_current(generation)) {
          run = result;
          runId = result.runId;
          room = null;
          _pending = null;
        }
      } catch (e) {
        if (!_current(generation)) return;
        if (e is ApiFailure && e.status == 409) {
          _pending = null;
          run = null;
          room = null;
          await _read(cancel, generation);
          if (_current(generation)) error = '상태가 바뀌었어요. 최신 내용을 확인해 주세요.';
          return;
        }
        if (e is ApiFailure &&
            e.kind == FailureKind.server &&
            e.status != null &&
            e.status! >= 400 &&
            e.status! < 500) {
          _pending = null;
        }
        rethrow;
      }
    });
  }

  Future<void> setForeground(bool value) async {
    if (_disposed || value == foreground) return;
    foreground = value;
    if (!value) {
      _stop();
      _clear();
      error = null;
      _notify();
    } else {
      await refresh();
    }
  }

  void sessionLost() {
    if (_disposed) return;
    foreground = false;
    _stop();
    _clear();
    roomId = null;
    runId = null;
    error = '다시 로그인해 주세요.';
    _notify();
  }

  @override
  void dispose() {
    _stop();
    _clear();
    _disposed = true;
    super.dispose();
  }
}
