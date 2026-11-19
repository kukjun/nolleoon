package com.kukjun.nolleoon

import android.content.Context
import android.os.Handler
import android.os.Looper
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodChannel
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Fixed flutter_secure_storage 11.2.0 default-namespace persistence barrier.
 * Never accepts names, keys, values, credentials, or paths from Dart.
 * Native compilation/crash verification remains a release gate (#210).
 */
internal object SecureStorageBarrier {
    private const val CHANNEL = "nolleoon/native_secure_storage_barrier"
    // Outside the plugin's encoded credential prefix and its _BACKUP suffix.
    private const val MARKER_KEY = "__nolleoon_storage_barrier_v1__"
    private val preferenceNames = listOf(
        "FlutterSecureKeyStorage",
        "FlutterSecureStorageConfiguration",
        "FlutterSecureStorageConfiguration:FlutterSecureStorage",
        "FlutterSecureStorage"
    )
    // One writer sequence across all activities/engines in this app process.
    private val executor = Executors.newSingleThreadExecutor { task ->
        Thread(task, "nolleoon-storage-barrier").apply { isDaemon = true }
    }
    private val main = Handler(Looper.getMainLooper())
    private val processNonce = UUID.randomUUID().toString()
    // Accessed exclusively by executor. Never wrap/reuse a marker in-process.
    private var sequence = 0L

    fun attach(context: Context, messenger: BinaryMessenger): MethodChannel {
        val app = context.applicationContext
        val channel = MethodChannel(messenger, CHANNEL)
        channel.setMethodCallHandler { call, result ->
            if (call.method != "flush") {
                result.notImplemented()
            } else if (call.arguments != null) {
                result.error("INVALID_ARGUMENTS", "This method accepts no arguments", null)
            } else {
                executor.execute {
                    val succeeded = try {
                        check(sequence != Long.MAX_VALUE)
                        sequence++
                        val marker = "$processNonce:$sequence"
                        for (name in preferenceNames) {
                            val preferences = app.getSharedPreferences(name, Context.MODE_PRIVATE)
                            // Force a real change: API24 empty commit can report true
                            // without retrying a preceding failed apply to an existing file.
                            val committed = preferences.edit().putString(MARKER_KEY, marker).commit()
                            if (!committed) throw IllegalStateException("Storage barrier failed")
                        }
                        true
                    } catch (_: Exception) {
                        false
                    }
                    main.post {
                        if (succeeded) {
                            result.success(true)
                        } else {
                            result.error("STORAGE_BARRIER_FAILED", "Secure storage persistence not confirmed", null)
                        }
                    }
                }
            }
        }
        return channel
    }
}
