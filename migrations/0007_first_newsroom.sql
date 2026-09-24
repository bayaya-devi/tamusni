UPDATE content_items SET author_name='Rédiger par IA' WHERE author_name='Rédaction TAMUSNI';

INSERT OR IGNORE INTO tags(id,slug,name) VALUES
('tag-esa','esa','ESA'),('tag-mistral','mistral-ai','Mistral AI'),('tag-enisa','enisa','ENISA'),
('tag-webb','james-webb','James Webb'),('tag-brown-dwarfs','naines-brunes','Naines brunes'),
('tag-lithium','lithium-ion','Lithium-ion'),('tag-nasa','nasa','NASA'),('tag-launchers','lanceurs','Lanceurs');

INSERT OR IGNORE INTO content_items(id,slug,type,status,title,excerpt,body,summary,category,author_name,cover_url,fact_check_status,published_at,created_at,updated_at) VALUES
('news-esa-mistral-2026','esa-mistral-ia-spatial-europeenne','article','published','L’ESA et Mistral veulent installer une IA européenne au cœur des missions spatiales','L’accord signé en septembre ouvre un cadre de coopération sur l’observation de la Terre, l’ingénierie et l’aide à la décision. Il ne constitue pas encore l’annonce d’un nouveau produit commercial.','L’Agence spatiale européenne et Mistral ont annoncé le 23 septembre 2026 une lettre d’intention destinée à approfondir leur coopération dans l’intelligence artificielle. Le document avait été signé à Paris le 16 septembre par Josef Aschbacher, directeur général de l’ESA, et Arthur Mensch, directeur général de Mistral.

Le périmètre annoncé couvre le traitement de grands volumes de données d’observation de la Terre, l’analyse d’ingénierie, l’accès aux connaissances et l’automatisation de tâches répétitives. L’ESA indique que les outils envisagés doivent rester au service de décisions techniques pilotées par des humains.

La souveraineté technologique est au centre du communiqué. Les deux organisations disent vouloir étudier des déploiements sur des infrastructures européennes, avec des exigences de sécurité, de résilience, de traçabilité, d’auditabilité et de protection des informations sensibles.

Cette coopération ne part pas de zéro. L’ESA cite Orbit, un assistant sécurisé destiné à l’ingénierie, ainsi qu’EVE, un outil spécialisé dans l’observation de la Terre développé avec des partenaires européens. La lettre d’intention fixe cependant un cadre d’exploration : elle ne donne ni calendrier de déploiement général, ni budget, ni mesure de performance.

Le point à suivre sera donc le passage des expérimentations aux usages opérationnels. Les garanties annoncées devront être évaluées sur des systèmes concrets, particulièrement lorsque les modèles interviennent dans une chaîne de décision scientifique ou de mission.','L’ESA et Mistral encadrent une coopération sur l’IA spatiale européenne. Les applications sont identifiées, mais les modalités opérationnelles restent à préciser.','Intelligence','Rédiger par IA','/images/editorial-ai-space.svg','verified','2026-09-24T09:00:00Z','2026-09-24T09:00:00Z','2026-09-24T09:00:00Z'),
('news-enisa-2026','enisa-2026-dependances-cyber-risque','article','published','Cybersécurité : l’ENISA alerte sur le risque créé par les dépendances numériques','Le rapport 2026 maintient le rançongiciel parmi les menaces les plus dommageables à court terme et place les administrations publiques en première ligne.','L’Agence de l’Union européenne pour la cybersécurité a publié le 22 septembre son panorama 2026. L’analyse porte sur des incidents et événements observés entre le 1er janvier et le 31 décembre 2025 : la date du rapport et la période étudiée ne doivent donc pas être confondues.

Selon l’ENISA, le rançongiciel reste le type d’incident ayant l’impact le plus fort à court terme. L’agence souligne aussi le poids des campagnes de déni de service menées par des groupes hacktivistes dans un contexte géopolitique tendu.

Parmi les organisations ciblées recensées, 73 % appartiennent aux catégories d’entités essentielles ou importantes définies par NIS2. L’administration publique représente 32 % des cas, devant les services aux entreprises et les transports, chacun à 8 %, puis l’industrie manufacturière à 7 % et la finance à 6 %.

Le rapport insiste sur les dépendances entre fournisseurs, services cloud, logiciels et infrastructures. Une compromission ne reste pas nécessairement limitée à son point d’entrée : elle peut se propager dans une chaîne de services et perturber des acteurs qui ne sont pas directement visés.

Ces chiffres décrivent le corpus analysé par l’ENISA ; ils ne mesurent pas l’intégralité des attaques commises en Europe. Ils fournissent néanmoins un signal opérationnel : cartographier les dépendances et préparer la continuité d’activité devient aussi important que protéger le périmètre interne.','Le rapport ENISA 2026 met en évidence le rançongiciel, les DDoS géopolitiques et la concentration des incidents sur les entités essentielles.','Cybersécurité','Rédiger par IA','/images/editorial-cyber-threat.svg','verified','2026-09-23T08:30:00Z','2026-09-23T08:30:00Z','2026-09-23T08:30:00Z'),
('news-webb-ic348','webb-ic348-naines-brunes-deux-jupiter','article','published','Webb repousse la recherche des naines brunes jusqu’à deux masses de Jupiter','Dans la région de formation stellaire IC 348, des astronomes ont identifié des objets moins massifs que ceux accessibles aux études précédentes.','L’ESA a présenté le 15 septembre 2026 une vaste image de la région de formation stellaire IC 348 obtenue avec le télescope spatial James Webb. Située à environ 1 000 années-lumière dans la constellation de Persée, cette région contient de jeunes étoiles et des objets trop peu massifs pour entretenir durablement la fusion de l’hydrogène.

L’équipe du programme d’observation 4866 recherchait précisément ces naines brunes. D’après l’ESA, les données ont permis d’identifier des objets atteignant seulement deux fois la masse de Jupiter, ce qui étend l’étude vers une gamme de masses plus faible.

Une naine brune n’est pas une planète au sens habituel du terme, même lorsque sa masse s’en rapproche. Elle se forme par l’effondrement d’un nuage de matière, comme une étoile, mais ne possède pas une masse suffisante pour devenir une étoile ordinaire.

L’enjeu scientifique dépasse l’image spectaculaire. En comparant la population d’objets de masse planétaire entre plusieurs régions, les astronomes cherchent à comprendre jusqu’où le processus de formation stellaire peut produire de petits corps isolés.

Le résultat présenté est lié à un programme scientifique précis. Il ne signifie pas que Webb a découvert une nouvelle planète habitable ni qu’il a photographié directement la naissance complète d’une étoile.','IC 348 permet à Webb d’étudier des naines brunes d’environ deux masses de Jupiter et les limites basses de la formation stellaire.','Sciences','Rédiger par IA','/images/editorial-webb-ic348.svg','verified','2026-09-16T10:00:00Z','2026-09-16T10:00:00Z','2026-09-16T10:00:00Z'),
('news-batteries-iea','lithium-ion-marche-150-milliards-aie','article','published','Lithium-ion : comment une recherche internationale est devenue un marché de 150 milliards de dollars','L’AIE retrace cinq décennies d’innovations, de politiques industrielles et de production à grande échelle derrière la batterie moderne.','Dans une analyse publiée le 7 septembre 2026, l’Agence internationale de l’énergie estime que le marché mondial des batteries lithium-ion dépasse 150 milliards de dollars. Ces batteries sont désormais utilisées dans les véhicules électriques, les réseaux, les centres de données, les drones et la robotique.

L’histoire racontée par l’AIE est internationale. Les bases scientifiques ont été développées dans des universités et laboratoires publics aux États-Unis, en Europe et au Japon après le choc pétrolier de 1973-1974. Le premier succès commercial est ensuite venu de l’électronique portable japonaise au début des années 1990.

La baisse des coûts a changé l’échelle du marché. Selon l’agence, la demande annuelle mondiale en batteries était en 2025 presque mille fois supérieure à celle de 2000, tandis que le prix moyen des cellules avait baissé de 97 % sur la même période.

La géographie industrielle a elle aussi basculé. L’AIE attribue à la Chine plus de 70 % de la production mondiale de voitures électriques et 85 % de celle des batteries lithium-ion. Les deux principaux fabricants chinois représentent à eux seuls plus de la moitié de la production mondiale.

L’agence en tire une leçon prudente : l’excellence scientifique ne suffit pas à créer une industrie compétitive. Elle doit être associée à une demande prévisible, des capitaux patients, une fabrication de précision et une politique suivie dans le temps.','Le lithium-ion est passé du laboratoire à un marché mondial de plus de 150 milliards de dollars, avec une production aujourd’hui très concentrée.','Innovation','Rédiger par IA','/images/editorial-battery.svg','verified','2026-09-08T08:00:00Z','2026-09-08T08:00:00Z','2026-09-08T08:00:00Z'),
('news-nasa-terran-r','nasa-terran-r-contrat-lancements','article','published','La NASA ajoute Terran R à son catalogue de lanceurs, sans lui attribuer encore de mission','Le véhicule de Relativity Space devient éligible aux futures commandes de l’agence dans le cadre du contrat NLS II.','La NASA a annoncé le 9 septembre 2026 l’ajout du lanceur Terran R de Relativity Space au contrat NASA Launch Services II. Cette décision rend le service de lancement éligible aux futures missions commandées par l’agence.

Il s’agit d’une entrée dans un contrat à fournisseurs multiples, et non de l’attribution d’un lancement déterminé. Le communiqué ne désigne aucune charge utile, aucune date de vol pour la NASA et aucun montant de commande associé à Terran R.

Le mécanisme d’intégration du contrat NLS II permet chaque année à de nouveaux fournisseurs de se porter candidats et aux entreprises déjà retenues d’ajouter des véhicules. La période de commande court jusqu’en juin 2030 et la période globale d’exécution jusqu’en décembre 2032.

Ces contrats peuvent servir les directions de la NASA consacrées au vol habité, aux sciences et aux technologies. L’agence peut également fournir des services de lancement à d’autres organismes publics américains, notamment la NOAA.

L’information importante est donc l’élargissement du choix futur de la NASA. Elle ne doit pas être interprétée comme une validation en vol du lanceur ni comme l’annonce d’une mission déjà financée.','Terran R rejoint le dispositif contractuel NLS II. Le lanceur peut désormais concourir pour des missions, mais aucune commande précise n’est annoncée.','Espace','Rédiger par IA','/images/editorial-launcher.svg','verified','2026-09-10T08:00:00Z','2026-09-10T08:00:00Z','2026-09-10T08:00:00Z');

INSERT OR IGNORE INTO content_sources(id,content_id,label,url,publisher,published_at,created_at) VALUES
('src-esa-mistral','news-esa-mistral-2026','ESA and Mistral strengthen cooperation on artificial intelligence','https://www.esa.int/Newsroom/Press_Releases/ESA_and_Mistral_strengthen_cooperation_on_artificial_intelligence','Agence spatiale européenne','2026-09-23','2026-09-24T09:00:00Z'),
('src-enisa-2026','news-enisa-2026','ENISA Threat Landscape 2026','https://www.enisa.europa.eu/publications/enisa-threat-landscape-2026','ENISA','2026-09-22','2026-09-23T08:30:00Z'),
('src-webb-ic348','news-webb-ic348','Webb reveals stunning panorama of star formation','https://www.esa.int/Science_Exploration/Space_Science/Webb/Webb_reveals_stunning_panorama_of_star_formation','Agence spatiale européenne','2026-09-15','2026-09-16T10:00:00Z'),
('src-iea-lithium','news-batteries-iea','The rise of lithium-ion batteries','https://www.iea.org/commentaries/the-rise-of-lithium-ion-batteries','Agence internationale de l’énergie','2026-09-07','2026-09-08T08:00:00Z'),
('src-nasa-terran','news-nasa-terran-r','NASA Adds Relativity Space’s Terran R to Launch Services Contract','https://www.nasa.gov/news-release/nasa-adds-relativity-spaces-terran-r-to-launch-services-contract/','NASA','2026-09-09','2026-09-10T08:00:00Z');

INSERT OR IGNORE INTO content_tags(content_id,tag_id) VALUES
('news-esa-mistral-2026','tag-esa'),('news-esa-mistral-2026','tag-mistral'),('news-esa-mistral-2026','tag-space'),
('news-enisa-2026','tag-enisa'),('news-enisa-2026','tag-safety'),
('news-webb-ic348','tag-webb'),('news-webb-ic348','tag-brown-dwarfs'),('news-webb-ic348','tag-space'),
('news-batteries-iea','tag-lithium'),('news-batteries-iea','tag-batteries'),('news-batteries-iea','tag-energy'),
('news-nasa-terran-r','tag-nasa'),('news-nasa-terran-r','tag-launchers'),('news-nasa-terran-r','tag-space');

INSERT OR IGNORE INTO content_timeline_events(id,content_id,event_date,title,description,position) VALUES
('tl-esa-1','news-esa-mistral-2026','2026-09-16','Signature à Paris','L’ESA et Mistral signent leur lettre d’intention.',1),
('tl-esa-2','news-esa-mistral-2026','2026-09-23','Annonce publique','L’ESA publie le cadre de coopération.',2),
('tl-bat-1','news-batteries-iea','1973-01-01','Après le choc pétrolier','Les recherches publiques sur de nouvelles batteries s’accélèrent.',1),
('tl-bat-2','news-batteries-iea','1991-01-01','Commercialisation','Les premières batteries lithium-ion commerciales arrivent sur le marché.',2),
('tl-bat-3','news-batteries-iea','2025-12-31','Changement d’échelle','La demande annuelle approche mille fois son niveau de 2000 selon l’AIE.',3);
