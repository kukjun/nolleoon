import 'dart:math';

import '../../data/api_client.dart';
import '../../data/wire_models.dart';
import '../../navigation/invite_link.dart';

final class InvitePreview {
  const InvitePreview();
  factory InvitePreview.fromJson(Object? value) {
    if (value is! Map ||
        value.length != 2 ||
        value['available'] != true ||
        value['loginRequired'] != true) {
      throw const FormatException('Invalid invite preview');
    }
    return const InvitePreview();
  }
}

final class IssuedInvitation {
  const IssuedInvitation(this.snapshot, this.link);
  final RoomDto snapshot;
  final InviteLink link;
  factory IssuedInvitation.fromJson(Object? value) {
    if (value is! Map ||
        value.length != 2 ||
        value['inviteToken'] is! String ||
        !value.containsKey('snapshot')) {
      throw const FormatException('Invalid invite');
    }
    final token = value['inviteToken'] as String;
    if (!RegExp(r'^[A-Za-z0-9_-]{20,128}$').hasMatch(token)) {
      throw const FormatException('Invalid invite');
    }
    final link = InviteLink.parse(
      'https://nolleoon.kukjun.com/travel/invite/$token',
    );
    if (link == null) throw const FormatException('Invalid invite');
    return IssuedInvitation(RoomDto.fromJson(value['snapshot']), link);
  }
  @override
  String toString() => 'IssuedInvitation(redacted)';
}

class InvitesRepository {
  InvitesRepository(this.client, {String Function()? requestId})
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

  Future<InvitePreview> preview(InviteLink link, {CancellationToken? cancel}) =>
      client.read(
        ApiOperation.previewInvite,
        InvitePreview.fromJson,
        parameters: {'token': link.token},
        cancel: cancel,
      );
  MutationIntent prepareJoin(InviteLink link) => MutationIntent(
    operation: ApiOperation.joinInvite,
    parameters: {'token': link.token},
    body: {'requestId': requestId()},
  );
  Future<RoomDto> join(MutationIntent intent, {CancellationToken? cancel}) =>
      client.mutate(intent, RoomDto.fromJson, cancel: cancel);
  MutationIntent prepareIssue(String roomId, int version) => MutationIntent(
    operation: ApiOperation.issueInvite,
    parameters: {'roomId': roomId},
    body: {'requestId': requestId(), 'expectedVersion': version},
  );
  Future<IssuedInvitation> issue(
    MutationIntent intent, {
    CancellationToken? cancel,
  }) => client.mutate(intent, IssuedInvitation.fromJson, cancel: cancel);
  MutationIntent prepareRevoke(String roomId, int version) => MutationIntent(
    operation: ApiOperation.revokeInvite,
    parameters: {'roomId': roomId},
    body: {'requestId': requestId(), 'expectedVersion': version},
  );
  Future<RoomDto> revoke(MutationIntent intent, {CancellationToken? cancel}) =>
      client.mutate(intent, RoomDto.fromJson, cancel: cancel);
}
