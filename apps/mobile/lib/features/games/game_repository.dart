import 'dart:math';

import '../../data/api_client.dart';
import '../../data/wire_models.dart';

class GameRepository {
  GameRepository(this.client, {String Function()? requestId})
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

  Future<RunDto> get(
    String roomId,
    String runId, {
    CancellationToken? cancel,
  }) => client.read(
    ApiOperation.run,
    RunDto.fromJson,
    parameters: {'roomId': roomId, 'runId': runId},
    cancel: cancel,
  );
  Future<RoomDto> room(String roomId, {CancellationToken? cancel}) =>
      client.read(
        ApiOperation.room,
        RoomDto.fromJson,
        parameters: {'roomId': roomId},
        cancel: cancel,
      );
  MutationIntent create(
    String roomId,
    int roomVersion,
    String type,
    List<String> selected,
    JsonMap settings,
  ) => MutationIntent(
    operation: ApiOperation.createRun,
    parameters: {'roomId': roomId},
    body: {
      'requestId': requestId(),
      'expectedVersion': roomVersion,
      'type': type,
      'selectedMembershipIds': selected,
      'settings': settings,
    },
  );
  MutationIntent command(
    ApiOperation operation,
    String roomId,
    String runId,
    int runVersion, {
    List<String>? selected,
    JsonMap? settings,
    JsonMap? command,
  }) {
    if (![
      ApiOperation.editRun,
      ApiOperation.startRun,
      ApiOperation.cancelRun,
      ApiOperation.runAction,
    ].contains(operation)) {
      throw ArgumentError('Game command required');
    }
    return MutationIntent(
      operation: operation,
      parameters: {'roomId': roomId, 'runId': runId},
      body: {
        'requestId': requestId(),
        'expectedVersion': runVersion,
        if (operation == ApiOperation.editRun) ...{
          'selectedMembershipIds': selected,
          'settings': settings,
        },
        if (operation == ApiOperation.runAction) 'command': command,
      },
    );
  }

  Future<RunDto> send(MutationIntent intent, {CancellationToken? cancel}) =>
      client.mutate(intent, RunDto.fromJson, cancel: cancel);
}
