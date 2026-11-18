import 'package:flutter/foundation.dart';

import '../../data/api_client.dart';
import '../../data/wire_models.dart';
import 'history_repository.dart';

class HistoryController extends ChangeNotifier {
  HistoryController(this.repository, this.roomId, {this.onSessionLost});
  final HistoryRepository repository;
  final String roomId;
  final VoidCallback? onSessionLost;
  List<RunDto> items = [];
  RunDto? detail;
  String? nextCursor, error;
  bool busy = false, foreground = true;
  bool _disposed = false;
  int _generation = 0;
  CancellationToken? _cancel;
  final Set<String> _consumed = {};
  bool _current(int generation) =>
      !_disposed && foreground && generation == _generation;
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void _stop() {
    _generation++;
    _cancel?.cancel();
    _cancel = null;
    busy = false;
  }

  void _clear() {
    items = [];
    detail = null;
    nextCursor = null;
    _consumed.clear();
  }

  Future<void> _read(
    Future<void> Function(CancellationToken, int) action,
  ) async {
    if (_disposed || !foreground || busy) return;
    final generation = ++_generation, cancel = CancellationToken();
    _cancel = cancel;
    busy = true;
    error = null;
    _notify();
    try {
      await action(cancel, generation);
    } catch (e) {
      if (!_current(generation)) return;
      final lost =
          e is ApiFailure &&
          (e.status == 401 || e.kind == FailureKind.unauthenticated);
      final denied = e is ApiFailure && [403, 404, 410].contains(e.status);
      if (lost || denied) _clear();
      error = lost
          ? '다시 로그인해 주세요.'
          : denied
          ? '이 기록에 접근할 수 없어요.'
          : '기록을 확인하지 못했어요. 다시 시도해 주세요.';
      if (lost) {
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
      }
    }
  }

  Future<void> refresh() async {
    if (_disposed || !foreground) return;
    _stop();
    _clear();
    await _read((cancel, generation) async {
      final page = await repository.page(roomId, cancel: cancel);
      if (_current(generation)) {
        items = page.items;
        nextCursor = page.nextCursor;
      }
    });
  }

  Future<void> more() async {
    final cursor = nextCursor;
    if (cursor == null) return;
    await _read((cancel, generation) async {
      final page = await repository.page(
        roomId,
        cursor: cursor,
        cancel: cancel,
      );
      if (!_current(generation)) return;
      if (page.nextCursor == cursor ||
          (page.nextCursor != null && _consumed.contains(page.nextCursor))) {
        throw const FormatException('Repeated cursor');
      }
      _consumed.add(cursor);
      final combined = {for (final item in items) item.runId: item};
      for (final item in page.items) {
        final old = combined[item.runId];
        if (old == null || item.version >= old.version) {
          combined[item.runId] = item;
        }
      }
      items = List.unmodifiable(combined.values);
      nextCursor = page.nextCursor;
    });
  }

  Future<void> select(String runId) async {
    if (_disposed || !foreground) return;
    _stop();
    detail = null;
    await _read((cancel, generation) async {
      final run = await repository.detail(roomId, runId, cancel: cancel);
      if (_current(generation)) detail = run;
    });
  }

  void closeDetail() {
    _stop();
    detail = null;
    error = null;
    _notify();
  }

  Future<void> setForeground(bool value) async {
    if (_disposed || foreground == value) return;
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

  @override
  void dispose() {
    _stop();
    _clear();
    _disposed = true;
    super.dispose();
  }
}
