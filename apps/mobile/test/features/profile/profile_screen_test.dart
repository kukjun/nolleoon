import 'dart:async';
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

class LatePhotoSource implements ProfilePhotoSource {
  final pending = Completer<PhotoInput?>();
  @override
  Future<PhotoInput?> pick() => pending.future;
}

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
            accountScope: 'account-a',
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
  testWidgets(
    'same repository account scope swap clears old draft and late picker',
    (tester) async {
      final j = f.JsonFake();
      final binary = a.AvatarFake();
      var id = 'account-a';
      var bearer = 'a' * 43;
      j.handler = (r) async {
        final value = f.account()
          ..['id'] = id
          ..['displayName'] = id;
        return f.jsonOk({
          'authenticated': true,
          if (r.method == 'GET') 'expiresAt': 9999,
          'account': value,
        });
      };
      final repository = ProfileRepository(
        ApiClient(
          transport: j,
          resolver: const NativeRoutes(),
          accessToken: () async => bearer,
        ),
        AvatarClient(transport: binary, accessToken: () async => bearer),
      );
      final source = LatePhotoSource();
      Widget screen() => MaterialApp(
        home: ProfileScreen(
          key: const ValueKey('same-profile'),
          accountScope: id,
          repository: repository,
          onSessionLost: () {},
          photoSource: source,
        ),
      );
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'old private draft');
      await tester.tap(find.text('캐릭터·사진 바꾸기'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('내 사진 선택'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('내 사진 선택'));
      await tester.pump();
      id = 'account-b';
      bearer = 'b' * 43;
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      expect(find.text('old private draft'), findsNothing);
      expect(find.text('account-b'), findsOneWidget);
      final oldBytes = Uint8List.fromList([1, 2, 3]);
      source.pending.complete(PhotoInput(oldBytes, 'image/png'));
      await tester.pumpAndSettle();
      expect(oldBytes.every((x) => x == 0), isTrue);
      expect(find.text('캐릭터·사진 선택'), findsNothing);
      expect(binary.requests, isEmpty);
      await tester.tap(find.text('이름 저장'));
      await tester.pumpAndSettle();
      expect(j.requests.last.headers['Authorization'], 'Bearer ${'b' * 43}');
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    '409 shows authoritative name while preserving explicit draft choice',
    (tester) async {
      final j = f.JsonFake();
      final binary = a.AvatarFake();
      var current = '원래 이름';
      j.handler = (r) async {
        if (r.method == 'POST') {
          current = '다른 기기 이름';
          return const TransportResponse(
            409,
            '{"error":{"code":"STATE_CONFLICT"}}',
          );
        }
        return f.jsonOk({
          'authenticated': true,
          'expiresAt': 9999,
          'account': f.account()..['displayName'] = current,
        });
      };
      final repository = ProfileRepository(
        ApiClient(
          transport: j,
          resolver: const NativeRoutes(),
          accessToken: () async => 'a' * 43,
        ),
        AvatarClient(transport: binary, accessToken: () async => 'a' * 43),
      );
      Widget screen() => MaterialApp(
        home: ProfileScreen(
          accountScope: 'account-a',
          repository: repository,
          onSessionLost: () {},
        ),
      );
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '내 초안');
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      expect(find.text('내 초안'), findsOneWidget);
      await tester.tap(find.text('이름 저장'));
      await tester.pumpAndSettle();
      expect(find.text('내 초안'), findsOneWidget);
      expect(find.text('현재 서버 이름: 다른 기기 이름'), findsOneWidget);
      await tester.tap(find.text('최신 이름 사용'));
      await tester.pumpAndSettle();
      expect(find.text('다른 기기 이름'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
