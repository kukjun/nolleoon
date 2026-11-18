import 'dart:math';

import '../../data/api_client.dart';
import '../../data/wire_models.dart';

class DeletedRoom {
  const DeletedRoom({
    required this.roomId,
    required this.title,
    required this.deletionVersion,
    required this.deletedAt,
    required this.purgeAfter,
  });
  final String roomId, title;
  final int deletionVersion, deletedAt, purgeAfter;
  static DeletedRoom decode(Object? value, {bool listed = false}) {
    if (value is! Map<String, dynamic>) {
      throw const FormatException('Invalid deleted room');
    }
    final fields = listed
        ? {
            'roomId',
            'title',
            'deletionVersion',
            'deletedAt',
            'purgeAfter',
            'previousStatus',
          }
        : {'roomId', 'deletionVersion', 'deletedAt', 'purgeAfter'};
    if (value.length != fields.length ||
        !value.keys.toSet().containsAll(fields)) {
      throw const FormatException('Invalid deleted room');
    }
    final id = value['roomId'],
        v = value['deletionVersion'],
        at = value['deletedAt'],
        until = value['purgeAfter'];
    if (id is! String ||
        !RegExp(r'^[A-Za-z0-9_-]{1,100}$').hasMatch(id) ||
        v is! int ||
        v < 1 ||
        v > 9007199254740991 ||
        at is! int ||
        at < 0 ||
        until is! int ||
        until <= at ||
        until > 8640000000000000 ||
        (listed &&
            (value['title'] is! String ||
                !['open', 'closed'].contains(value['previousStatus'])))) {
      throw const FormatException('Invalid deleted room');
    }
    return DeletedRoom(
      roomId: id,
      title: listed ? value['title'] as String : '삭제 대기 중인 방',
      deletionVersion: v,
      deletedAt: at,
      purgeAfter: until,
    );
  }
}

class ManagementRepository {
  ManagementRepository(this.client, {String Function()? requestId})
    : requestId = requestId ?? _id;
  final ApiClient client;
  final String Function() requestId;
  static String _id() {
    final r = Random.secure();
    return List.generate(
      24,
      (_) => r.nextInt(256).toRadixString(16).padLeft(2, '0'),
    ).join();
  }

  Future<RoomDto> get(String roomId, {CancellationToken? cancel}) =>
      client.read(
        ApiOperation.room,
        RoomDto.fromJson,
        parameters: {'roomId': roomId},
        cancel: cancel,
      );
  MutationIntent prepare(
    ApiOperation operation,
    RoomDto room, {
    Map<String, Object?> values = const {},
    String? memberId,
  }) {
    if (values.keys.any((k) => {'requestId', 'expectedVersion'}.contains(k))) {
      throw ArgumentError('Immutable request identity');
    }
    return MutationIntent(
      operation: operation,
      parameters: {'roomId': room.roomId, 'membershipId': ?memberId},
      body: {
        'requestId': requestId(),
        'expectedVersion': room.version,
        ...values,
      },
    );
  }

  MutationIntent restoreIntent(DeletedRoom room) => MutationIntent(
    operation: ApiOperation.restoreRoom,
    parameters: {'roomId': room.roomId},
    body: {
      'requestId': requestId(),
      'deletedAt': room.deletedAt,
      'deletionVersion': room.deletionVersion,
    },
  );
  Future<Object> execute(MutationIntent intent, {CancellationToken? cancel}) =>
      client.mutate(intent, (value) {
        if (intent.operation == ApiOperation.leaveRoom) {
          if (value is! Map || value.length != 1 || value['left'] != true) {
            throw const FormatException('Invalid leave response');
          }
          return true;
        }
        if (intent.operation == ApiOperation.deleteRoom) {
          return DeletedRoom.decode(value);
        }
        return RoomDto.fromJson(value);
      }, cancel: cancel);
  Future<List<DeletedRoom>> deleted({CancellationToken? cancel}) =>
      client.read(ApiOperation.deletedRooms, (value) {
        if (value is! Map || value.length != 1 || value['items'] is! List) {
          throw const FormatException('Invalid deleted list');
        }
        return List<DeletedRoom>.unmodifiable(
          (value['items'] as List).map(
            (v) => DeletedRoom.decode(v, listed: true),
          ),
        );
      }, cancel: cancel);
}
