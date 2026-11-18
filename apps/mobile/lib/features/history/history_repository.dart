import '../../data/api_client.dart';
import '../../data/wire_models.dart';

/// Read-only server projections. Membership and redaction remain server-owned.
class HistoryRepository {
  HistoryRepository(this.client);
  final ApiClient client;
  Future<RunPageDto> page(
    String roomId, {
    String? cursor,
    CancellationToken? cancel,
  }) => client.read(
    ApiOperation.history,
    (value) {
      final page = RunPageDto.fromJson(value);
      if (page.items.any((item) => item.data['roomId'] != roomId)) {
        throw const FormatException('History room mismatch');
      }
      return page;
    },
    parameters: {'roomId': roomId},
    cursor: cursor,
    cancel: cancel,
  );
  Future<RunDto> detail(
    String roomId,
    String runId, {
    CancellationToken? cancel,
  }) => client.read(
    ApiOperation.run,
    (value) {
      final run = RunDto.fromJson(value);
      if (run.runId != runId || run.data['roomId'] != roomId) {
        throw const FormatException('History identity mismatch');
      }
      return run;
    },
    parameters: {'roomId': roomId, 'runId': runId},
    cancel: cancel,
  );
}
