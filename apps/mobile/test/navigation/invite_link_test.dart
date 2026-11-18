import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/navigation/invite_link.dart';

void main() {
  const token = 'abcdefghijklmnopqrst_123';
  const valid = 'https://nolleoon.kukjun.com/travel/invite/$token';
  test('only the canonical HTTPS invite URL is accepted', () {
    expect(InviteLink.parse(valid)?.token, token);
    for (final input in [
      'http://nolleoon.kukjun.com/travel/invite/$token',
      'https://evil.example/travel/invite/$token',
      'https://nolleoon.kukjun.com.evil.example/travel/invite/$token',
      'https://user@nolleoon.kukjun.com/travel/invite/$token',
      '$valid?token=secret',
      '$valid#fragment',
      '$valid/',
      'https://nolleoon.kukjun.com:444/travel/invite/$token',
      'https://nolleoon.kukjun.com/travel/invite/short',
      'https://nolleoon.kukjun.com/travel/invite/%61bcdefghijklmnopqrst_123',
      'https://nolleoon.kukjun.com/travel/rooms/$token',
    ]) {
      expect(
        InviteLink.parse(input),
        isNull,
        reason: 'reject noncanonical link',
      );
    }
  });
  test(
    'pending link survives login cancellation but latest navigation wins',
    () {
      final pending = PendingInvitation();
      final first = pending.accept(valid)!;
      expect(pending.current?.token, token);
      // Authentication cancellation does not consume the invitation.
      expect(pending.current?.token, token);
      final second = pending.accept(
        'https://nolleoon.kukjun.com/travel/invite/zyxwvutsrqponmlkjihgf_321',
      )!;
      expect(pending.complete(first), isFalse);
      expect(pending.current?.token, second.link.token);
      expect(pending.complete(second), isTrue);
      expect(pending.current, isNull);
    },
  );
  test('invalid arrivals do not overwrite and deliberate cancel clears', () {
    final pending = PendingInvitation();
    final intent = pending.accept(valid)!;
    expect(pending.accept('https://evil.example/'), isNull);
    expect(pending.current?.token, token);
    pending.clear();
    expect(pending.complete(intent), isFalse);
    expect(pending.current, isNull);
  });
  test('tokens are not exposed through diagnostic strings', () {
    final link = InviteLink.parse(valid)!;
    final intent = PendingInvitation().accept(valid)!;
    expect(link.toString(), isNot(contains(token)));
    expect(intent.toString(), isNot(contains(token)));
  });
}
