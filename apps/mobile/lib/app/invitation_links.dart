import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';

/// A single full-string stream contains initial and warm native deliveries.
abstract interface class InvitationLinkSource {
  Stream<String> get links;
}

final class DisabledInvitationLinks implements InvitationLinkSource {
  const DisabledInvitationLinks();
  @override
  Stream<String> get links => const Stream<String>.empty();
}

final class AppInvitationLinks implements InvitationLinkSource {
  AppInvitationLinks() : _plugin = AppLinks();
  final AppLinks _plugin;
  @override
  Stream<String> get links => _plugin.stringLinkStream;
}

InvitationLinkSource createInvitationLinkSource({
  required bool platformVerified,
}) {
  if (!platformVerified ||
      kIsWeb ||
      ![
        TargetPlatform.iOS,
        TargetPlatform.android,
      ].contains(defaultTargetPlatform)) {
    return const DisabledInvitationLinks();
  }
  return AppInvitationLinks();
}
