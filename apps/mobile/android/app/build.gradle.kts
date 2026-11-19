import java.util.Base64

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Flutter passes the same defines to Dart and this platform build. Never echo values.
val kakaoConfig = mutableMapOf<String, String>()
val encodedDefines = providers.gradleProperty("dart-defines").orNull.orEmpty()
if (encodedDefines.isNotEmpty()) {
    encodedDefines.split(",").forEach { encoded ->
        val item = try { String(Base64.getDecoder().decode(encoded), Charsets.UTF_8) }
            catch (_: Exception) { throw GradleException("Invalid native callback configuration") }
        val separator = item.indexOf('=')
        if (separator < 0) throw GradleException("Invalid native callback configuration")
        val name = item.substring(0, separator)
        if (name in listOf("KAKAO_ADMIN_KEY", "KAKAO_REST_API_KEY"))
            throw GradleException("Forbidden native credential type")
        if (name in listOf("KAKAO_NATIVE_APP_KEY", "NATIVE_AUTH_PLATFORM_VERIFIED", "NATIVE_LOOPBACK_TEST_BUILD", "NATIVE_LOOPBACK_ORIGIN", "NATIVE_KAKAO_VERIFICATION_BUILD")) {
            if (kakaoConfig.containsKey(name)) throw GradleException("Duplicate native callback configuration")
            kakaoConfig[name] = item.substring(separator + 1)
        }
    }
}
val kakaoNativeKey = kakaoConfig["KAKAO_NATIVE_APP_KEY"].orEmpty()
val kakaoVerified = kakaoConfig["NATIVE_AUTH_PLATFORM_VERIFIED"] ?: "false"
if (kakaoVerified !in listOf("true", "false") ||
    (kakaoNativeKey.isNotEmpty() && !Regex("^[a-f0-9]{32}$").matches(kakaoNativeKey)) ||
    (kakaoVerified == "true" && kakaoNativeKey.isEmpty()))
    throw GradleException("Invalid native callback configuration")
val kakaoCallbackEnabled = kakaoVerified == "true" && kakaoNativeKey.isNotEmpty()

val localTestFlag = kakaoConfig["NATIVE_LOOPBACK_TEST_BUILD"] ?: "false"
val verificationFlag = kakaoConfig["NATIVE_KAKAO_VERIFICATION_BUILD"] ?: "false"
val localBuild = localTestFlag == "true" || verificationFlag == "true"
val localTestOrigin = kakaoConfig["NATIVE_LOOPBACK_ORIGIN"].orEmpty()
val localOriginMatch = Regex("^http://(127\\.0\\.0\\.1|\\[::1\\]):([0-9]+)$").matchEntire(localTestOrigin)
if (localTestFlag !in listOf("true", "false") || verificationFlag !in listOf("true", "false") ||
    (localTestFlag == "true" && verificationFlag == "true") ||
    (verificationFlag == "true" && !kakaoCallbackEnabled) ||
    (!localBuild && localTestOrigin.isNotEmpty()) ||
    (localBuild && (localOriginMatch == null || localOriginMatch.groupValues[2].toIntOrNull() !in 1..65535)))
    throw GradleException("Invalid local test configuration")
if (localBuild && gradle.startParameter.taskNames.any { it.contains("release", true) || it.contains("profile", true) })
    throw GradleException("Local test identity is debug only")

android {
    namespace = "com.kukjun.nolleoon"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.kukjun.nolleoon"
        manifestPlaceholders["kakaoCallbackEnabled"] = kakaoCallbackEnabled.toString()
        manifestPlaceholders["kakaoCallbackScheme"] = if (kakaoCallbackEnabled) "kakao$kakaoNativeKey" else "nolleoon-kakao-disabled"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        debug {
            if (localTestFlag == "true") applicationIdSuffix = ".localprobe"
        }
        release {
            // Release signing is deliberately unconfigured.
            // Store identity and signing require a separate approved setup.
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

// Aggregate tasks cannot accidentally produce non-debug loopback artifacts.
androidComponents {
    beforeVariants(selector().all()) { variant ->
        if (localBuild && variant.buildType != "debug") variant.enable = false
    }
}
