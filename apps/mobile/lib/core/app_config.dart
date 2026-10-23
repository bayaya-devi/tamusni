import 'package:flutter/material.dart';

class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'TAMUSNI_API_URL',
    defaultValue: 'https://tamusni.science',
  );
  static const appScheme = 'com.abtechnologies.tamusni';
  static const firebaseApiKey = String.fromEnvironment(
    'TAMUSNI_FIREBASE_API_KEY',
  );
  static const firebaseAppId = String.fromEnvironment(
    'TAMUSNI_FIREBASE_APP_ID',
  );
  static const firebaseSenderId = String.fromEnvironment(
    'TAMUSNI_FIREBASE_SENDER_ID',
  );
  static const firebaseProjectId = String.fromEnvironment(
    'TAMUSNI_FIREBASE_PROJECT_ID',
  );
  static const cachedContentLimit = 30;
  static const supportedLocales = <Locale>[
    Locale('fr'),
    Locale('ar'),
    Locale('en'),
    Locale('es'),
    Locale('pt'),
  ];
  static const topics = <String>[
    'Intelligence artificielle',
    'Innovation',
    'Robotique',
    'Cybersécurité',
    'Espace',
  ];
}

class TamusniPalette {
  static const night = Color(0xFF111A2E);
  static const blue = Color(0xFF2563EB);
  static const white = Color(0xFFF8FAFC);
  static const silver = Color(0xFFBFC7D5);
  static const muted = Color(0xFF667085);
  static const surfaceDark = Color(0xFF19243A);
  static const border = Color(0xFFE2E7EE);
}

class AppStrings {
  static const _values = <String, Map<String, String>>{
    'tagline': {
      'fr': 'Technologies • Sciences • Futur',
      'ar': 'التكنولوجيا • العلوم • المستقبل',
      'en': 'Technology • Science • Future',
      'es': 'Tecnología • Ciencia • Futuro',
      'pt': 'Tecnologia • Ciência • Futuro',
    },
    'welcome': {
      'fr': 'L’actualité qui éclaire demain.',
      'ar': 'أخبار تُنير المستقبل.',
      'en': 'News that illuminates tomorrow.',
      'es': 'La actualidad que ilumina el mañana.',
      'pt': 'Notícias que iluminam o amanhã.',
    },
    'continue': {
      'fr': 'Continuer',
      'ar': 'متابعة',
      'en': 'Continue',
      'es': 'Continuar',
      'pt': 'Continuar',
    },
    'skip': {
      'fr': 'Passer',
      'ar': 'تخطي',
      'en': 'Skip',
      'es': 'Saltar',
      'pt': 'Saltar',
    },
    'next': {
      'fr': 'Suivant',
      'ar': 'التالي',
      'en': 'Next',
      'es': 'Siguiente',
      'pt': 'Seguinte',
    },
    'signIn': {
      'fr': 'Me connecter',
      'ar': 'تسجيل الدخول',
      'en': 'Sign in',
      'es': 'Iniciar sesión',
      'pt': 'Entrar',
    },
    'signUp': {
      'fr': 'Créer un compte',
      'ar': 'إنشاء حساب',
      'en': 'Create account',
      'es': 'Crear cuenta',
      'pt': 'Criar conta',
    },
    'email': {
      'fr': 'Adresse e-mail',
      'ar': 'البريد الإلكتروني',
      'en': 'Email address',
      'es': 'Correo electrónico',
      'pt': 'E-mail',
    },
    'password': {
      'fr': 'Mot de passe',
      'ar': 'كلمة المرور',
      'en': 'Password',
      'es': 'Contraseña',
      'pt': 'Palavra-passe',
    },
    'forgot': {
      'fr': 'Mot de passe oublié ?',
      'ar': 'نسيت كلمة المرور؟',
      'en': 'Forgot password?',
      'es': '¿Olvidaste tu contraseña?',
      'pt': 'Esqueceu a palavra-passe?',
    },
    'home': {
      'fr': 'Accueil',
      'ar': 'الرئيسية',
      'en': 'Home',
      'es': 'Inicio',
      'pt': 'Início',
    },
    'explore': {
      'fr': 'Explorer',
      'ar': 'استكشف',
      'en': 'Explore',
      'es': 'Explorar',
      'pt': 'Explorar',
    },
    'favorites': {
      'fr': 'Favoris',
      'ar': 'المفضلة',
      'en': 'Saved',
      'es': 'Guardados',
      'pt': 'Guardados',
    },
    'profile': {
      'fr': 'Profil',
      'ar': 'الملف الشخصي',
      'en': 'Profile',
      'es': 'Perfil',
      'pt': 'Perfil',
    },
    'search': {
      'fr': 'Rechercher',
      'ar': 'بحث',
      'en': 'Search',
      'es': 'Buscar',
      'pt': 'Pesquisar',
    },
    'latest': {
      'fr': 'À la une',
      'ar': 'في الواجهة',
      'en': 'Top stories',
      'es': 'Destacados',
      'pt': 'Destaques',
    },
    'popular': {
      'fr': 'Les plus lus',
      'ar': 'الأكثر قراءة',
      'en': 'Most read',
      'es': 'Más leídos',
      'pt': 'Mais lidos',
    },
    'offline': {
      'fr': 'Hors ligne · contenus enregistrés',
      'ar': 'دون اتصال · محتوى محفوظ',
      'en': 'Offline · saved content',
      'es': 'Sin conexión · contenido guardado',
      'pt': 'Offline · conteúdo guardado',
    },
    'noContent': {
      'fr': 'Aucun contenu disponible pour le moment.',
      'ar': 'لا يوجد محتوى متاح حالياً.',
      'en': 'No content is available right now.',
      'es': 'No hay contenido disponible ahora.',
      'pt': 'Não há conteúdo disponível neste momento.',
    },
    'error': {
      'fr': 'Une erreur est survenue. Réessayez.',
      'ar': 'حدث خطأ. حاول مرة أخرى.',
      'en': 'Something went wrong. Please try again.',
      'es': 'Se produjo un error. Inténtalo de nuevo.',
      'pt': 'Ocorreu um erro. Tente novamente.',
    },
    'contribute': {
      'fr': 'Contribuer',
      'ar': 'ساهم',
      'en': 'Contribute',
      'es': 'Colaborar',
      'pt': 'Contribuir',
    },
    'submissions': {
      'fr': 'Mes contributions',
      'ar': 'مساهماتي',
      'en': 'My submissions',
      'es': 'Mis contribuciones',
      'pt': 'As minhas contribuições',
    },
    'admin': {
      'fr': 'Administration',
      'ar': 'الإدارة',
      'en': 'Administration',
      'es': 'Administración',
      'pt': 'Administração',
    },
    'notifications': {
      'fr': 'Notifications',
      'ar': 'الإشعارات',
      'en': 'Notifications',
      'es': 'Notificaciones',
      'pt': 'Notificações',
    },
    'language': {
      'fr': 'Langue',
      'ar': 'اللغة',
      'en': 'Language',
      'es': 'Idioma',
      'pt': 'Idioma',
    },
    'theme': {
      'fr': 'Apparence',
      'ar': 'المظهر',
      'en': 'Appearance',
      'es': 'Apariencia',
      'pt': 'Aparência',
    },
    'light': {
      'fr': 'Clair',
      'ar': 'فاتح',
      'en': 'Light',
      'es': 'Claro',
      'pt': 'Claro',
    },
    'dark': {
      'fr': 'Sombre',
      'ar': 'داكن',
      'en': 'Dark',
      'es': 'Oscuro',
      'pt': 'Escuro',
    },
    'system': {
      'fr': 'Système',
      'ar': 'النظام',
      'en': 'System',
      'es': 'Sistema',
      'pt': 'Sistema',
    },
    'logout': {
      'fr': 'Déconnexion',
      'ar': 'تسجيل الخروج',
      'en': 'Sign out',
      'es': 'Cerrar sesión',
      'pt': 'Sair',
    },
    'retry': {
      'fr': 'Réessayer',
      'ar': 'إعادة المحاولة',
      'en': 'Retry',
      'es': 'Reintentar',
      'pt': 'Tentar novamente',
    },
  };

  static String get(String key, String locale) =>
      _values[key]?[locale] ?? _values[key]?['fr'] ?? key;
}
