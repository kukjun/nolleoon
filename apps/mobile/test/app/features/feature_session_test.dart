import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/app/feature_session.dart';
import 'package:nolleoon_mobile/data/api_client.dart';

void main() {
  test(
    'account owner retains pending game and management only until clear',
    () {
      final s = FeatureSession('a');
      s.games.save(
        'a',
        MutationIntent(
          operation: ApiOperation.createRun,
          parameters: {'roomId': 'r'},
          body: {'requestId': 'same', 'expectedVersion': 0},
        ),
      );
      s.managementFor('r').pending = MutationIntent(
        operation: ApiOperation.roomStatus,
        parameters: {'roomId': 'r'},
        body: {'requestId': 'manage', 'expectedVersion': 0},
      );
      s.open(FeatureRoute.game, roomId: 'r');
      expect(s.games.read('a', 'r', null), isNotNull);
      expect(s.managementFor('other').pending, isNull);
      s.clear();
      expect(s.games.read('a', 'r', null), isNull);
      expect(s.route, FeatureRoute.rooms);
      expect(s.managementFor('r').pending, isNull);
    },
  );
}
