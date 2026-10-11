import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/app_config.dart';
import '../state/app_controller.dart';
import 'captcha_dialog.dart';

enum _AuthMode { login, register, verify, forgot, mfa }

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.controller});
  final AppController controller;
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _form = GlobalKey<FormState>();
  final _first = TextEditingController();
  final _last = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _code = TextEditingController();
  bool _showPassword = false;
  bool _terms = false;
  bool _sponsoredApp = false;
  bool _sponsoredEmail = false;
  bool _working = false;
  final List<String> _topics = [AppConfig.topics.first];
  _AuthMode _mode = _AuthMode.login;
  String? _message;

  AppController get c => widget.controller;

  @override
  void initState() {
    super.initState();
    if (c.mfaPending) _mode = _AuthMode.mfa;
    if (c.pendingEmail != null) {
      _mode = _AuthMode.verify;
      _email.text = c.pendingEmail!;
    }
  }

  @override
  void dispose() {
    _first.dispose();
    _last.dispose();
    _email.dispose();
    _password.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<String> _captcha() async {
    final config = await c.config();
    final turnstile = config['turnstile'] as Map?;
    final key = '${turnstile?['siteKey'] ?? ''}';
    if (key.isEmpty) {
      throw Exception(
        'Le contrôle de sécurité est indisponible. Réessayez plus tard.',
      );
    }
    if (!mounted) throw Exception('Écran de connexion fermé.');
    final token = await CaptchaDialog.show(context, key);
    if (token == null) throw Exception('Vérification annulée.');
    return token;
  }

  Future<void> _submit() async {
    if (_mode == _AuthMode.verify || _mode == _AuthMode.mfa) {
      if (_code.text.trim().length != 6) {
        return _show('Saisissez le code à 6 chiffres.');
      }
    } else if (!_form.currentState!.validate()) {
      return;
    }
    setState(() {
      _working = true;
      _message = null;
    });
    try {
      switch (_mode) {
        case _AuthMode.login:
          await c.login(_email.text, _password.text);
          if (c.mfaPending) setState(() => _mode = _AuthMode.mfa);
          break;
        case _AuthMode.register:
          if (!_terms) {
            throw Exception('Veuillez accepter les conditions d’utilisation.');
          }
          if (_topics.isEmpty) {
            throw Exception('Choisissez au moins une rubrique préférée.');
          }
          final captcha = await _captcha();
          await c.register(
            firstName: _first.text,
            lastName: _last.text,
            email: _email.text,
            password: _password.text,
            topics: _topics,
            termsAccepted: _terms,
            sponsoredInApp: _sponsoredApp,
            sponsoredEmail: _sponsoredEmail,
            turnstileToken: captcha,
          );
          setState(() {
            _mode = _AuthMode.verify;
            _message =
                'Un code de confirmation a été envoyé à ${_email.text.trim()}.';
          });
          break;
        case _AuthMode.verify:
          await c.verifyEmail(_code.text);
          break;
        case _AuthMode.forgot:
          final captcha = await _captcha();
          await c.forgotPassword(_email.text, captcha);
          setState(() {
            _mode = _AuthMode.login;
            _message =
                'Si ce compte existe, un e-mail de réinitialisation a été envoyé.';
          });
          break;
        case _AuthMode.mfa:
          await c.verifyMfa(_code.text);
          break;
      }
    } catch (error) {
      _show(error.toString());
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _google() async {
    setState(() {
      _working = true;
      _message = null;
    });
    try {
      final config = await c.config();
      final oauth = config['oauth'] as Map?;
      if (oauth?['google'] != true) {
        throw Exception('La connexion Google n’est pas activée sur TAMUSNI.');
      }
      final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/auth/oauth').replace(
        queryParameters: {
          'provider': 'google',
          'platform': 'android',
          'intent': 'login',
          'locale': c.locale,
        },
      );
      if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        throw Exception('Impossible d’ouvrir Google.');
      }
      setState(
        () => _message = 'Terminez la connexion dans la fenêtre Google.',
      );
    } catch (error) {
      _show(error.toString());
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _resend() async {
    setState(() {
      _working = true;
    });
    try {
      await c.resendVerification(await _captcha());
      setState(
        () => _message =
            'Un nouveau code a été demandé. Vérifiez votre boîte e-mail.',
      );
    } catch (error) {
      _show(error.toString());
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  void _show(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  String _s(String key) => AppStrings.get(key, c.locale);

  @override
  Widget build(BuildContext context) {
    final isLogin = _mode == _AuthMode.login;
    final isSignup = _mode == _AuthMode.register;
    final isCode = _mode == _AuthMode.verify || _mode == _AuthMode.mfa;
    final title = switch (_mode) {
      _AuthMode.login => _s('signIn'),
      _AuthMode.register => _s('signUp'),
      _AuthMode.verify => 'Vérifier l’adresse e-mail',
      _AuthMode.forgot => 'Réinitialiser le mot de passe',
      _AuthMode.mfa => 'Double authentification',
    };
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
              children: [
                Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: TamusniPalette.blue.withValues(alpha: .1),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(
                        Icons.auto_awesome,
                        color: TamusniPalette.blue,
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Text(
                      'TAMUSNI',
                      style: TextStyle(
                        fontSize: 20,
                        letterSpacing: 1.2,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const Spacer(),
                    _LanguagePicker(controller: c),
                  ],
                ),
                const SizedBox(height: 44),
                Text(
                  title,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: -.5,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  isSignup
                      ? 'Rejoignez TAMUSNI et personnalisez votre fil.'
                      : isLogin
                      ? 'Connectez-vous pour retrouver vos articles.'
                      : isCode
                      ? 'Saisissez le code à 6 chiffres reçu par e-mail.'
                      : 'Indiquez l’adresse associée à votre compte.',
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(color: TamusniPalette.muted),
                ),
                if (_message != null) ...[
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: TamusniPalette.blue.withValues(alpha: .08),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(_message!),
                  ),
                ],
                const SizedBox(height: 24),
                Form(
                  key: _form,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (isSignup) ...[
                        TextFormField(
                          controller: _first,
                          textCapitalization: TextCapitalization.words,
                          decoration: const InputDecoration(
                            labelText: 'Prénom',
                          ),
                          validator: (v) => (v?.trim().length ?? 0) < 2
                              ? 'Saisissez votre prénom.'
                              : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _last,
                          textCapitalization: TextCapitalization.words,
                          decoration: const InputDecoration(labelText: 'Nom'),
                          validator: (v) => (v?.trim().length ?? 0) < 2
                              ? 'Saisissez votre nom.'
                              : null,
                        ),
                        const SizedBox(height: 12),
                      ],
                      if (!isCode) ...[
                        TextFormField(
                          controller: _email,
                          keyboardType: TextInputType.emailAddress,
                          autocorrect: false,
                          decoration: InputDecoration(
                            labelText: _s('email'),
                            prefixIcon: const Icon(Icons.mail_outline),
                          ),
                          validator: (v) => v == null || !v.contains('@')
                              ? 'Adresse e-mail invalide.'
                              : null,
                        ),
                        if (_mode != _AuthMode.forgot) ...[
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _password,
                            obscureText: !_showPassword,
                            decoration: InputDecoration(
                              labelText: _s('password'),
                              helperText: isSignup
                                  ? '6 caractères minimum.'
                                  : null,
                              prefixIcon: const Icon(Icons.lock_outline),
                              suffixIcon: IconButton(
                                tooltip: _showPassword
                                    ? 'Masquer le mot de passe'
                                    : 'Afficher le mot de passe',
                                onPressed: () => setState(
                                  () => _showPassword = !_showPassword,
                                ),
                                icon: Icon(
                                  _showPassword
                                      ? Icons.visibility_off_outlined
                                      : Icons.visibility_outlined,
                                ),
                              ),
                            ),
                            validator: (v) => (v?.length ?? 0) < 6
                                ? '6 caractères minimum.'
                                : null,
                          ),
                        ],
                      ],
                      if (isSignup) ...[
                        const SizedBox(height: 20),
                        Text(
                          'Vos rubriques préférées',
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 4,
                          children: AppConfig.topics
                              .map(
                                (topic) => FilterChip(
                                  label: Text(topic),
                                  selected: _topics.contains(topic),
                                  onSelected: (selected) => setState(() {
                                    selected
                                        ? _topics.add(topic)
                                        : _topics.remove(topic);
                                  }),
                                ),
                              )
                              .toList(),
                        ),
                        CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          value: _terms,
                          onChanged: (v) => setState(() => _terms = v ?? false),
                          title: const Text(
                            'J’accepte les conditions d’utilisation',
                            style: TextStyle(fontSize: 13),
                          ),
                        ),
                        CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          value: _sponsoredApp,
                          onChanged: (v) =>
                              setState(() => _sponsoredApp = v ?? false),
                          title: const Text(
                            'Recevoir des annonces sponsorisées dans l’application',
                            style: TextStyle(fontSize: 13),
                          ),
                        ),
                        CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          value: _sponsoredEmail,
                          onChanged: (v) =>
                              setState(() => _sponsoredEmail = v ?? false),
                          title: const Text(
                            'Recevoir des annonces sponsorisées par e-mail',
                            style: TextStyle(fontSize: 13),
                          ),
                        ),
                      ],
                      if (isCode)
                        TextFormField(
                          controller: _code,
                          keyboardType: TextInputType.number,
                          textAlign: TextAlign.center,
                          maxLength: 6,
                          style: const TextStyle(
                            fontSize: 24,
                            letterSpacing: 8,
                            fontWeight: FontWeight.w700,
                          ),
                          decoration: const InputDecoration(
                            labelText: 'Code de vérification',
                            counterText: '',
                          ),
                          validator: (v) =>
                              v?.length == 6 ? null : 'Entrez les 6 chiffres.',
                        ),
                      if (isLogin)
                        Align(
                          alignment: AlignmentDirectional.centerEnd,
                          child: TextButton(
                            onPressed: () {
                              setState(() {
                                _mode = _AuthMode.forgot;
                                _message = null;
                              });
                            },
                            child: Text(_s('forgot')),
                          ),
                        ),
                      const SizedBox(height: 10),
                      SizedBox(
                        height: 50,
                        child: FilledButton(
                          onPressed: _working ? null : _submit,
                          child: _working
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : Text(switch (_mode) {
                                  _AuthMode.login => _s('signIn'),
                                  _AuthMode.register => _s('signUp'),
                                  _AuthMode.verify => 'Confirmer mon e-mail',
                                  _AuthMode.forgot => 'Envoyer le lien',
                                  _AuthMode.mfa => 'Vérifier le code',
                                }),
                        ),
                      ),
                      if (isCode && _mode == _AuthMode.verify)
                        Align(
                          alignment: Alignment.center,
                          child: TextButton(
                            onPressed: _working ? null : _resend,
                            child: const Text('Renvoyer le code'),
                          ),
                        ),
                      if (isLogin) ...[
                        const SizedBox(height: 12),
                        OutlinedButton.icon(
                          onPressed: _working ? null : _google,
                          icon: const Icon(Icons.g_mobiledata, size: 28),
                          label: const Text('Continuer avec Google'),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 22),
                if (_mode == _AuthMode.login || _mode == _AuthMode.register)
                  Center(
                    child: Wrap(
                      alignment: WrapAlignment.center,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          isLogin
                              ? 'Vous n’avez pas de compte ?'
                              : 'Vous avez déjà un compte ?',
                        ),
                        TextButton(
                          onPressed: () => setState(() {
                            _mode = isLogin
                                ? _AuthMode.register
                                : _AuthMode.login;
                            _message = null;
                          }),
                          child: Text(isLogin ? _s('signUp') : _s('signIn')),
                        ),
                      ],
                    ),
                  ),
                if (_mode == _AuthMode.forgot)
                  Center(
                    child: TextButton(
                      onPressed: () => setState(() => _mode = _AuthMode.login),
                      child: Text(_s('signIn')),
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

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key, required this.controller});
  final AppController controller;
  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _password = TextEditingController();
  final _confirmation = TextEditingController();
  bool _busy = false;
  String? _error;
  @override
  void dispose() {
    _password.dispose();
    _confirmation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 500),
          child: ListView(
            padding: const EdgeInsets.all(24),
            shrinkWrap: true,
            children: [
              const Text(
                'TAMUSNI',
                style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 28),
              Text(
                'Choisir un nouveau mot de passe',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _password,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Nouveau mot de passe',
                  helperText: '6 caractères minimum.',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _confirmation,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Confirmer le mot de passe',
                ),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: _busy
                    ? null
                    : () async {
                        setState(() {
                          _busy = true;
                          _error = null;
                        });
                        try {
                          await widget.controller.resetPassword(
                            widget.controller.resetToken ?? '',
                            _password.text,
                            _confirmation.text,
                          );
                        } catch (e) {
                          setState(() => _error = e.toString());
                        } finally {
                          if (mounted) setState(() => _busy = false);
                        }
                      },
                child: Text(
                  _busy
                      ? 'Enregistrement…'
                      : 'Enregistrer le nouveau mot de passe',
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _LanguagePicker extends StatelessWidget {
  const _LanguagePicker({required this.controller});
  final AppController controller;
  @override
  Widget build(BuildContext context) => PopupMenuButton<String>(
    tooltip: AppStrings.get('language', controller.locale),
    initialValue: controller.locale,
    onSelected: controller.setLocale,
    itemBuilder: (_) => const [
      PopupMenuItem(value: 'fr', child: Text('Français')),
      PopupMenuItem(value: 'ar', child: Text('العربية')),
      PopupMenuItem(value: 'en', child: Text('English')),
      PopupMenuItem(value: 'es', child: Text('Español')),
      PopupMenuItem(value: 'pt', child: Text('Português')),
    ],
    child: Padding(
      padding: const EdgeInsets.all(10),
      child: Text(
        controller.locale.toUpperCase(),
        style: const TextStyle(
          fontWeight: FontWeight.w700,
          color: TamusniPalette.blue,
        ),
      ),
    ),
  );
}
