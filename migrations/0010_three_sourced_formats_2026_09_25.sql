INSERT OR IGNORE INTO tags(id,slug,name) VALUES
('tag-blue-origin','blue-origin','Blue Origin'),
('tag-mars-comms','communications-martiennes','Communications martiennes'),
('tag-sarsat','sarsat','SARSAT'),
('tag-rescue-beacon','balises-de-detresse','Balises de détresse'),
('tag-data-centres','centres-de-donnees','Centres de données'),
('tag-energy-factcheck','energie-et-ia','Énergie et IA');

INSERT OR IGNORE INTO content_items(
  id,slug,type,status,title,excerpt,body,summary,category,author_name,cover_url,
  fact_check_status,published_at,created_at,updated_at
) VALUES
(
  'news-mars-network-2026',
  'nasa-blue-origin-reseau-telecommunications-mars',
  'article','published',
  'BRÈVE — La NASA confie à Blue Origin le développement d’un réseau de télécommunications martien',
  'Le contrat, plafonné à environ 700 millions de dollars, prévoit la livraison d’un orbiteur de télécommunications avant la fin de 2028. Le réseau est annoncé opérationnel autour de Mars en 2030.',
  'La NASA a annoncé le 1er septembre 2026 avoir attribué à Blue Origin un contrat pour développer son futur Mars Telecommunications Network. L’objectif est de fournir des communications à haut débit et des services de navigation aux missions présentes et futures autour de Mars et à sa surface.

Le contrat est à prix ferme et sa valeur potentielle maximale est d’environ 700 millions de dollars. Blue Origin doit concevoir, développer, intégrer, lancer puis exploiter le réseau. La livraison de l’orbiteur à la NASA est attendue au plus tard le 31 décembre 2028.

L’architecture annoncée repose sur un engin spatial en orbite martienne. Il devra relayer des données scientifiques, des images, des informations de navigation et des communications critiques entre les missions.

La NASA prévoit une mise en service autour de Mars en 2030. Cette date reste un objectif de programme : le communiqué décrit un contrat et un calendrier, pas un système déjà construit ou validé en vol.

Le projet répond à l’augmentation attendue du volume de données des missions robotiques et, à plus long terme, à la préparation de l’exploration humaine de Mars.',
  'La NASA a sélectionné Blue Origin pour concevoir et exploiter un orbiteur de télécommunications martien, avec une livraison visée fin 2028 et une mise en service annoncée en 2030.',
  'Espace','Rédiger par IA','/images/editorial-mars-network.svg','verified',
  '2026-09-25T12:00:00Z','2026-09-25T12:00:00Z','2026-09-25T12:00:00Z'
),
(
  'news-sarsat-rescue-2026',
  'balises-sarsat-secours-hors-couverture-mobile',
  'article','published',
  'ANALYSE — Pourquoi les balises satellitaires restent vitales hors couverture mobile',
  'Le sauvetage de cinq personnes au large du Mississippi illustre la chaîne SARSAT : une balise de détresse, des satellites, une station au sol puis les secours.',
  'En 2024, cinq participants à une compétition de pêche se sont retrouvés à l’eau après le naufrage de leur bateau, à environ 40 miles des côtes du Mississippi. Sans réseau mobile, l’activation d’une balise de localisation personnelle a déclenché leur prise en charge par les secours.

Le récit publié par la NASA le 10 septembre 2026 permet de comprendre la chaîne technique. Une balise enregistrée émet un signal de détresse sur la fréquence dédiée de 406 MHz. Des satellites équipés pour le système SARSAT reçoivent ce signal et transmettent la position à une station au sol. Un centre de contrôle alerte ensuite les organismes de coordination des secours.

Dans ce cas précis, les cinq personnes ont été secourues par les garde-côtes américains après plus de quatre heures dans l’eau. Le téléphone présent à bord ne pouvait pas appeler faute de couverture cellulaire.

SARSAT fonctionne aux États-Unis depuis 1982 et dans un cadre international depuis 1985. La NASA indique que 62 satellites sont opérationnels, que 45 pays contribuent au dispositif et que plus de 63 000 vies ont été sauvées. Ce dernier nombre est le bilan communiqué par l’agence ; il ne s’agit pas d’un décompte vérifié indépendamment par TAMUSNI.

La leçon pratique est simple : un téléphone ne remplace pas une balise de détresse adaptée lorsque l’on s’éloigne des réseaux terrestres. Une balise ne remplace pas non plus les gilets, la préparation, l’enregistrement du matériel et un plan de sécurité.',
  'Une balise 406 MHz peut transmettre une alerte et une position par satellite lorsque le réseau mobile est absent. Le sauvetage relaté par la NASA montre le rôle concret de SARSAT.',
  'Technologies','Rédiger par IA','/images/editorial-sarsat-rescue.svg','context',
  '2026-09-25T10:00:00Z','2026-09-25T10:00:00Z','2026-09-25T10:00:00Z'
),
(
  'news-ai-electricity-factcheck-2026',
  'fact-check-ia-centres-donnees-electricite-mondiale',
  'article','published',
  'VÉRIFICATION — Les centres de données vont-ils absorber toute l’électricité mondiale ?',
  'Non. L’AIE projette environ 3 % de la demande mondiale d’électricité en 2030. Leur croissance est néanmoins rapide et peut créer de fortes contraintes locales.',
  'Verdict : non. Les projections disponibles ne montrent pas que les centres de données vont absorber toute l’électricité mondiale. Elles indiquent en revanche une hausse rapide de leur consommation et des effets locaux potentiellement importants sur les réseaux.

Dans son rapport publié le 16 avril 2026, l’Agence internationale de l’énergie estime que la demande mondiale d’électricité des centres de données a augmenté de 17 % en 2025. Celle des centres principalement consacrés à l’intelligence artificielle aurait progressé de 50 % sur la même année.

Le scénario central de l’AIE fait passer la consommation de l’ensemble des centres de données de 485 TWh en 2025 à environ 950 TWh en 2030. Cela représenterait autour de 3 % de la demande mondiale d’électricité à cette date, très loin de la totalité. La consommation des centres orientés IA triplerait sur la période.

Pourquoi l’impression d’une crise globale persiste-t-elle ? Parce qu’une moyenne mondiale masque la concentration géographique. Un grand centre de données peut demander rapidement beaucoup de puissance dans une zone où les nouvelles lignes, centrales et connexions prennent des années à construire. Les tensions peuvent donc être sévères dans certaines régions sans signifier que l’IA consomme toute l’électricité de la planète.

Ces nombres sont des projections, pas des mesures certaines de 2030. L’AIE souligne les incertitudes liées à l’efficacité des puces et des modèles, au rythme d’adoption de l’IA, aux investissements et aux contraintes d’approvisionnement. Le bon résumé est donc : part mondiale minoritaire, croissance très rapide et impacts locaux à surveiller.',
  'Le scénario central de l’AIE situe les centres de données autour de 3 % de la demande électrique mondiale en 2030. L’affirmation selon laquelle ils absorberaient toute l’électricité mondiale est fausse.',
  'Intelligence','Rédiger par IA','/images/editorial-ai-energy-check.svg','context',
  '2026-09-25T08:00:00Z','2026-09-25T08:00:00Z','2026-09-25T08:00:00Z'
);

INSERT OR IGNORE INTO content_sources(id,content_id,label,url,publisher,published_at,created_at) VALUES
('src-mars-network-nasa','news-mars-network-2026','NASA Selects Blue Origin as Mars Telecommunications Network Provider','https://www.nasa.gov/news-release/nasa-selects-blue-origin-as-mars-telecommunications-network-provider/','NASA','2026-09-01','2026-09-25T12:00:00Z'),
('src-sarsat-nasa','news-sarsat-rescue-2026','NASA’s Life-Saving Technology Where Cell Signals Can’t Go','https://www.nasa.gov/technology/tech-transfer-spinoffs/nasas-life-saving-technology-where-cell-signals-cant-go/','NASA','2026-09-10','2026-09-25T10:00:00Z'),
('src-ai-energy-iea','news-ai-electricity-factcheck-2026','Key Questions on Energy and AI — Executive summary','https://www.iea.org/reports/key-questions-on-energy-and-ai/executive-summary','Agence internationale de l’énergie','2026-04-16','2026-09-25T08:00:00Z');

INSERT OR IGNORE INTO content_tags(content_id,tag_id) VALUES
('news-mars-network-2026','tag-blue-origin'),
('news-mars-network-2026','tag-mars-comms'),
('news-mars-network-2026','tag-nasa'),
('news-sarsat-rescue-2026','tag-sarsat'),
('news-sarsat-rescue-2026','tag-rescue-beacon'),
('news-sarsat-rescue-2026','tag-nasa'),
('news-ai-electricity-factcheck-2026','tag-data-centres'),
('news-ai-electricity-factcheck-2026','tag-energy-factcheck'),
('news-ai-electricity-factcheck-2026','tag-energy');

INSERT OR IGNORE INTO content_timeline_events(id,content_id,event_date,title,description,position) VALUES
('tl-mars-network-1','news-mars-network-2026','2026-09-01','Attribution du contrat','La NASA annonce avoir sélectionné Blue Origin pour développer le réseau.',1),
('tl-mars-network-2','news-mars-network-2026','2028-12-31','Échéance de livraison','Date limite contractuelle annoncée pour livrer l’orbiteur à la NASA.',2),
('tl-mars-network-3','news-mars-network-2026','2030-12-31','Objectif de mise en service','La NASA prévoit que le réseau soit opérationnel autour de Mars en 2030.',3),
('tl-sarsat-1','news-sarsat-rescue-2026','1982-01-01','Début des opérations américaines','Le système SARSAT commence ses opérations aux États-Unis.',1),
('tl-sarsat-2','news-sarsat-rescue-2026','1985-01-01','Coopération internationale','Le dispositif devient une collaboration internationale.',2),
('tl-ai-energy-1','news-ai-electricity-factcheck-2026','2025-12-31','Point de départ mesuré','La consommation mondiale des centres de données est estimée à 485 TWh.',1),
('tl-ai-energy-2','news-ai-electricity-factcheck-2026','2030-12-31','Projection centrale de l’AIE','La consommation est projetée à environ 950 TWh, soit autour de 3 % de la demande mondiale.',2);
