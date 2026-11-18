import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/main.dart';
import 'package:nolleoon_mobile/auth/auth_repository.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/data/avatar_client.dart';
import 'package:nolleoon_mobile/features/profile/profile_avatar.dart';

import '../../auth_test.dart' as f;
import '../../receipt_fake.dart';
import 'feature_wiring_test.dart' as shell;

class PhotoTransport extends shell.ShellTransport
    implements AvatarBinaryTransport {
  late Uint8List synthetic;
  int images = 0;
  @override
  Future<TransportResponse> send(
    TransportRequest r,
    CancellationToken c,
  ) async {
    if (r.uri.path.endsWith('/avatars')) {
      requests.add(r);
      return TransportResponse(
        200,
        jsonEncode({
          'members': [
            {
              'memberId': 'member-a',
              'avatar': {
                'kind': 'image',
                'presetId': null,
                'revision': 1,
                'imageUrl': '/api/native/travel-rooms/room-a/avatars/member-a/image?v=1',
              },
            },
            {
              'memberId': 'member-b',
              'avatar': {
                'kind': 'preset',
                'presetId': 'preset-09',
                'revision': 2,
                'imageUrl': null,
              },
            },
          ],
        }),
      );
    }
    return super.send(r, c);
  }

  @override
  Future<AvatarBinaryResponse> sendAvatar(
    AvatarBinaryRequest r,
    CancellationToken c,
  ) async {
    expect(
      r.uri.path,
      '/api/native/travel-rooms/room-a/avatars/member-a/image',
    );
    expect(r.headers['Authorization'], 'Bearer ${'a' * 43}');
    expect(r.headers.containsKey('Cookie'), false);
    images++;
    return AvatarBinaryResponse(200, 'image/webp', synthetic);
  }
}

void main() {
  testWidgets(
    'root lobby sidecar private photo decodes and leaves no private widget on background',
    (tester) async {
      final t = PhotoTransport();
      await tester.runAsync(() async {
        t.synthetic = await File('assets/avatars/preset-01.webp').readAsBytes();
      });
      final auth = AuthRepository(
        identity: f.Provider(),
        backend: shell.ShellBackend(),
        store: f.Store(),
      );
      await tester.pumpWidget(
        MyApp(auth: auth, transport: t, deletionReceiptStore: ReceiptFake()),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('카카오로 로그인'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('합성 여행'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('첫 사람 (나)'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 30)),
      );
      await tester.pump();
      expect(t.images, 1);
      expect(
        tester
            .widgetList<ProfileAvatar>(find.byType(ProfileAvatar))
            .any((a) => a.bytes != null),
        true,
      );
      expect(
        tester
            .widgetList<ProfileAvatar>(find.byType(ProfileAvatar))
            .map((a) => a.presetId),
        contains('preset-09'),
      );
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();
      expect(find.byType(ProfileAvatar), findsNothing);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      await tester.pumpWidget(const SizedBox.shrink());
      auth.dispose();
      expect(tester.takeException(), isNull);
    },
  );
}
