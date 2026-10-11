import 'package:flutter/material.dart';

import '../core/app_config.dart';
import '../state/app_controller.dart';

class IntroScreen extends StatefulWidget {
  const IntroScreen({super.key, required this.controller});
  final AppController controller;
  @override
  State<IntroScreen> createState() => _IntroScreenState();
}

class _IntroScreenState extends State<IntroScreen> {
  final _page = PageController();
  int _index = 0;
  final _titles = const [
    'L’actualité qui éclaire demain.',
    'Comprendre les transformations.',
    'Des formats faits pour vous.',
  ];
  final _descriptions = const [
    'TAMUSNI explore les technologies, les sciences et les idées qui façonnent notre avenir.',
    'Intelligence artificielle, robotique, espace, cybersécurité et innovation : les sujets qui comptent, expliqués avec clarté.',
    'Brèves pour aller à l’essentiel, articles pour approfondir, rencontres et vidéos pour découvrir autrement.',
  ];
  final _icons = const [
    Icons.auto_awesome_outlined,
    Icons.public_outlined,
    Icons.menu_book_outlined,
  ];

  Future<void> _finish() async {
    await widget.controller.finishIntro();
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 18, 24, 24),
          child: Column(
            children: [
              Row(
                children: [
                  const Spacer(),
                  TextButton(
                    onPressed: _finish,
                    child: Text(
                      AppStrings.get('skip', widget.controller.locale),
                    ),
                  ),
                ],
              ),
              Expanded(
                child: PageView.builder(
                  controller: _page,
                  onPageChanged: (value) => setState(() => _index = value),
                  itemCount: _titles.length,
                  itemBuilder: (context, index) => AnimatedSwitcher(
                    duration: const Duration(milliseconds: 280),
                    child: Column(
                      key: ValueKey(index),
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (index == 0)
                          Text(
                            'TAMUSNI',
                            style: TextStyle(
                              fontSize: 37,
                              letterSpacing: 2.1,
                              fontWeight: FontWeight.w700,
                              color: dark
                                  ? TamusniPalette.white
                                  : TamusniPalette.night,
                            ),
                          )
                        else
                          Container(
                            width: 76,
                            height: 76,
                            decoration: BoxDecoration(
                              color: TamusniPalette.blue.withValues(alpha: .1),
                              borderRadius: BorderRadius.circular(24),
                            ),
                            child: Icon(
                              _icons[index],
                              size: 36,
                              color: TamusniPalette.blue,
                            ),
                          ),
                        const SizedBox(height: 22),
                        Text(
                          index == 0
                              ? AppStrings.get(
                                  'tagline',
                                  widget.controller.locale,
                                )
                              : 'TAMUSNI · ${index == 1 ? '01' : '02'}',
                          style: TextStyle(
                            color: TamusniPalette.blue,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            letterSpacing: .5,
                          ),
                        ),
                        const SizedBox(height: 18),
                        Text(
                          _titles[index],
                          style: Theme.of(context).textTheme.headlineMedium
                              ?.copyWith(
                                fontWeight: FontWeight.w700,
                                height: 1.12,
                                letterSpacing: -.7,
                              ),
                        ),
                        const SizedBox(height: 18),
                        Text(
                          _descriptions[index],
                          style: Theme.of(context).textTheme.bodyLarge
                              ?.copyWith(
                                height: 1.65,
                                color: dark
                                    ? TamusniPalette.silver
                                    : TamusniPalette.muted,
                              ),
                        ),
                        if (index == 1) ...[
                          const SizedBox(height: 26),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children:
                                const [
                                      'IA',
                                      'Innovation',
                                      'Robotique',
                                      'Espace',
                                      'Cybersécurité',
                                      'Sciences',
                                    ]
                                    .map(
                                      (e) => Chip(
                                        label: Text(e),
                                        visualDensity: VisualDensity.compact,
                                      ),
                                    )
                                    .toList(),
                          ),
                        ],
                        if (index == 2) ...[
                          const SizedBox(height: 26),
                          const Wrap(
                            spacing: 9,
                            runSpacing: 9,
                            children: [
                              Chip(label: Text('Brèves')),
                              Chip(label: Text('Articles')),
                              Chip(label: Text('Rencontres')),
                              Chip(label: Text('Vidéos')),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  3,
                  (index) => AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    margin: const EdgeInsets.all(4),
                    width: index == _index ? 24 : 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: index == _index
                          ? TamusniPalette.blue
                          : TamusniPalette.silver,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 22),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: FilledButton(
                  onPressed: () => _index < 2
                      ? _page.nextPage(
                          duration: const Duration(milliseconds: 260),
                          curve: Curves.easeOut,
                        )
                      : _finish(),
                  child: Text(
                    AppStrings.get(
                      _index < 2 ? 'next' : 'continue',
                      widget.controller.locale,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
