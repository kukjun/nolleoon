import 'package:flutter/foundation.dart';

import 'photo_source.dart';

/// One verified account's unfinished OS-picker handoff. Memory only, bounded,
/// no upload capability. A freshly authenticated profile consumes it once.
class PhotoSelectionOwner extends ChangeNotifier implements ProfilePhotoSource {
  PhotoSelectionOwner(this.accountScope, this.source);
  final String accountScope;
  final ProfilePhotoSource source;
  PhotoInput? _ready;
  bool pending = false, failed = false, _disposed = false, _inFlight = false;
  int _epoch = 0;
  PhotoInput? take(String scope) {
    if (_disposed || scope != accountScope) return null;
    final result = _ready;
    _ready = null;
    return result;
  }

  bool get hasReady => _ready != null;
  void consumeError() {
    failed = false;
  }

  @override
  Future<PhotoInput?> pick() async {
    if (_disposed || _inFlight) return null;
    cancel();
    final epoch = _epoch;
    pending = true;
    _inFlight = true;
    notifyListeners();
    try {
      final input = await source.pick();
      if (_disposed || epoch != _epoch) {
        input?.bytes.fillRange(0, input.bytes.length, 0);
        return null;
      }
      if (input != null) {
        if (input.bytes.isEmpty ||
            input.bytes.length > 1048576 ||
            !{'image/png', 'image/jpeg', 'image/webp'}.contains(input.mime)) {
          input.bytes.fillRange(0, input.bytes.length, 0);
          failed = true;
        } else {
          _ready = input;
        }
      }
    } catch (_) {
      if (!_disposed && epoch == _epoch) failed = true;
    } finally {
      _inFlight = false;
      if (!_disposed && epoch == _epoch) {
        pending = false;
        notifyListeners();
      }
    }
    return null;
  }

  void cancel() {
    _epoch++;
    pending = false;
    failed = false;
    _ready?.bytes.fillRange(0, _ready!.bytes.length, 0);
    _ready = null;
  }

  @override
  void dispose() {
    cancel();
    _disposed = true;
    super.dispose();
  }
}
