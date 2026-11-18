import 'package:material_ui/material_ui.dart';

import '../data/wire_models.dart';
import '../features/room_avatars/room_avatar_widgets.dart';
import '../features/games/game_controller.dart';
import '../features/games/team/team_game.dart';
import '../features/games/draw/draw_game.dart';
import '../features/games/menu/menu_game.dart';
import '../features/games/trial/trial_game.dart';

typedef GameSetupBuilder = Widget Function(
  BuildContext,
  List<String>,
  Map<String, String>,
  ValueChanged<JsonMap?>,
);
typedef GamePlayBuilder = Widget Function(
  BuildContext,
  RunDto,
  GameController,
  RoomDto,
);

class AppGameModule {
  const AppGameModule({required this.setup, required this.play});
  final GameSetupBuilder setup;
  final GamePlayBuilder play;
}

Map<String, String> gameNames(GameController c, RoomDto room) => {
  for (final m in ((c.room ?? room).data['members'] as List))
    (m as Map)['membershipId'] as String: m['nickname'] as String,
};
Widget gameAvatar(RoomDto room, String id) {
  final member = (room.data['members'] as List)
      .cast<Map>()
      .where((m) => m['membershipId'] == id)
      .firstOrNull;
  return RoomMemberAvatar(
    membershipId: id,
    presetId: member?['presetId'] as String? ?? 'preset-01',
    size: 40,
    label: '참가자 아바타',
  );
}

final appGameModules = <String, AppGameModule>{
  'team': AppGameModule(
    setup: (context, selected, names, done) =>
        TeamSetupForm(selected: selected, names: names, onComplete: done),
    play: (context, run, c, room) => TeamGameView(
      run: run,
      names: gameNames(c, room),
      avatarBuilder: (id) => gameAvatar(c.room ?? room, id),
    ),
  ),
  'draw': AppGameModule(
    setup: (context, selected, names, done) =>
        DrawSetupForm(selected: selected, names: names, onComplete: done),
    play: (context, run, c, room) => DrawGameView(
      run: run,
      controller: c,
      viewerMembershipId:
          (c.room?.data['self'] as Map?)?['membershipId'] as String?,
      names: gameNames(c, room),
      avatarBuilder: (id) => gameAvatar(c.room ?? room, id),
    ),
  ),
  'menu': AppGameModule(
    setup: (context, ids, names, done) =>
        MenuSetupForm(selected: ids, names: names, onComplete: done),
    play: (context, run, c, room) => MenuGameView(
      run: run,
      controller: c,
      viewerMembershipId:
          (c.room?.data['self'] as Map?)?['membershipId'] as String?,
    ),
  ),
  'trial': AppGameModule(
    setup: (context, ids, names, done) =>
        TrialSetupForm(selected: ids, names: names, onComplete: done),
    play: (context, run, c, room) => TrialGameView(
      run: run,
      controller: c,
      viewerMembershipId:
          ((c.room ?? room).data['self'] as Map)['membershipId'] as String,
    ),
  ),
};
