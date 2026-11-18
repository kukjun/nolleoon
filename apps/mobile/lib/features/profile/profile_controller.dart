import 'package:flutter/foundation.dart';

import '../../data/api_client.dart';
import '../../data/wire_models.dart';
import 'profile_repository.dart';

class ProfileController extends ChangeNotifier {
  ProfileController(this.repository, {this.onSessionLost});
  final ProfileRepository repository;
  final VoidCallback? onSessionLost;
  JsonMap? account;
  Uint8List? imageBytes;
  bool busy = false, saved = false, foreground = true;
  String? error, imageError;
  bool _disposed = false;
  int _generation = 0;
  CancellationToken? _cancel;
  void _clear() {
    imageBytes?.fillRange(0, imageBytes!.length, 0);
    imageBytes = null;
    account = null;
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  bool _current(int g) => !_disposed && foreground && g == _generation;
  bool _auth(Object e) =>
      e is ApiFailure &&
      (e.kind == FailureKind.unauthenticated || [401, 403].contains(e.status));
  Future<void> _apply(JsonMap value, CancellationToken cancel, int g) async {
    if (!_current(g)) return;
    _clear();
    account = value;
    imageError = null;
    final avatar = value['avatar'] as Map<String, Object?>;
    if (avatar['kind'] == 'image') {
      try {
        final bytes = await repository.image(
          avatar['imageUrl'] as String,
          cancel,
        );
        if (_current(g)) {
          imageBytes = bytes;
        } else {
          bytes.fillRange(0, bytes.length, 0);
        }
      } catch (e) {
        if (_auth(e)) rethrow;
        if (_current(g)) imageError = '사진을 불러오지 못했어요. 기본 아이콘으로 표시해요.';
      }
    }
  }

  Future<void> _run(
    Future<void> Function(CancellationToken, int) action,
  ) async {
    if (_disposed || !foreground || busy) return;
    final g = ++_generation;
    final cancel = CancellationToken();
    _cancel = cancel;
    busy = true;
    saved = false;
    error = null;
    _notify();
    try {
      await action(cancel, g);
    } catch (e) {
      if (!_current(g)) return;
      if (_auth(e)) {
        _clear();
        error = '로그인이 만료됐어요. 다시 로그인해 주세요.';
        onSessionLost?.call();
      } else if (e is ApiFailure && e.status == 409) {
        error = '다른 곳에서 프로필이 바뀌었어요. 최신 정보를 확인하고 다시 저장해 주세요.';
        try {
          await _apply(await repository.load(cancel), cancel, g);
        } catch (next) {
          if (_auth(next)) {
            _clear();
            onSessionLost?.call();
          } else {
            _clear();
          }
        }
      } else if (e is ApiFailure && e.kind == FailureKind.cancelled) {
        return;
      } else {
        error = '완료 여부를 확인하지 못했어요. 새로고침 후 다시 확인해 주세요.';
      }
    } finally {
      if (_current(g)) {
        busy = false;
        _cancel = null;
        _notify();
      }
    }
  }

  Future<void> load() => _run(
    (cancel, g) async => _apply(await repository.load(cancel), cancel, g),
  );
  Future<void> saveName(String name) async {
    final clean = name.trim();
    if (clean.isEmpty ||
        clean.runes.length > 20 ||
        RegExp(
          r'[\x00-\x1f\x7f-\x9f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]',
        ).hasMatch(clean)) {
      saved = false;
      error = '이름은 제어 문자 없이 1~20자로 입력해 주세요.';
      _notify();
      return;
    }
    final current = account;
    if (current == null) return;
    await _run((cancel, g) async {
      await _apply(
        await repository.saveName(current, clean, cancel),
        cancel,
        g,
      );
      if (_current(g)) saved = true;
    });
  }

  Future<void> savePreset(String id) => _saveAvatar(
    (revision, cancel) => repository.preset(id, revision, cancel),
  );
  Future<void> savePhoto(Uint8List bytes) => _saveAvatar(
    (revision, cancel) => repository.upload(bytes, revision, cancel),
  );
  Future<void> _saveAvatar(
    Future<void> Function(int, CancellationToken) write,
  ) async {
    final current = account;
    if (current == null) return;
    final avatar = current['avatar'] as Map<String, Object?>;
    await _run((cancel, g) async {
      await write(avatar['revision'] as int, cancel);
      await _apply(await repository.load(cancel), cancel, g);
      if (_current(g)) saved = true;
    });
  }

  void setForeground(bool active) {
    if (_disposed || foreground == active) return;
    _generation++;
    _cancel?.cancel();
    _cancel = null;
    busy = false;
    foreground = active;
    _clear();
    saved = false;
    error = null;
    _notify();
    if (active) load();
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _generation++;
    _cancel?.cancel();
    _clear();
    super.dispose();
  }
}
