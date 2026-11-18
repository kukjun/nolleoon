/// Validates routing only. Server preview/join still validates invite authority.
final class InviteLink {
  const InviteLink._(this.token);
  final String token;
  static final _pattern = RegExp(
    r'^https://nolleoon\.kukjun\.com/travel/invite/([A-Za-z0-9_-]{20,128})$',
  );

  static InviteLink? parse(String value) {
    if (value.length > 512) return null;
    final match = _pattern.firstMatch(value);
    if (match == null || match.end != value.length) return null;
    return InviteLink._(match.group(1)!);
  }

  Uri get uri => Uri.https('nolleoon.kukjun.com', '/travel/invite/$token');
  @override
  String toString() => 'InviteLink(redacted)';
}

/// An opaque local navigation intent, never persisted as authentication proof.
final class InvitationIntent {
  const InvitationIntent._(this.link);
  final InviteLink link;
  @override
  String toString() => 'InvitationIntent(redacted)';
}

/// Login cancellation does not consume an invitation. Only explicit cancellation
/// or success for the exact current intent clears it; late callbacks are ignored.
final class PendingInvitation {
  InvitationIntent? _intent;
  InviteLink? get current => _intent?.link;

  InvitationIntent? accept(String value) {
    final link = InviteLink.parse(value);
    if (link == null) return null;
    final intent = InvitationIntent._(link);
    _intent = intent;
    return intent;
  }

  bool complete(InvitationIntent intent) {
    if (!identical(_intent, intent)) return false;
    _intent = null;
    return true;
  }

  void clear() => _intent = null;
}
