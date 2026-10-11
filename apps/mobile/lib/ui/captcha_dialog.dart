import 'dart:async';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class CaptchaDialog extends StatefulWidget {
  const CaptchaDialog({super.key, required this.siteKey});
  final String siteKey;

  static Future<String?> show(BuildContext context, String siteKey) =>
      showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (_) => CaptchaDialog(siteKey: siteKey),
      );

  @override
  State<CaptchaDialog> createState() => _CaptchaDialogState();
}

class _CaptchaDialogState extends State<CaptchaDialog> {
  late final WebViewController _web;
  String? _error;

  @override
  void initState() {
    super.initState();
    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel(
        'TamusniCaptcha',
        onMessageReceived: (message) {
          if (message.message.startsWith('ERROR:')) {
            setState(
              () =>
                  _error = 'Le contrôle anti-robot n’a pas abouti. Réessayez.',
            );
          } else if (message.message.length > 20) {
            Navigator.of(context).pop(message.message);
          }
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onWebResourceError: (_) =>
              setState(() => _error = 'Connexion au contrôle impossible.'),
        ),
      );
    unawaited(_load());
  }

  Future<void> _load() => _web.loadHtmlString('''
<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" />
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
<style>body{font-family:system-ui;background:#f8fafc;color:#111a2e;display:grid;place-items:center;min-height:80vh;margin:0}#challenge{min-height:70px}p{font-size:14px}</style></head>
<body><main><p>Confirmez que vous êtes une personne.</p><div id="challenge"></div></main>
<script>let n=0;function mount(){if(window.turnstile){window.turnstile.render('#challenge',{sitekey:'${widget.siteKey}',callback:t=>TamusniCaptcha.postMessage(t),'error-callback':()=>TamusniCaptcha.postMessage('ERROR:challenge'),'expired-callback':()=>TamusniCaptcha.postMessage('ERROR:expired')});}else if(n++<40){setTimeout(mount,100);}}</script></body></html>
''', baseUrl: 'https://tamusni.pages.dev/mobile-captcha/');

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Vérification de sécurité'),
    content: SizedBox(
      width: 340,
      height: 200,
      child: Column(
        children: [
          Expanded(child: WebViewWidget(controller: _web)),
          if (_error != null)
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.of(context).pop(),
        child: const Text('Annuler'),
      ),
    ],
  );
}
