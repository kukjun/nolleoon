/// Strict DTOs for the pinned synthetic wire fixtures. No credentials are stored.
library;

typedef JsonMap = Map<String, Object?>;
Never _bad() => throw const FormatException('Invalid API response');
JsonMap _map(Object? x) {
  if (x is! Map || x.keys.any((key) => key is! String)) _bad();
  return Map<String, Object?>.from(x);
}

void _keys(
  JsonMap m,
  List<String> required, [
  List<String> optional = const [],
]) {
  if (required.any((k) => !m.containsKey(k)) ||
      m.keys.any((k) => !required.contains(k) && !optional.contains(k))) {
    _bad();
  }
}

String _text(Object? x) => x is String ? x : _bad();
String _id(Object? x) {
  final s = _text(x);
  return RegExp(r'^[A-Za-z0-9_-]+$').hasMatch(s) ? s : _bad();
}

int _int(Object? x) => x is int && x >= 0 && x <= 9007199254740991 ? x : _bad();
bool _bool(Object? x) => x is bool ? x : _bad();
String _enum(Object? x, List<String> values) =>
    x is String && values.contains(x) ? x : _bad();
List<Object?> _list(Object? x) => x is List ? List<Object?>.from(x) : _bad();
void _nullableInt(Object? x) {
  if (x != null) _int(x);
}

void _date(Object? x) {
  if (x == null) return;
  final text = _text(x);
  if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(text)) _bad();
  final date = DateTime.tryParse(text);
  if (date == null || date.toIso8601String().substring(0, 10) != text) _bad();
}

Object? _freeze(Object? x) => x is Map
    ? Map<String, Object?>.unmodifiable(
        x.map((k, v) => MapEntry(k as String, _freeze(v))),
      )
    : x is List
    ? List<Object?>.unmodifiable(x.map(_freeze))
    : x;
JsonMap _frozen(JsonMap m) => _freeze(m) as JsonMap;
const gameKinds = ['team', 'draw', 'trial', 'menu'];
const runStates = ['draft', 'active', 'completed', 'incomplete', 'interrupted'];
const trialPhases = [
  'preparing',
  'defense',
  'voting',
  'first-result',
  'final-defense',
  'completed',
  'interrupted',
];
const choices = ['guilty', 'not-guilty', 'abstain'];
void _preset(Object? value) {
  if (!RegExp(r'^preset-(0[1-9]|10)$').hasMatch(_text(value))) _bad();
}

final class SessionDto {
  final bool authenticated;
  final JsonMap? account;
  SessionDto._(this.authenticated, this.account);
  factory SessionDto.fromJson(Object? value) {
    final m = _map(value);
    final authenticated = _bool(m['authenticated']);
    _keys(m, authenticated ? ['authenticated', 'account'] : ['authenticated']);
    if (!authenticated) return SessionDto._(false, null);
    final a = _map(m['account']);
    _keys(a, ['id', 'displayName', 'presetId', 'revision', 'avatar']);
    _id(a['id']);
    _text(a['displayName']);
    _preset(a['presetId']);
    _int(a['revision']);
    AvatarDto.fromJson(a['avatar']);
    return SessionDto._(true, _frozen(a));
  }
}

final class AvatarDto {
  final JsonMap data;
  AvatarDto._(this.data);
  factory AvatarDto.fromJson(Object? value) {
    final m = _map(value);
    _keys(m, ['kind', 'presetId', 'revision', 'imageUrl']);
    _int(m['revision']);
    if (_enum(m['kind'], ['preset', 'image']) == 'preset') {
      _preset(m['presetId']);
      if (m['imageUrl'] != null) _bad();
    } else {
      if (m['presetId'] != null) _bad();
      final path = _text(m['imageUrl']);
      final uri = Uri.tryParse(path);
      if (uri == null ||
          uri.hasScheme ||
          uri.hasAuthority ||
          !RegExp(
            r'^/api/(native/)?(account/avatar/image|travel-rooms/[A-Za-z0-9_-]+/avatars/[A-Za-z0-9_-]+/image)(\?v=[0-9]+)?$',
          ).hasMatch(path) ||
          path.startsWith('//') ||
          path.contains('..') ||
          uri.hasFragment) {
        _bad();
      }
    }
    return AvatarDto._(_frozen(m));
  }
}

final class RoomDto {
  final JsonMap data;
  RoomDto._(this.data);
  String get roomId => data['roomId'] as String;
  int get version => data['version'] as int;
  factory RoomDto.fromJson(Object? value) {
    final m = _map(value);
    _keys(m, [
      'roomId',
      'title',
      'startDate',
      'endDate',
      'status',
      'version',
      'self',
      'members',
      'activeRun',
    ]);
    _roomFields(m);
    final self = _map(m['self']);
    _keys(self, ['membershipId', 'isAdmin']);
    _id(self['membershipId']);
    _bool(self['isAdmin']);
    for (final v in _list(m['members'])) {
      final p = _map(v);
      _keys(p, [
        'membershipId',
        'nickname',
        'presetId',
        'connected',
        'isAdmin',
      ]);
      _id(p['membershipId']);
      _text(p['nickname']);
      _preset(p['presetId']);
      _bool(p['connected']);
      _bool(p['isAdmin']);
    }
    if (m['activeRun'] != null) {
      final r = _map(m['activeRun']);
      _keys(r, ['runId', 'type', 'status', 'facilitatorMembershipId']);
      _id(r['runId']);
      _enum(r['type'], gameKinds);
      _enum(r['status'], ['draft', 'active']);
      _id(r['facilitatorMembershipId']);
    }
    return RoomDto._(_frozen(m));
  }
}

void _roomFields(JsonMap m) {
  _id(m['roomId']);
  _text(m['title']);
  _date(m['startDate']);
  _date(m['endDate']);
  _enum(m['status'], ['open', 'closed']);
  _int(m['version']);
}

final class RoomPageDto {
  final List<JsonMap> items;
  final String? nextCursor;
  RoomPageDto._(this.items, this.nextCursor);
  factory RoomPageDto.fromJson(Object? value) {
    final m = _map(value);
    _keys(m, ['items', 'nextCursor']);
    final items = <JsonMap>[];
    for (final x in _list(m['items'])) {
      final r = _map(x);
      _keys(r, [
        'roomId',
        'title',
        'startDate',
        'endDate',
        'status',
        'version',
        'isAdmin',
        'memberCount',
      ]);
      _roomFields(r);
      _bool(r['isAdmin']);
      _int(r['memberCount']);
      items.add(_frozen(r));
    }
    return RoomPageDto._(
      List.unmodifiable(items),
      m['nextCursor'] == null ? null : _text(m['nextCursor']),
    );
  }
}

final class InvitePreviewDto {
  const InvitePreviewDto();
  factory InvitePreviewDto.fromJson(Object? value) {
    final m = _map(value);
    _keys(m, ['available', 'loginRequired']);
    if (m['available'] != true || m['loginRequired'] != true) _bad();
    return const InvitePreviewDto();
  }
}

final class RunDto {
  final JsonMap data;
  final GameDto? game;
  RunDto._(this.data, this.game);
  String get runId => data['runId'] as String;
  int get version => data['version'] as int;
  factory RunDto.fromJson(Object? value) {
    final m = _map(value);
    _keys(m, [
      'runId',
      'roomId',
      'type',
      'status',
      'version',
      'facilitatorMembershipId',
      'selectedMembershipIds',
      'createdAt',
      'startedAt',
      'endedAt',
      'isParticipant',
      'game',
    ]);
    _id(m['runId']);
    _id(m['roomId']);
    final type = _enum(m['type'], gameKinds),
        status = _enum(m['status'], runStates);
    _int(m['version']);
    _int(m['createdAt']);
    _nullableInt(m['startedAt']);
    _nullableInt(m['endedAt']);
    _bool(m['isParticipant']);
    final selected = _list(m['selectedMembershipIds']);
    for (final id in selected) {
      _id(id);
    }
    if (selected.toSet().length != selected.length) _bad();
    final game = m['game'] == null ? null : GameDto.fromJson(m['game']);
    if (game != null && game.kind != type) _bad();
    if (game?.redacted ?? false) {
      if (m['facilitatorMembershipId'] != null ||
          selected.isNotEmpty ||
          ['draft', 'active'].contains(status)) {
        _bad();
      }
    } else {
      _id(m['facilitatorMembershipId']);
    }
    return RunDto._(_frozen(m), game);
  }
}

final class RunPageDto {
  final List<RunDto> items;
  final String? nextCursor;
  RunPageDto._(this.items, this.nextCursor);
  factory RunPageDto.fromJson(Object? value) {
    final m = _map(value);
    _keys(m, ['items', 'nextCursor']);
    return RunPageDto._(
      List.unmodifiable(_list(m['items']).map(RunDto.fromJson)),
      m['nextCursor'] == null ? null : _text(m['nextCursor']),
    );
  }
}

final class GameDto {
  final JsonMap data;
  GameDto._(this.data);
  String get kind => data['kind'] as String;
  bool get redacted => data['redacted'] == true;
  bool get restricted => data['restricted'] == true;
  factory GameDto.fromJson(Object? value) {
    final m = _map(value);
    final kind = _enum(m['kind'], gameKinds);
    if (m.containsKey('redacted')) {
      if (m['redacted'] != true) _bad();
      _redacted(m);
    } else {
      switch (kind) {
        case 'team':
          _team(m);
        case 'draw':
          _draw(m);
        case 'menu':
          _menu(m);
        case 'trial':
          _trial(m);
      }
    }
    return GameDto._(_frozen(m));
  }
}

void _team(JsonMap m) {
  _keys(m, ['kind', 'teamCount', 'assignments']);
  _int(m['teamCount']);
  for (final x in _list(m['assignments'])) {
    final a = _map(x);
    _keys(a, ['membershipId', 'team']);
    _id(a['membershipId']);
    _int(a['team']);
  }
}

void _draw(JsonMap m) {
  _keys(m, [
    'kind',
    'winnerCount',
    'penaltyText',
    'revealed',
    'self',
    'blockedPolicy',
  ]);
  _int(m['winnerCount']);
  _text(m['penaltyText']);
  for (final x in _list(m['revealed'])) {
    final r = _map(x);
    _keys(r, ['membershipId', 'winner']);
    _id(r['membershipId']);
    _bool(r['winner']);
  }
  final s = _map(m['self']);
  _keys(s, ['participating', 'revealed', 'canReveal']);
  for (final v in s.values) {
    _bool(v);
  }
  if (m['blockedPolicy'] != null) {
    _enum(m['blockedPolicy'], ['departure-policy-unresolved']);
  }
}

void _menu(JsonMap m) {
  _keys(m, ['kind', 'phase', 'self', 'result']);
  _enum(m['phase'], ['draft', 'collecting', 'completed', 'incomplete']);
  final s = _map(m['self']);
  _keys(s, ['eligible', 'submission']);
  _bool(s['eligible']);
  if (s['submission'] != null) {
    final sub = _map(s['submission']);
    final kind = _enum(sub['kind'], ['candidate', 'pass']);
    _keys(sub, kind == 'pass' ? ['kind'] : ['kind', 'menu']);
    if (kind == 'candidate') _text(sub['menu']);
  }
  if (m['result'] != null) {
    final r = _map(m['result']);
    final outcome = _enum(r['outcome'], ['selected', 'no-choice']);
    _keys(r, outcome == 'selected' ? ['outcome', 'menu'] : ['outcome']);
    if (outcome == 'selected') _text(r['menu']);
  }
}

void _roundNumber(Object? x) {
  if (x is! int || (x != 1 && x != 2)) _bad();
}

void _trial(JsonMap m) {
  final restricted = _bool(m['restricted']);
  if (restricted) {
    _keys(m, ['kind', 'restricted', 'phase']);
    if (m['phase'] != null) _enum(m['phase'], trialPhases);
    return;
  }
  if (m['phase'] == 'interrupted') {
    _keys(m, ['kind', 'restricted', 'phase']);
    return;
  }
  _keys(m, [
    'kind',
    'restricted',
    'phase',
    'caseText',
    'penaltyText',
    'durationSeconds',
    'defendantMembershipId',
    'consent',
    'roundNumber',
    'deadline',
    'submittedCount',
    'self',
    'defenses',
    'rounds',
    'outcome',
  ]);
  _enum(m['phase'], trialPhases);
  _text(m['caseText']);
  _text(m['penaltyText']);
  _int(m['durationSeconds']);
  _id(m['defendantMembershipId']);
  _enum(m['consent'], ['pending', 'accepted', 'rejected']);
  _roundNumber(m['roundNumber']);
  _nullableInt(m['deadline']);
  _int(m['submittedCount']);
  final s = _map(m['self']);
  _keys(s, ['voted', 'isDefendant', 'vote']);
  _bool(s['voted']);
  _bool(s['isDefendant']);
  if (s['vote'] != null) {
    final v = _map(s['vote']);
    _keys(v, ['choice', 'reason']);
    _enum(v['choice'], choices);
    _text(v['reason']);
  }
  for (final x in _list(m['defenses'])) {
    final d = _map(x);
    _keys(d, ['number', 'status', 'text']);
    _roundNumber(d['number']);
    _enum(d['status'], ['submitted', 'skipped']);
    _text(d['text']);
  }
  for (final x in _list(m['rounds'])) {
    final r = _map(x);
    _keys(r, ['number', 'counts', 'reasons']);
    _roundNumber(r['number']);
    final c = _map(r['counts']);
    _keys(c, ['guilty', 'notGuilty', 'abstain']);
    for (final n in c.values) {
      _int(n);
    }
    for (final x in _list(r['reasons'])) {
      final reason = _map(x);
      _keys(reason, ['choice', 'reason']);
      _enum(reason['choice'], choices);
      _text(reason['reason']);
    }
  }
  if (m['outcome'] != null) {
    _enum(m['outcome'], ['guilty', 'not-guilty', 'no-verdict', 'tie']);
  }
}

void _redacted(JsonMap m) {
  _keys(m, ['kind', 'redacted', 'summary']);
  final s = _map(m['summary']);
  _keys(
    s,
    ['participantCount'],
    ['teams', 'revealed', 'rounds', 'responseCount'],
  );
  _int(s['participantCount']);
  if (s.containsKey('teams')) {
    for (final x in _list(s['teams'])) {
      final t = _map(x);
      _keys(t, ['team', 'count']);
      if (_int(t['team']) == 0) _bad();
      _int(t['count']);
    }
  }
  if (s.containsKey('revealed')) {
    final r = _map(s['revealed']);
    _keys(r, ['winnerCount', 'notWinnerCount']);
    for (final x in r.values) {
      _int(x);
    }
  }
  if (s.containsKey('rounds')) {
    for (final x in _list(s['rounds'])) {
      final r = _map(x);
      _keys(r, ['number', 'guilty', 'notGuilty', 'abstain', 'total']);
      _roundNumber(r['number']);
      for (final k in ['guilty', 'notGuilty', 'abstain', 'total']) {
        _int(r[k]);
      }
    }
  }
  if (s.containsKey('responseCount')) _int(s['responseCount']);
}

/// Native authenticated session differs from browser session by expiresAt.
/// No access token is returned by this endpoint or retained by this DTO.
final class NativeSessionDto {
  final JsonMap account;
  final int expiresAt;
  NativeSessionDto._(this.account, this.expiresAt);
  factory NativeSessionDto.fromJson(Object? value) {
    final m = _map(value);
    _keys(m, ['authenticated', 'expiresAt', 'account']);
    if (m['authenticated'] != true) _bad();
    final parsed = SessionDto.fromJson({
      'authenticated': true,
      'account': m['account'],
    });
    return NativeSessionDto._(parsed.account!, _int(m['expiresAt']));
  }
}
