# Native setup required before shipping

These need credentials only you can provision (Google Cloud Console / Razorpay
dashboard access). The app runs and the rest of the learner flow works without
them — only Google Sign-In and payments are affected.

## Google Sign-In

1. In Google Cloud Console, under the same project as the backend's
   `GOOGLE_CLIENT_ID` (a *web* OAuth client), create an **Android** OAuth
   client (package `com.novalabs.novalabs`, plus your release keystore's SHA-1)
   and an **iOS** OAuth client (bundle ID `com.novalabs.novalabs`).
2. Android: download `google-services.json` into `android/app/`, then add the
   `com.google.gms.google-services` plugin (see the [google_sign_in
   docs](https://pub.dev/packages/google_sign_in)).
3. iOS: add the iOS client's `REVERSED_CLIENT_ID` as a URL scheme in
   `ios/Runner/Info.plist` under `CFBundleURLTypes`.
4. Run with the web client ID as `serverClientId` so the ID token audience
   matches what the backend checks:
   ```
   flutter run --dart-define=GOOGLE_SERVER_CLIENT_ID=<web-client-id>.apps.googleusercontent.com
   ```

## Razorpay

The backend already reads `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` from
`backend/.env`. Nothing to add on the mobile side — `razorpay_flutter` opens
Razorpay's own hosted checkout using the `key_id` returned by
`POST /payments/create-order`.

## Pointing the app at your backend

```
flutter run --dart-define=API_BASE_URL=http://<your-machine-lan-ip>:8000
```

`10.0.2.2` (the default) only resolves to your host machine from the Android
emulator — use your LAN IP for a physical device, or `localhost` when running
the macOS/web desktop targets.
