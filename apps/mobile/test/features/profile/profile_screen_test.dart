import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/data/api_client.dart';
import 'package:nolleoon_mobile/data/avatar_client.dart';
import 'package:nolleoon_mobile/features/profile/profile_repository.dart';
import 'package:nolleoon_mobile/features/profile/profile_screen.dart';
import 'package:nolleoon_mobile/features/profile/photo_source.dart';

import '../../data/avatar_client_test.dart' as a;
import 'profile_test.dart' as f;

void main() {
  for (final width in [320.0, 390.0]) {
    testWidgets('profile preset selection and cancel at $width', (
      tester,
    ) async {
      tester.view.physicalSize = Size(width, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final j = f.JsonFake();
      final binary = a.AvatarFake();
      var selected = 'preset-01';
      var revision = 1;
      j.handler = (r) async => f.jsonOk({
        'authenticated': true,
        'expiresAt': 9999,
        'account': f.account(revision: revision, preset: selected),
      });
      binary.handler = (r, c) async {
        selected = 'preset-02';
        revision++;
        return a.jsonResponse({
          'kind': 'preset',
          'presetId': selected,
          'revision': revision,
          'imageUrl': null,
        });
      };
      await tester.pumpWidget(
        MaterialApp(
          home: ProfileScreen(
            repository: ProfileRepository(
              ApiClient(
                transport: j,
                resolver: const NativeRoutes(),
                accessToken: () async => 'a' * 43,
              ),
              AvatarClient(
                transport: binary,
                accessToken: () async => 'a' * 43,
              ),
            ),
            onSessionLost: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('캐릭터·사진 바꾸기'));
      await tester.pumpAndSettle();
      expect(find.text('내 사진 선택'), findsOneWidget);
      await tester.tap(find.text('검사'));
      await tester.pump();
      await tester.scrollUntilVisible(
        find.text('취소'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('취소'));
      await tester.pumpAndSettle();
      expect(binary.requests, isEmpty);
      await tester.ensureVisible(find.text('캐릭터·사진 바꾸기'));
      await tester.tap(find.text('캐릭터·사진 바꾸기'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('검사'));
      await tester.pump();
      await tester.scrollUntilVisible(
        find.text('선택한 모습 저장'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('선택한 모습 저장'));
      await tester.pumpAndSettle();
      expect(binary.requests.length, 1);
      expect(find.text('서버에 저장했어요.'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    });
  }
  testWidgets(
    'photo normalizes a real encoded image to 256 square and rejects wrong MIME',
    (tester) async {
      await tester.runAsync(() async {
        final recorder = ui.PictureRecorder();
        final canvas = ui.Canvas(recorder);
        canvas.drawColor(const Color(0xff00aa00), ui.BlendMode.src);
        final picture = recorder.endRecording();
        final image = await picture.toImage(400, 200);
        final bytes = (await image.toByteData(format: ui.ImageByteFormat.png))!
            .buffer
            .asUint8List();
        final normalized = await prepareProfilePhoto(
          PhotoInput(bytes, 'image/png'),
        );
        final codec = await ui.instantiateImageCodec(normalized);
        final result = (await codec.getNextFrame()).image;
        expect(result.width, 256);
        expect(result.height, 256);
        expect(normalized.length, lessThanOrEqualTo(1048576));
        await expectLater(
          prepareProfilePhoto(PhotoInput(Uint8List(5), 'image/svg+xml')),
          throwsFormatException,
        );
        result.dispose();
        codec.dispose();
        image.dispose();
        picture.dispose();
      });
    },
  );
  testWidgets('photo pixel limit checked before full decode', (tester) async {
    await tester.runAsync(() async {
      final recorder = ui.PictureRecorder();
      ui.Canvas(recorder).drawColor(const Color(0xff000000), ui.BlendMode.src);
      final picture = recorder.endRecording();
      final image = await picture.toImage(2001, 2000);
      final bytes = (await image.toByteData(format: ui.ImageByteFormat.png))!
          .buffer
          .asUint8List();
      await expectLater(
        prepareProfilePhoto(PhotoInput(bytes, 'image/png')),
        throwsFormatException,
      );
      image.dispose();
      picture.dispose();
    });
  });
}
