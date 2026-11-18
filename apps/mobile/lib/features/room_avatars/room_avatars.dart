import 'package:flutter/foundation.dart';

import '../../data/api_client.dart';
import '../../data/avatar_client.dart';
import '../../data/wire_models.dart';

/// Metadata uses memberId, explicitly joined to room.members.membershipId.
/// No account ID or historical identity is inferred or accepted.
class RoomAvatarsDto {
  RoomAvatarsDto._(this.members);
  final Map<String, AvatarDto> members;
  factory RoomAvatarsDto.fromJson(Object? value, String roomId) {
    Never bad() => throw const FormatException('Invalid room avatars');
    if (value is! Map || value.length != 1 || value['members'] is! List) bad();
    final rows = value['members'] as List;
    if (rows.length > 100) bad();
    final result = <String, AvatarDto>{};
    for (final row in rows) {
      if (row is! Map || row.length != 2 || !row.containsKey('avatar')) bad();
      final id = row['memberId'];
      if (id is! String ||
          !RegExp(r'^[A-Za-z0-9_-]{1,100}$').hasMatch(id) ||
          result.containsKey(id)) {
        bad();
      }
      final avatar = AvatarDto.fromJson(row['avatar']);
      if (avatar.data['kind'] == 'image' &&
          avatar.data['imageUrl'] !=
              '/api/native/travel-rooms/$roomId/avatars/$id/image?v=${avatar.data['revision']}') {
        bad();
      }
      result[id] = avatar;
    }
    return RoomAvatarsDto._(Map.unmodifiable(result));
  }
}

abstract interface class RoomAvatarSource {
  Future<RoomAvatarsDto> load(String roomId, CancellationToken cancel);
  Future<Uint8List> image(String path, CancellationToken cancel);
}

class RoomAvatarsRepository implements RoomAvatarSource {
  RoomAvatarsRepository(this.api, this.avatars);
  final ApiClient api;
  final AvatarClient avatars;
  @override
  Future<RoomAvatarsDto> load(String roomId, CancellationToken cancel) =>
      api.read(
        ApiOperation.roomAvatars,
        (v) => RoomAvatarsDto.fromJson(v, roomId),
        parameters: {'roomId': roomId},
        cancel: cancel,
      );
  @override
  Future<Uint8List> image(String path, CancellationToken cancel) =>
      avatars.image(path, cancel: cancel);
}

/// Visible consumers retain a member. At most 16 private images (each <=64KiB)
/// and two requests; this is not an OS/decoder/process RSS guarantee (#116).
class RoomAvatarsController extends ChangeNotifier {
  RoomAvatarsController(
    this.source, {
    required this.roomId,
    this.onSessionLost,
  });
  final RoomAvatarSource source;
  final String roomId;
  final VoidCallback? onSessionLost;
  Map<String, AvatarDto> _metadata = {};
  final _bytes = <String, Uint8List>{}, _watch = <String, int>{};
  final _loading = <String, CancellationToken>{},
      _attempted = <String, String>{};
  CancellationToken? _metadataRequest;
  int _generation = 0, _refresh = 0, _inflight = 0;
  bool _active = true, _terminal = false, _disposed = false;
  bool get active => _active && !_terminal && !_disposed;
  Uint8List? bytes(String member) => active ? _bytes[member] : null;
  AvatarDto? avatar(String member) => active ? _metadata[member] : null;
  String _signature(AvatarDto a) =>
      '${a.data['kind']}|${a.data['revision']}|${a.data['presetId']}|${a.data['imageUrl']}';
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void retain(String member) {
    if (_disposed || (_watch.length >= 100 && !_watch.containsKey(member))) {
      return;
    }
    _watch[member] = (_watch[member] ?? 0) + 1;
    Future.microtask(_pump);
  }

  void release(String member) {
    final count = _watch[member];
    if (count == null) return;
    if (count > 1) {
      _watch[member] = count - 1;
      return;
    }
    _watch.remove(member);
    _drop(member);
    Future.microtask(_pump);
  }

  void _drop(String member) {
    _loading.remove(member)?.cancel();
    final data = _bytes.remove(member);
    data?.fillRange(0, data.length, 0);
    _attempted.remove(member);
  }

  void _clear() {
    _generation++;
    _refresh++;
    _metadataRequest?.cancel();
    _metadataRequest = null;
    for (final c in _loading.values) {
      c.cancel();
    }
    _loading.clear();
    for (final b in _bytes.values) {
      b.fillRange(0, b.length, 0);
    }
    _bytes.clear();
    _metadata = {};
    _attempted.clear();
  }

  bool _denied(Object e) =>
      e is ApiFailure &&
      ([401, 403, 404, 410].contains(e.status) ||
          e.kind == FailureKind.unauthenticated);
  void _deny(Object e) {
    _terminal = true;
    _clear();
    _notify();
    if (e is ApiFailure &&
        (e.status == 401 || e.kind == FailureKind.unauthenticated)) {
      onSessionLost?.call();
    }
  }

  Future<void> setActive(bool value) async {
    if (_disposed) return;
    if (!value) {
      _active = false;
      _clear();
      _notify();
      return;
    }
    if (_active) return;
    _active = true;
    _terminal = false;
    await refresh();
  }

  Future<void> refresh({bool retryImages = false}) async {
    if (!active) return;
    _metadataRequest?.cancel();
    final cancel = CancellationToken(),
        ticket = ++_refresh,
        generation = _generation;
    _metadataRequest = cancel;
    try {
      final loaded = await source.load(roomId, cancel);
      if (!active || ticket != _refresh || generation != _generation) return;
      for (final id in _metadata.keys.toList()) {
        final next = loaded.members[id];
        if (next == null || _signature(next) != _signature(_metadata[id]!)) {
          _drop(id);
        }
      }
      _metadata = loaded.members;
      if (retryImages) {
        for (final id in _attempted.keys.toList()) {
          if (!_bytes.containsKey(id) && !_loading.containsKey(id)) {
            _attempted.remove(id);
          }
        }
      }
      _notify();
      _pump();
    } catch (e) {
      if (active && ticket == _refresh && generation == _generation) {
        if (_denied(e)) {
          _deny(e);
        } else {
          // No stale private picture survives an invalid or unavailable metadata
          // refresh. A later foreground poll may safely re-establish authority.
          _clear();
          _notify();
        }
      }
    } finally {
      if (identical(_metadataRequest, cancel)) _metadataRequest = null;
    }
  }

  void _pump() {
    if (!active) return;
    for (final id in _watch.keys.toList()) {
      if (_inflight >= 2 || _bytes.length + _loading.length >= 16) return;
      final a = _metadata[id];
      if (a == null ||
          a.data['kind'] != 'image' ||
          _bytes.containsKey(id) ||
          _loading.containsKey(id) ||
          _attempted[id] == _signature(a)) {
        continue;
      }
      final cancel = CancellationToken(),
          generation = _generation,
          signature = _signature(a);
      _loading[id] = cancel;
      _attempted[id] = signature;
      _inflight++;
      Future<void>.microtask(() async {
        Uint8List? data;
        try {
          data = await source.image(a.data['imageUrl'] as String, cancel);
          if (!active ||
              generation != _generation ||
              !_watch.containsKey(id) ||
              !identical(_loading[id], cancel) ||
              _metadata[id] == null ||
              _signature(_metadata[id]!) != signature) {
            return;
          }
          if (data.isEmpty || data.length > 65536) {
            throw const FormatException('Invalid avatar bytes');
          }
          // Own an independent mutable buffer for reliable explicit disposal.
          _bytes[id] = Uint8List.fromList(data);
          _notify();
        } catch (e) {
          if (active &&
              generation == _generation &&
              identical(_loading[id], cancel) &&
              _denied(e)) {
            _deny(e);
          }
        } finally {
          data?.fillRange(0, data.length, 0);
          _inflight--;
          if (identical(_loading[id], cancel)) _loading.remove(id);
          _pump();
        }
      });
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _clear();
    _watch.clear();
    super.dispose();
  }
}
