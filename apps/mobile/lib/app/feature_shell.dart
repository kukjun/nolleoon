import '../features/profile/photo_source.dart';
import '../features/room_avatars/room_avatar_widgets.dart';
import '../features/room_avatars/room_avatars.dart';

import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';

import '../data/api_client.dart';
import '../data/avatar_client.dart';
import '../data/wire_models.dart';
import '../features/rooms/rooms_repository.dart';
import '../features/rooms/rooms_screen.dart';
import '../features/profile/profile_repository.dart';
import '../features/profile/profile_screen.dart';
import '../features/games/game_repository.dart';
import '../features/games/game_screen.dart';
import '../features/games/trial/trial_game.dart';
import '../features/management/management_repository.dart';
import '../features/management/management_screen.dart';
import '../features/management/deleted_rooms_screen.dart';
import '../features/history/history_repository.dart';
import '../features/history/history_screen.dart';
import '../features/invites/invite_sharing.dart';
import '../features/invites/invites_repository.dart';
import 'feature_session.dart';
import 'game_registry.dart';

class UnavailableAvatarTransport implements AvatarBinaryTransport {
  const UnavailableAvatarTransport();
  @override
  Future<AvatarBinaryResponse> sendAvatar(
    AvatarBinaryRequest request,
    CancellationToken cancel,
  ) async => throw const ApiFailure(FailureKind.network);
}

/// Nested navigator belongs to protected auth subtree, never the public root.
/// Repositories remain stable for this mounted verified-account lifetime.
class FeatureShell extends StatefulWidget {
  const FeatureShell({
    super.key,
    required this.session,
    required this.api,
    required this.avatars,
    required this.onSessionLost,
    required this.onDeleteAccount,
    this.photoSource,
  });
  final FeatureSession session;
  final ApiClient api;
  final AvatarClient avatars;
  final VoidCallback onSessionLost;
  final ProfilePhotoSource? photoSource;
  final VoidCallback onDeleteAccount;
  @override
  State<FeatureShell> createState() => _FeatureShellState();
}

class _FeatureShellState extends State<FeatureShell> {
  late final rooms = RoomsRepository(widget.api);
  late final management = ManagementRepository(widget.api);
  late final profile = ProfileRepository(widget.api, widget.avatars);
  late final games = GameRepository(widget.api);
  late final roomAvatars = RoomAvatarsRepository(widget.api, widget.avatars);
  late final history = HistoryRepository(widget.api);
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.session,
    builder: (context, _) {
      final s = widget.session;
      Widget child() => switch (s.route) {
        FeatureRoute.profile => ProfileScreen(
          accountScope: s.accountId,
          repository: profile,
          photoSource: widget.photoSource,
          onSessionLost: widget.onSessionLost,
        ),
        FeatureRoute.trash => DeletedRoomsScreen(
          repository: management,
          accountId: s.accountId,
          recovery: s.trash,
          onSessionLost: widget.onSessionLost,
        ),
        FeatureRoute.management => ManagementScreen(
          repository: management,
          roomId: s.roomId!,
          accountId: s.accountId,
          recovery: s.managementFor(s.roomId!),
          onSessionLost: widget.onSessionLost,
        ),
        FeatureRoute.history => HistoryScreen(
          repository: history,
          roomId: s.roomId!,
          accountScope: s.accountId,
          onSessionLost: widget.onSessionLost,
        ),
        FeatureRoute.game || FeatureRoute.sharing => _RoomFeature(
          key: ValueKey('${s.route}:${s.roomId}:${s.runId}'),
          session: s,
          rooms: rooms,
          games: games,
          roomAvatars: roomAvatars,
          api: widget.api,
          onSessionLost: widget.onSessionLost,
        ),
        FeatureRoute.rooms || FeatureRoute.deletion => const SizedBox.shrink(),
      };
      return Navigator(
        onDidRemovePage: (page) {
          if (s.route != FeatureRoute.rooms) s.home();
        },
        pages: [
          MaterialPage(
            key: const ValueKey('feature-home'),
            child: s.route != FeatureRoute.rooms
                ? const SizedBox.shrink()
                : Column(
                    children: [
                      SafeArea(
                        bottom: false,
                        child: Wrap(
                          spacing: 8,
                          children: [
                            TextButton(
                              onPressed: () => s.open(FeatureRoute.profile),
                              child: const Text('내 프로필'),
                            ),
                            TextButton(
                              onPressed: () => s.open(FeatureRoute.trash),
                              child: const Text('방 휴지통'),
                            ),
                            TextButton(
                              onPressed: widget.onDeleteAccount,
                              child: const Text('계정 탈퇴'),
                            ),
                          ],
                        ),
                      ),
                      Expanded(
                        child: RoomsScreen(
                          repository: rooms,
                          accountId: s.accountId,
                          initialRoomId: s.roomId,
                          createRecovery: s.rooms,
                          onSessionLost: widget.onSessionLost,
                          onOpenRun: (room, run) => s.open(
                            FeatureRoute.game,
                            roomId: room,
                            runId: run,
                          ),
                          roomScopeBuilder: (room, child) => RoomAvatarsScope(
                            accountScope: s.accountId,
                            roomId: room.roomId,
                            closed: room.data['status'] == 'closed',
                            repository: roomAvatars,
                            onSessionLost: widget.onSessionLost,
                            child: child,
                          ),
                          roomActionsBuilder: (room) => Wrap(
                            spacing: 8,
                            children: [
                              FilledButton(
                                onPressed:
                                    room.data['status'] == 'open' &&
                                        room.data['activeRun'] == null
                                    ? () => s.open(
                                        FeatureRoute.game,
                                        roomId: room.roomId,
                                      )
                                    : null,
                                child: const Text('새 게임'),
                              ),
                              TextButton(
                                onPressed: () => s.open(
                                  FeatureRoute.management,
                                  roomId: room.roomId,
                                ),
                                child: const Text('방 관리'),
                              ),
                              TextButton(
                                onPressed: () => s.open(
                                  FeatureRoute.sharing,
                                  roomId: room.roomId,
                                ),
                                child: const Text('초대 관리'),
                              ),
                              TextButton(
                                onPressed: () => s.open(
                                  FeatureRoute.history,
                                  roomId: room.roomId,
                                ),
                                child: const Text('게임 기록'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
          ),
          if (s.route != FeatureRoute.rooms)
            MaterialPage(
              key: ValueKey('${s.route}:${s.roomId}:${s.runId}'),
              child: child(),
            ),
        ],
      );
    },
  );
}

class _RoomFeature extends StatefulWidget {
  const _RoomFeature({
    super.key,
    required this.session,
    required this.rooms,
    required this.games,
    required this.roomAvatars,
    required this.api,
    required this.onSessionLost,
  });
  final FeatureSession session;
  final RoomsRepository rooms;
  final GameRepository games;
  final RoomAvatarsRepository roomAvatars;
  final ApiClient api;
  final VoidCallback onSessionLost;
  @override
  State<_RoomFeature> createState() => _RoomFeatureState();
}

class _RoomFeatureState extends State<_RoomFeature> {
  final cancel = CancellationToken();
  RoomDto? room;
  InviteSharingController? sharing;
  String? error;
  bool copied = false;
  int _loadEpoch = 0;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    final epoch = ++_loadEpoch;
    sharing?.dispose();
    sharing = null;
    if (mounted) {
      setState(() {
        room = null;
        error = null;
        copied = false;
      });
    }
    try {
      final value = await widget.rooms.get(
        widget.session.roomId!,
        cancel: cancel,
      );
      if (!mounted || cancel.isCancelled || epoch != _loadEpoch) return;
      setState(() {
        room = value;
        if (widget.session.route == FeatureRoute.sharing) {
          sharing = InviteSharingController(
            InvitesRepository(widget.api),
            value,
          );
        }
      });
    } catch (e) {
      if (!mounted || cancel.isCancelled || epoch != _loadEpoch) return;
      setState(() => error = '이 방에 접근할 수 없거나 연결이 끊겼어요.');
      if (e is ApiFailure &&
          (e.status == 401 || e.kind == FailureKind.unauthenticated)) {
        widget.onSessionLost();
      }
    }
  }

  @override
  void dispose() {
    cancel.cancel();
    sharing?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final r = room;
    if (r == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('여행방 확인')),
        body: Center(
          child: error == null
              ? const CircularProgressIndicator()
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(error!),
                    TextButton(onPressed: load, child: const Text('다시 확인')),
                  ],
                ),
        ),
      );
    }
    if (widget.session.route == FeatureRoute.game) {
      return RoomAvatarsScope(
        accountScope: widget.session.accountId,
        roomId: r.roomId,
        closed: r.data['status'] == 'closed',
        repository: widget.roomAvatars,
        onSessionLost: widget.onSessionLost,
        child: GameScreen(
          repository: widget.games,
          roomId: r.roomId,
          runId: widget.session.runId,
          viewerMembershipId: (r.data['self'] as Map)['membershipId'] as String,
          accountScope: widget.session.accountId,
          pendingCommands: widget.session.games,
          onSessionLost: widget.onSessionLost,
          onRunAvailable: (id) => widget.session.runId = id,
          supportedKinds: appGameModules.keys.toSet(),
          restrictedControls: (context, run, c) => TrialRestrictedControls(
            run: run,
            controller: c,
            viewerMembershipId:
                (r.data['self'] as Map)['membershipId'] as String,
          ),
          editConfigure: (context, run, done) {
            final data = run.game!.data;
            if (run.data['type'] != 'trial') {
              return appGameModules[run.data['type']]!.setup(
                context,
                (run.data['selectedMembershipIds'] as List).cast<String>(),
                {
                  for (final m in r.data['members'] as List)
                    (m as Map)['membershipId'] as String:
                        m['nickname'] as String,
                },
                done,
              );
            }
            return TrialSetupForm(
              selected: (run.data['selectedMembershipIds'] as List)
                  .cast<String>(),
              names: {
                for (final m in r.data['members'] as List)
                  (m as Map)['membershipId'] as String: m['nickname'] as String,
              },
              initialSettings: {
                'caseText': data['caseText'],
                'penaltyText': data['penaltyText'],
                'defendantMembershipId': data['defendantMembershipId'],
                'durationMinutes': (data['durationSeconds'] as int) ~/ 60,
              },
              onComplete: done,
            );
          },
          configure: (context, kind, ids, done) =>
              appGameModules[kind]!.setup(context, ids, {
                for (final m in r.data['members'] as List)
                  (m as Map)['membershipId'] as String: m['nickname'] as String,
              }, done),
          play: (context, run, c) =>
              appGameModules[run.data['type']]?.play(context, run, c, r) ??
              const Text('이 게임의 앱 화면은 아직 연결 대기 중이에요. 여기서는 시작하거나 투표하지 않아요.'),
        ),
      );
    }
    final controller = sharing!;
    return Scaffold(
      appBar: AppBar(title: const Text('초대 관리')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          InviteSharingPanel(controller: controller, onRefresh: load),
          ListenableBuilder(
            listenable: controller,
            builder: (context, _) => controller.link == null
                ? const SizedBox.shrink()
                : Column(
                    children: [
                      SelectableText(controller.link!.uri.toString()),
                      TextButton(
                        onPressed: controller.busy
                            ? null
                            : () async {
                                final link = controller.link;
                                if (link == null) return;
                                await Clipboard.setData(
                                  ClipboardData(text: link.uri.toString()),
                                );
                                if (mounted) setState(() => copied = true);
                              },
                        child: const Text('초대 링크 복사'),
                      ),
                      if (copied) const Text('복사했어요. 원하는 대화에 직접 붙여넣어 주세요.'),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}
