import 'dart:async';

import 'package:flutter/foundation.dart';

import '../features/rooms/rooms_controller.dart';
import '../features/account_deletion/account_deletion.dart';
import '../features/games/game_controller.dart';
import '../features/management/management_controller.dart';

enum FeatureRoute {
  rooms,
  profile,
  trash,
  game,
  management,
  sharing,
  history,
  deletion,
}

/// Root-owned memory for ONE verified account. Contains navigation IDs and
/// immutable uncertain commands, never room snapshots/photos. Only an explicit deletion flow may hold its original receipt credential.
class FeatureSession extends ChangeNotifier {
  FeatureSession(this.accountId, {DeletionRecovery? recoveredDeletion})
    : rooms = RoomsCreateRecovery(accountId),
      trash = ManagementRecovery(accountId),
      deletion = recoveredDeletion ?? DeletionRecovery(accountId) {
    games.bind(accountId);
  }
  final String accountId;
  final RoomsCreateRecovery rooms;
  final PendingGameCommands games = PendingGameCommands();
  final ManagementRecovery trash;
  final DeletionRecovery deletion;
  AccountDeletionRepository? deletionRepository;
  final Map<String, ManagementRecovery> _management = {};
  FeatureRoute route = FeatureRoute.rooms;
  String? roomId, runId;
  Completer<void>? _returned;
  ManagementRecovery managementFor(String id) =>
      _management.putIfAbsent(id, () => ManagementRecovery(accountId));
  Future<void> open(FeatureRoute destination, {String? roomId, String? runId}) {
    _returned?.complete();
    _returned = Completer<void>();
    route = destination;
    if (roomId != null) this.roomId = roomId;
    this.runId = runId;
    final returned = _returned!.future;
    notifyListeners();
    return returned;
  }

  void openRoom(String id) {
    roomId = id;
    home();
  }

  void home() {
    route = FeatureRoute.rooms;
    runId = null;
    _returned?.complete();
    _returned = null;
    notifyListeners();
  }

  void clearPrivate() {
    rooms.clear();
    games.clear();
    trash.clear();
    for (final value in _management.values) {
      value.clear();
    }
    _management.clear();
    roomId = null;
    runId = null;
  }

  void clear() {
    deletion.clear();
    deletionRepository?.forgetCredential();
    deletionRepository = null;
    rooms.clear();
    games.clear();
    trash.clear();
    for (final value in _management.values) {
      value.clear();
    }
    _management.clear();
    roomId = null;
    home();
  }

  @override
  void dispose() {
    deletion.clear();
    deletionRepository?.forgetCredential();
    deletionRepository = null;
    rooms.clear();
    games.clear();
    trash.clear();
    for (final value in _management.values) {
      value.clear();
    }
    _management.clear();
    _returned?.complete();
    _returned = null;
    super.dispose();
  }
}
