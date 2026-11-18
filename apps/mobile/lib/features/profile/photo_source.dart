import 'dart:typed_data';
import 'dart:ui' as ui;

/// Host supplies a user-initiated platform picker, only after its permission and
/// device setup gate. This feature does not request gallery/storage permission.
abstract interface class ProfilePhotoSource {
  Future<PhotoInput?> pick();
}

/// Transfers ownership of bytes to the profile route; it clears them after crop.
class PhotoInput {
  PhotoInput(this.bytes, this.mime);
  final Uint8List bytes;
  final String mime;
}

/// Validate encoded metadata before decoding; crop centre square at 256px.
/// Preview/explicit Save is required before upload. Server revalidates all bytes.
Future<Uint8List> prepareProfilePhoto(PhotoInput input) async {
  if (!{'image/jpeg', 'image/png', 'image/webp'}.contains(input.mime) ||
      input.bytes.isEmpty ||
      input.bytes.length > 1048576) {
    throw const FormatException('JPEG/PNG/WebP, 1MiB 이하 사진을 선택해 주세요.');
  }
  final buffer = await ui.ImmutableBuffer.fromUint8List(input.bytes);
  ui.ImageDescriptor? descriptor;
  ui.Codec? codec;
  ui.Image? source;
  ui.Image? cropped;
  ui.Picture? picture;
  try {
    descriptor = await ui.ImageDescriptor.encoded(buffer);
    if (descriptor.width < 1 ||
        descriptor.height < 1 ||
        descriptor.width * descriptor.height > 4000000) {
      throw const FormatException('사진은 400만 화소 이하여야 해요.');
    }
    codec = await descriptor.instantiateCodec();
    source = (await codec.getNextFrame()).image;
    final size = (source.width < source.height ? source.width : source.height)
        .toDouble();
    final recorder = ui.PictureRecorder();
    final canvas = ui.Canvas(recorder);
    canvas.drawImageRect(
      source,
      ui.Rect.fromLTWH(
        (source.width - size) / 2,
        (source.height - size) / 2,
        size,
        size,
      ),
      const ui.Rect.fromLTWH(0, 0, 256, 256),
      ui.Paint(),
    );
    picture = recorder.endRecording();
    cropped = await picture.toImage(256, 256);
    final output = await cropped.toByteData(format: ui.ImageByteFormat.png);
    if (output == null || output.lengthInBytes > 1048576) {
      throw const FormatException('사진을 준비하지 못했어요.');
    }
    return Uint8List.fromList(
      output.buffer.asUint8List(output.offsetInBytes, output.lengthInBytes),
    );
  } finally {
    cropped?.dispose();
    picture?.dispose();
    source?.dispose();
    codec?.dispose();
    descriptor?.dispose();
    buffer.dispose();
  }
}
