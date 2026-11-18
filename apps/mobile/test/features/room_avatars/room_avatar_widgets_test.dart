import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/features/room_avatars/room_avatars.dart';
import 'package:nolleoon_mobile/features/room_avatars/room_avatar_widgets.dart';
import 'package:nolleoon_mobile/features/profile/profile_avatar.dart';

import 'room_avatars_test.dart' as f;

class PictureSource extends f.Source {
  late Uint8List encoded;
  @override
  Future<Uint8List> image(String path, CancellationToken cancel) async {
    images++;
    return Uint8List.fromList(encoded);
  }
}

void main() {
  testWidgets(
    'private decoded photo clears on background, same-key account/repo swap and closed room',
    (t) async {
      final source = PictureSource();
      await t.runAsync(() async {
        final recorder = ui.PictureRecorder();
        ui.Canvas(recorder)
            .drawColor(const Color(0xff00ff00), ui.BlendMode.src);
        final picture = recorder.endRecording();
        final photo = await picture.toImage(8, 8);
        source.encoded = (await photo.toByteData(
          format: ui.ImageByteFormat.png,
        ))!.buffer.asUint8List();
        photo.dispose();
        picture.dispose();
      });
      final empty = f.Source()..rows = [];
      Widget tree(
        RoomAvatarSource repo, {
        String account = 'A',
        bool closed = false,
      }) => MaterialApp(
        home: RoomAvatarsScope(
          accountScope: account,
          roomId: 'room-a',
          closed: closed,
          repository: repo,
          child: const RoomMemberAvatar(
            membershipId: 'member-a',
            presetId: 'preset-05',
          ),
        ),
      );
      await t.pumpWidget(tree(source));
      await t.pumpAndSettle();
      await t.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 30)),
      );
      await t.pumpAndSettle();
      expect(source.images, 1);
      expect(
        t.widget<ProfileAvatar>(find.byType(ProfileAvatar)).bytes,
        isNotNull,
      );
      expect(find.byType(RawImage), findsOneWidget);
      final bytes = t.widget<ProfileAvatar>(find.byType(ProfileAvatar)).bytes!;
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await t.pump();
      expect(bytes, everyElement(0));
      expect(t.widget<ProfileAvatar>(find.byType(ProfileAvatar)).bytes, isNull);
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await t.pumpAndSettle();
      await t.pumpWidget(tree(empty, account: 'B'));
      await t.pumpAndSettle();
      expect(t.widget<ProfileAvatar>(find.byType(ProfileAvatar)).bytes, isNull);
      final calls = source.loads;
      await t.pumpWidget(tree(source, closed: true));
      await t.pumpAndSettle();
      await t.pump(const Duration(seconds: 11));
      expect(source.loads, calls);
      expect(t.widget<ProfileAvatar>(find.byType(ProfileAvatar)).bytes, isNull);
      await t.pumpWidget(const SizedBox());
      expect(t.takeException(), isNull);
    },
  );
  testWidgets(
    'outside scope stays preset-only; duplicate widgets share one binary fetch and member changes release old',
    (t) async {
      final source = f.Source();
      await t.pumpWidget(
        const MaterialApp(
          home: RoomMemberAvatar(
            membershipId: 'member-a',
            presetId: 'preset-02',
          ),
        ),
      );
      await t.pumpAndSettle();
      expect(source.images, 0);
      Widget tree(String member) => MaterialApp(
        home: RoomAvatarsScope(
          accountScope: 'A',
          roomId: 'room-a',
          closed: false,
          repository: source,
          child: Column(
            children: [
              RoomMemberAvatar(membershipId: member),
              RoomMemberAvatar(membershipId: member),
            ],
          ),
        ),
      );
      await t.pumpWidget(tree('member-a'));
      await t.pumpAndSettle();
      expect(source.images, 1);
      final first = t
          .widgetList<ProfileAvatar>(find.byType(ProfileAvatar))
          .first
          .bytes!;
      await t.pumpWidget(tree('absent'));
      await t.pumpAndSettle();
      expect(first, everyElement(0));
      expect(
        t
            .widgetList<ProfileAvatar>(find.byType(ProfileAvatar))
            .every((a) => a.bytes == null),
        true,
      );
      await t.pumpWidget(const SizedBox());
    },
  );
}
