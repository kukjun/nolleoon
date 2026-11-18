import 'dart:typed_data';

import '../../data/api_client.dart';
import '../../data/avatar_client.dart';
import '../../data/wire_models.dart';

class ProfileRepository {
  ProfileRepository(this.api, this.avatars);
  final ApiClient api;
  final AvatarClient avatars;
  Future<JsonMap> load(CancellationToken cancel) async => (await api.read(
    ApiOperation.session,
    NativeSessionDto.fromJson,
    cancel: cancel,
  )).account;
  Future<JsonMap> saveName(
    JsonMap current,
    String name,
    CancellationToken cancel,
  ) async => (await api.mutate(
    MutationIntent(
      operation: ApiOperation.profile,
      body: {
        'displayName': name.trim(),
        'presetId': current['presetId'],
        'expectedRevision': current['revision'],
      },
    ),
    SessionDto.fromJson,
    cancel: cancel,
  )).account!;
  Future<void> preset(String id, int revision, CancellationToken cancel) async {
    await avatars.setPreset(id, revision, cancel: cancel);
  }

  Future<void> upload(
    Uint8List bytes,
    int revision,
    CancellationToken cancel,
  ) async {
    await avatars.upload(bytes, 'image/png', revision, cancel: cancel);
  }

  Future<Uint8List> image(String path, CancellationToken cancel) =>
      avatars.image(path, cancel: cancel);
}
