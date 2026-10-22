# Garde-fous

- Aucun secret, mot de passe, token ou adresse personnelle ne doit figurer dans `automation_jobs`, les logs ou les rapports.
- Une publication et une newsletter ne sont terminées qu'après leurs contrôles respectifs.
- Une panne externe crée une reprise exponentielle plafonnée à six heures ; elle ne saute jamais l'échéance.
- Les publications distinctes conservent des clés distinctes, même lorsqu'elles sont rattrapées le même jour.
