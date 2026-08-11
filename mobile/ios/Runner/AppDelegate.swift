import Flutter
import UIKit

/// iOS has no equivalent of Android's FLAG_SECURE — a screenshot or a screen
/// recording cannot be blocked. What it does expose is *detection*:
/// `UIScreen.isCaptured` is true while the screen is being recorded or
/// mirrored, and a notification fires after a screenshot is taken.
///
/// Both are forwarded to Flutter so the UI can hide protected content while a
/// recording is active, and note the screenshot against the account. This is
/// deterrence and attribution, not prevention — a distinction that should not
/// be papered over in the product copy.
@main
@objc class AppDelegate: FlutterAppDelegate {
  private var channel: FlutterMethodChannel?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)

    if let controller = window?.rootViewController as? FlutterViewController {
      let channel = FlutterMethodChannel(
        name: "novalabs/screen_protection",
        binaryMessenger: controller.binaryMessenger
      )
      self.channel = channel

      channel.setMethodCallHandler { call, result in
        switch call.method {
        case "isCaptured":
          result(UIScreen.main.isCaptured)
        default:
          result(FlutterMethodNotImplemented)
        }
      }

      NotificationCenter.default.addObserver(
        self,
        selector: #selector(captureStateChanged),
        name: UIScreen.capturedDidChangeNotification,
        object: nil
      )
      NotificationCenter.default.addObserver(
        self,
        selector: #selector(screenshotTaken),
        name: UIApplication.userDidTakeScreenshotNotification,
        object: nil
      )
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  @objc private func captureStateChanged() {
    channel?.invokeMethod("captureChanged", arguments: UIScreen.main.isCaptured)
  }

  @objc private func screenshotTaken() {
    channel?.invokeMethod("screenshotTaken", arguments: nil)
  }
}
