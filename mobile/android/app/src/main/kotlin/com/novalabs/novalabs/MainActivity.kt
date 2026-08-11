package com.novalabs.novalabs

import android.os.Bundle
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity

/**
 * FLAG_SECURE marks the window as secure content: Android itself refuses to
 * screenshot it, blanks it in screen recordings and in the recent-apps
 * preview, and blocks it from non-secure external displays.
 *
 * This is enforced by the OS rather than by the app, so unlike anything
 * possible on the web it cannot be switched off from inside the process. It
 * covers the whole activity because course video, notes and quizzes are all
 * paid content.
 */
class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE,
        )
    }
}
