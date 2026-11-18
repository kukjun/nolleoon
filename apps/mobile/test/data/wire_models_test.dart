import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/wire_models.dart';

Map<String, dynamic> fixtures() => jsonDecode(
  File('../../contracts/flutter/wire-fixtures.json').readAsStringSync(),
) as Map<String, dynamic>;
void main() {
  test('current JSON session room and all run fixtures decode', () {
    final responses = fixtures()['responses'] as Map<String, dynamic>;
    expect(SessionDto.fromJson(responses['signedOut']).authenticated, isFalse);
    expect(SessionDto.fromJson(responses['signedIn']).authenticated, isTrue);
    expect(RoomDto.fromJson(responses['room']).roomId, 'room-example');
    for (final row in responses['runs'] as List) {
      expect(
        RunDto.fromJson(row['value']).runId,
        'run-example',
        reason: row['name'],
      );
    }
  });
  test('wrong enum types and identity-bearing redactions fail closed', () {
    final rows = fixtures()['responses']['runs'] as List;
    final run = Map<String, dynamic>.from(rows.first['value']);
    expect(
      () => RunDto.fromJson({
        ...run,
        'status': ['draft'],
      }),
      throwsFormatException,
    );
    expect(
      () => RunDto.fromJson({...run, 'version': '0'}),
      throwsFormatException,
    );
    final redacted = Map<String, dynamic>.from(
      rows.firstWhere((r) => r['name'] == 'trial-redacted')['value'],
    );
    expect(
      () => RunDto.fromJson({
        ...redacted,
        'game': {...redacted['game'], 'nickname': 'hidden'},
      }),
      throwsFormatException,
    );
  });

  test(
    'public invite has no private extras and nested DTO data is immutable',
    () {
      expect(
        () => InvitePreviewDto.fromJson({
          'available': true,
          'loginRequired': true,
          'title': 'private',
        }),
        throwsFormatException,
      );
      final response = fixtures()['responses'];
      expect(RoomPageDto.fromJson(response['roomList']).items.length, 1);
      expect(RunPageDto.fromJson(response['history']).items.length, 1);
      final room = RoomDto.fromJson(response['room']);
      expect(() => room.data['title'] = 'changed', throwsUnsupportedError);
      expect(
        () => (room.data['members'] as List).clear(),
        throwsUnsupportedError,
      );
      expect(
        () => NativeSessionDto.fromJson({
          ...response['signedIn'],
          'expiresAt': '123',
        }),
        throwsFormatException,
      );
      expect(
        NativeSessionDto.fromJson({
          ...response['signedIn'],
          'expiresAt': 1800000000000,
        }).expiresAt,
        1800000000000,
      );
    },
  );
}
