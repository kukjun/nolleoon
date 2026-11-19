package com.kukjun.nolleoon

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var storageBarrier: MethodChannel? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        storageBarrier?.setMethodCallHandler(null)
        storageBarrier = SecureStorageBarrier.attach(applicationContext, flutterEngine.dartExecutor.binaryMessenger)
    }

    override fun cleanUpFlutterEngine(flutterEngine: FlutterEngine) {
        storageBarrier?.setMethodCallHandler(null)
        storageBarrier = null
        super.cleanUpFlutterEngine(flutterEngine)
    }
}
