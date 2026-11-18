import 'dart:io';
import 'dart:ui' as ui;
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart';
import 'package:nolleoon_mobile/features/profile/native_photo_source.dart';
import 'package:nolleoon_mobile/features/profile/photo_source.dart';

class SelectedFile implements GalleryPhotoFile {
  SelectedFile(this.size, this.chunks);
  final int size;
  final List<List<int>> chunks;
  bool opened = false;
  @override
  Future<int> length() async => size;
  @override
  Stream<List<int>> openRead() {
    opened = true;
    return Stream.fromIterable(chunks);
  }
}

class PickerFake implements GalleryPickerPort {
  GalleryPhotoFile? result;
  int selections = 0, discarded = 0;
  @override
  Future<void> discardLostSelection() async {
    discarded++;
  }

  @override
  Future<GalleryPhotoFile?> select() async {
    selections++;
    return result;
  }
}

class PlatformSpy extends ImagePickerPlatform {
  ImageSource? source;
  ImagePickerOptions? options;
  @override
  Future<XFile?> getImageFromSource({
    required ImageSource source,
    ImagePickerOptions options = const ImagePickerOptions(),
  }) async {
    this.source = source;
    this.options = options;
    return null;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('configuration gate does not invoke plugin', () async {
    final picker = PickerFake();
    final source = NativeProfilePhotoSource(
      picker: picker,
      nativeConfigurationVerified: false,
    );
    await expectLater(source.pick(), throwsStateError);
    expect(picker.selections, 0);
    expect(picker.discarded, 0);
  });
  test(
    'cancel is null and interrupted old selection never imports automatically',
    () async {
      final picker = PickerFake();
      final source = NativeProfilePhotoSource(
        picker: picker,
        nativeConfigurationVerified: true,
      );
      expect(await source.pick(), isNull);
      expect(picker.discarded, 1);
      expect(picker.selections, 1);
    },
  );
  test(
    'reject declared oversize before file read and growing stream at bound',
    () async {
      final picker = PickerFake();
      final source = NativeProfilePhotoSource(
        picker: picker,
        nativeConfigurationVerified: true,
      );
      final large = SelectedFile(1048577, []);
      picker.result = large;
      await expectLater(source.pick(), throwsFormatException);
      expect(large.opened, isFalse);
      picker.result = SelectedFile(1, [List.filled(1048577, 0)]);
      await expectLater(source.pick(), throwsFormatException);
    },
  );
  test('MIME comes from bounded bytes not filename and selection has no upload port', () async {
    final bytes = Uint8List.fromList([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    final picker = PickerFake()..result = SelectedFile(bytes.length, [bytes]);
    final result = await NativeProfilePhotoSource(
      picker: picker,
      nativeConfigurationVerified: true,
    ).pick();
    expect(result!.mime, 'image/png');
    expect(result.bytes, bytes);
    picker.result = SelectedFile(6, [
      [71, 73, 70, 56, 57, 97],
    ]);
    await expectLater(
      NativeProfilePhotoSource(
        picker: picker,
        nativeConfigurationVerified: true,
      ).pick(),
      throwsFormatException,
    );
  });
  test(
    'real Flutter plugin wrapper requests gallery without full metadata',
    () async {
      final prior = ImagePickerPlatform.instance;
      final spy = PlatformSpy();
      ImagePickerPlatform.instance = spy;
      try {
        expect(await FlutterGalleryPicker().select(), isNull);
        expect(spy.source, ImageSource.gallery);
        expect(spy.options!.requestFullMetadata, isFalse);
        expect(spy.options!.maxWidth, isNull);
        expect(spy.options!.maxHeight, isNull);
      } finally {
        ImagePickerPlatform.instance = prior;
      }
    },
  );
  testWidgets('EXIF orientation 6 is normalized before square crop', (
    tester,
  ) async {
    await tester.runAsync(() async {
      final bytes = await File(
        'test/features/profile/fixtures/orientation-6.jpg',
      ).readAsBytes();
      final picker = PickerFake()..result = SelectedFile(bytes.length, [bytes]);
      final input = await NativeProfilePhotoSource(
        picker: picker,
        nativeConfigurationVerified: true,
      ).pick();
      final normalized = await prepareProfilePhoto(input!);
      final codec = await ui.instantiateImageCodec(normalized);
      final image = (await codec.getNextFrame()).image;
      final rgba = (await image.toByteData(
        format: ui.ImageByteFormat.rawRgba,
      ))!;
      final top = (32 * 256 + 128) * 4, bottom = (224 * 256 + 128) * 4;
      expect(image.width, 256);
      expect(image.height, 256);
      expect(rgba.getUint8(top), greaterThan(rgba.getUint8(top + 2) + 80));
      expect(
        rgba.getUint8(bottom + 2),
        greaterThan(rgba.getUint8(bottom) + 80),
      );
      image.dispose();
      codec.dispose();
    });
  });
}
