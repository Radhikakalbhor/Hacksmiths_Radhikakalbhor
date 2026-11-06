import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:permission_handler/permission_handler.dart';

/// ---------------------------------------------------------------------------
/// Sahayak Android Native Wrapper (Flutter)
///
/// Wraps the live Sahayak Next.js web application into a full-screen,
/// immersive Android application with native hardware capabilities (GPS,
/// Camera, Voice/Microphone, Cookies & Local Storage for Supabase Auth).
/// ---------------------------------------------------------------------------

/// The live deployment URL of the Sahayak web app.
const String kAppUrl = 'https://sahayak-hazel-five.vercel.app/';

/// Brand Colors (Matching Sahayak Next.js Tailwind design tokens)
const Color kDeepTeal = Color(0xFF0F5C5C); // Primary Deep Teal #0F5C5C
const Color kDeepTealDark = Color(0xFF093B3B); // Darker tone for headers/appbars
const Color kWarmOffWhite = Color(0xFFFAF9F5); // Background
const Color kAccentGreen = Color(0xFF10B981); // Emerald accent

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Set Android Status Bar & Navigation Bar to Sahayak Brand Colors
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: kDeepTeal,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Colors.white,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );

  // Initialize Android InAppWebView Platform Settings if necessary
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
    await InAppWebViewController.setWebContentsDebuggingEnabled(kDebugMode);
  }

  runApp(const SahayakApp());
}

class SahayakApp extends StatelessWidget {
  const SahayakApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Sahayak',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: kDeepTeal,
          primary: kDeepTeal,
          surface: kWarmOffWhite,
        ),
        useMaterial3: true,
        scaffoldBackgroundColor: kWarmOffWhite,
      ),
      home: const SplashScreen(),
    );
  }
}

/// ---------------------------------------------------------------------------
/// 1. Simple Branded Splash Screen
/// ---------------------------------------------------------------------------
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );

    _fadeAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeIn,
    );

    _scaleAnimation = Tween<double>(begin: 0.85, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutBack),
    );

    _controller.forward();

    // Request essential permissions proactively and transition to main WebView
    _initializeApp();
  }

  Future<void> _initializeApp() async {
    // Clear all WebView cache on splash screen before WebViewScreen is instantiated
    try {
      await InAppWebViewController.clearAllCache();
    } catch (_) {
      // Ignore if webview engine not ready yet
    }

    // Proactively request fine location so Post-Job GPS is immediately ready
    try {
      await [
        Permission.locationWhenInUse,
        Permission.camera,
        Permission.microphone,
      ].request();
    } catch (_) {
      // Ignore if denied at startup; WebView prompts dynamically when used
    }

    // Keep splash visible briefly for smooth branding presentation
    await Future.delayed(const Duration(milliseconds: 1800));

    if (mounted) {
      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          transitionDuration: const Duration(milliseconds: 500),
          pageBuilder: (context, animation, secondaryAnimation) =>
              const WebViewScreen(),
          transitionsBuilder:
              (context, animation, secondaryAnimation, child) {
            return FadeTransition(opacity: animation, child: child);
          },
        ),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kDeepTeal,
      body: SafeArea(
        child: Center(
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: ScaleTransition(
              scale: _scaleAnimation,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // App Icon / Logo Shield
                  Container(
                    width: 104,
                    height: 104,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(28),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.15),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Icon(
                        Icons.handyman_rounded,
                        size: 54,
                        color: kDeepTeal,
                      ),
                    ),
                  ),
                  const SizedBox(height: 28),

                  // Brand Title
                  const Text(
                    'Sahayak',
                    style: TextStyle(
                      fontSize: 34,
                      fontWeight: FontWeight.bold,
                      letterSpacing: -0.5,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Tagline
                  Text(
                    'Aapka Bharosemand Sahayak',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: Colors.white.withValues(alpha: 0.85),
                      letterSpacing: 0.2,
                    ),
                  ),
                  const SizedBox(height: 48),

                  // Subtle Loading Spinner
                  SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        Colors.white.withValues(alpha: 0.8),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// ---------------------------------------------------------------------------
/// 2. Full-Screen InAppWebView Screen
/// ---------------------------------------------------------------------------
class WebViewScreen extends StatefulWidget {
  const WebViewScreen({super.key});

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  InAppWebViewController? _webViewController;
  PullToRefreshController? _pullToRefreshController;

  double _progress = 0.0;
  bool _isLoading = true;
  bool _hasError = false;
  String _errorMessage = '';

  /// WebView Configuration
  late final InAppWebViewSettings _settings;

  @override
  void initState() {
    super.initState();

    _settings = InAppWebViewSettings(
      // Enable JavaScript & DOM Storage (Critical for Supabase Auth, OTP & Next.js React hydration)
      javaScriptEnabled: true,
      domStorageEnabled: true,
      databaseEnabled: true,

      // Cookie persistence across app restarts
      thirdPartyCookiesEnabled: true,
      sharedCookiesEnabled: true,

      // Cache settings: ensure cached paused/stale pages are bypassed
      cacheMode: CacheMode.LOAD_DEFAULT,
      clearCache: true,
      cacheEnabled: true,

      // HTML5 Geolocation API support
      geolocationEnabled: true,

      // HTML <input type="file"> and Camera picker support
      allowFileAccess: true,
      allowContentAccess: true,
      allowFileAccessFromFileURLs: true,
      allowUniversalAccessFromFileURLs: true,

      // Media & Audio Recording support
      mediaPlaybackRequiresUserGesture: false,
      allowsInlineMediaPlayback: true,

      // Smooth modern rendering
      useHybridComposition: true,
      useShouldOverrideUrlLoading: true,
      transparentBackground: false,
      isInspectable: kDebugMode,
    );

    // Pull to refresh support for native mobile feel
    _pullToRefreshController = PullToRefreshController(
      settings: PullToRefreshSettings(
        color: kDeepTeal,
        backgroundColor: Colors.white,
      ),
      onRefresh: () async {
        try {
          await InAppWebViewController.clearAllCache();
        } catch (_) {}
        final urlToLoad = await _webViewController?.getUrl() ?? WebUri(kAppUrl);
        await _webViewController?.loadUrl(
          urlRequest: URLRequest(
            url: urlToLoad,
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
            },
          ),
        );
      },
    );
  }

  /// Clear cache and reload the web view, resetting error status
  Future<void> _retryLoading() async {
    setState(() {
      _hasError = false;
      _isLoading = true;
      _progress = 0.0;
    });
    if (_webViewController != null) {
      try {
        await InAppWebViewController.clearAllCache();
      } catch (_) {}
      final currentUrl = await _webViewController!.getUrl();
      final targetUri = (currentUrl == null ||
              currentUrl.toString().isEmpty ||
              currentUrl.toString() == 'about:blank')
          ? WebUri(kAppUrl)
          : currentUrl;

      await _webViewController!.loadUrl(
        urlRequest: URLRequest(
          url: targetUri,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: kDeepTeal,
        statusBarIconBrightness: Brightness.light,
        systemNavigationBarColor: Colors.white,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      // Intercept Android hardware back button to navigate history inside WebView
      child: PopScope(
        canPop: false,
        onPopInvokedWithResult: (bool didPop, dynamic result) async {
          if (didPop) return;

          if (_webViewController != null &&
              await _webViewController!.canGoBack()) {
            await _webViewController!.goBack();
          } else {
            // No backward history left, exit the app
            if (context.mounted) {
              SystemNavigator.pop();
            }
          }
        },
        child: Scaffold(
          backgroundColor: Colors.white,
          body: SafeArea(
            bottom: false, // Edge-to-edge experience at bottom
            child: Stack(
              children: [
                // 1. Primary Full-Screen InAppWebView
                InAppWebView(
                  initialUrlRequest: URLRequest(
                    url: WebUri(kAppUrl),
                    headers: {
                      'Cache-Control': 'no-cache, no-store, must-revalidate',
                      'Pragma': 'no-cache',
                      'Expires': '0',
                    },
                  ),
                  initialSettings: _settings,
                  pullToRefreshController: _pullToRefreshController,
                  onWebViewCreated: (controller) async {
                    _webViewController = controller;
                    // Clear cache once on startup so old pages are never reused
                    try {
                      await InAppWebViewController.clearAllCache();
                    } catch (_) {}
                  },

                  // Page Loading State
                  onLoadStart: (controller, url) {
                    setState(() {
                      _isLoading = true;
                      _hasError = false;
                    });
                  },

                  onLoadStop: (controller, url) async {
                    _pullToRefreshController?.endRefreshing();

                    // Detect and bust any cached Vercel "deployment paused" screen
                    try {
                      final bodyText = await controller.evaluateJavascript(
                        source: "document.body ? document.body.innerText : ''",
                      );
                      if (bodyText != null &&
                          bodyText.toString().toLowerCase().contains(
                                'deployment is temporarily paused',
                              )) {
                        await InAppWebViewController.clearAllCache();
                        // Force load the live page directly with fresh network request
                        await controller.loadUrl(
                          urlRequest: URLRequest(
                            url: WebUri(kAppUrl),
                            headers: {
                              'Cache-Control':
                                  'no-cache, no-store, must-revalidate',
                              'Pragma': 'no-cache',
                              'Expires': '0',
                            },
                          ),
                        );
                        return;
                      }
                    } catch (_) {}

                    setState(() {
                      _isLoading = false;
                    });
                  },

                  onProgressChanged: (controller, progress) {
                    if (progress == 100) {
                      _pullToRefreshController?.endRefreshing();
                    }
                    setState(() {
                      _progress = progress / 100;
                      if (_progress >= 1.0) {
                        _isLoading = false;
                      }
                    });
                  },

                  // Error Handling (e.g. No Internet connection or DNS lookup failure)
                  onReceivedError: (controller, request, error) {
                    _pullToRefreshController?.endRefreshing();
                    // Only trigger full error screen if the main web document fails
                    final isMainFrame = request.isForMainFrame ?? true;
                    if (isMainFrame) {
                      setState(() {
                        _hasError = true;
                        _isLoading = false;
                        _errorMessage = error.description.isNotEmpty
                            ? error.description
                            : 'Failed to connect to Sahayak servers.';
                      });
                    }
                  },

                  onReceivedHttpError: (controller, request, errorResponse) {
                    _pullToRefreshController?.endRefreshing();
                    final isMainFrame = request.isForMainFrame ?? true;
                    final statusCode = errorResponse.statusCode ?? 200;
                    // Handle 5xx server errors and 4xx client/deployment errors on the main page
                    if (isMainFrame && statusCode >= 400 && statusCode < 600) {
                      setState(() {
                        _hasError = true;
                        _isLoading = false;
                        _errorMessage = statusCode >= 500
                            ? 'Server error ($statusCode). Please tap to retry.'
                            : 'Service error ($statusCode). Please tap to retry.';
                      });
                    }
                  },

                  /// ---------------------------------------------------------
                  /// 2. HTML5 Geolocation Permission Handler (GPS on Post Job)
                  /// ---------------------------------------------------------
                  onGeolocationPermissionsShowPrompt:
                      (controller, origin) async {
                    final status = await Permission.locationWhenInUse.request();
                    return GeolocationPermissionShowPromptResponse(
                      origin: origin,
                      allow: status.isGranted,
                      retain: true,
                    );
                  },

                  /// ---------------------------------------------------------
                  /// 3. WebRTC / Camera & Microphone Permission Handler
                  /// ---------------------------------------------------------
                  onPermissionRequest: (controller, permissionRequest) async {
                    final grantedResources = <PermissionResourceType>[];

                    for (final resource in permissionRequest.resources) {
                      if (resource == PermissionResourceType.CAMERA) {
                        final status = await Permission.camera.request();
                        if (status.isGranted) {
                          grantedResources.add(resource);
                        }
                      } else if (resource ==
                          PermissionResourceType.MICROPHONE) {
                        final status = await Permission.microphone.request();
                        if (status.isGranted) {
                          grantedResources.add(resource);
                        }
                      } else if (resource ==
                          PermissionResourceType.CAMERA_AND_MICROPHONE) {
                        final cam = await Permission.camera.request();
                        final mic = await Permission.microphone.request();
                        if (cam.isGranted && mic.isGranted) {
                          grantedResources.add(resource);
                        }
                      } else {
                        // Grant other standard web device resources
                        grantedResources.add(resource);
                      }
                    }

                    return PermissionResponse(
                      resources: grantedResources,
                      action: grantedResources.isNotEmpty
                          ? PermissionResponseAction.GRANT
                          : PermissionResponseAction.DENY,
                    );
                  },
                ),

                // 2. Linear Loading Progress Bar at top edge
                if (_isLoading && !_hasError)
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    child: LinearProgressIndicator(
                      value: _progress > 0 ? _progress : null,
                      backgroundColor: Colors.transparent,
                      valueColor: const AlwaysStoppedAnimation<Color>(kAccentGreen),
                      minHeight: 3.0,
                    ),
                  ),

                // 3. Friendly "No Internet / Tap to Retry" Screen
                if (_hasError)
                  Positioned.fill(
                    child: Container(
                      color: kWarmOffWhite,
                      padding: const EdgeInsets.symmetric(horizontal: 32.0),
                      child: Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            // Soft Icon Badge
                            Container(
                              width: 88,
                              height: 88,
                              decoration: BoxDecoration(
                                color: kDeepTeal.withValues(alpha: 0.1),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                _errorMessage.toLowerCase().contains('error')
                                    ? Icons.cloud_off_rounded
                                    : Icons.wifi_off_rounded,
                                size: 44,
                                color: kDeepTeal,
                              ),
                            ),
                            const SizedBox(height: 24),

                            // Heading
                            Text(
                              _errorMessage.toLowerCase().contains('error')
                                  ? 'Unable to Connect'
                                  : 'No Internet Connection',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF152220),
                                letterSpacing: -0.3,
                              ),
                            ),
                            const SizedBox(height: 10),

                            // Description
                            Text(
                              _errorMessage.isNotEmpty &&
                                      !_errorMessage.contains('ERR_')
                                  ? _errorMessage
                                  : 'Sahayak requires an active network connection. Please check your mobile data or Wi-Fi and try again.',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 14,
                                color: Color(0xFF576563),
                                height: 1.45,
                              ),
                            ),
                            const SizedBox(height: 32),

                            // Retry Button
                            SizedBox(
                              width: double.infinity,
                              height: 50,
                              child: ElevatedButton.icon(
                                onPressed: _retryLoading,
                                icon: const Icon(Icons.refresh_rounded, size: 20),
                                label: const Text(
                                  'Tap to Retry',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: kDeepTeal,
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
