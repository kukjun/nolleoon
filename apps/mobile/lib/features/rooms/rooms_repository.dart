import 'dart:math';

import '../../data/api_client.dart';
import '../../data/wire_models.dart';

/// Uses the existing account's rooms. Never clones a web room or stores identity.
class RoomsRepository {
  RoomsRepository(this.client, {String Function()? requestId})
    : requestId = requestId ?? _newId;
  final ApiClient client;
  final String Function() requestId;
  static String _newId() {
    final random = Random.secure();
    return List.generate(
      24,
      (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0'),
    ).join();
  }

  Future<RoomPageDto> list({String? cursor, CancellationToken? cancel}) =>
      client.read(
        ApiOperation.rooms,
        RoomPageDto.fromJson,
        cursor: cursor,
        cancel: cancel,
      );
  Future<RoomDto> get(String id, {CancellationToken? cancel}) => client.read(
    ApiOperation.room,
    RoomDto.fromJson,
    parameters: {'roomId': id},
    cancel: cancel,
  );
  MutationIntent prepareCreate(
    String title,
    String? startDate,
    String? endDate,
  ) => MutationIntent(
    operation: ApiOperation.createRoom,
    body: {
      'requestId': requestId(),
      'title': title.trim(),
      'startDate': startDate,
      'endDate': endDate,
    },
  );
  Future<RoomDto> create(MutationIntent intent, {CancellationToken? cancel}) =>
      client.mutate(intent, RoomDto.fromJson, cancel: cancel);
}
