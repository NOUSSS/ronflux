# Fiche Chrome Web Store

Tout ce qu'il faut coller dans le tableau de bord développeur du Chrome Web Store
(https://chrome.google.com/webstore/devconsole) pour publier Ronflux en « non répertorié ». Le
paquet à envoyer est `dist/publication/telecharger/ronflux-chrome.zip` (après `release.ps1`), le
même fichier que celui proposé sur le site pour le mode développeur.

## Paquet

- Onglet « Paquet » → « Importer un nouveau paquet » → `ronflux-chrome.zip`.
- Chaque nouvelle version : même opération, puis « Envoyer pour examen ». Le numéro de version
  vient du manifeste et doit augmenter à chaque envoi (c'est `release.ps1` qui le monte).

## Fiche du Chrome Web Store

**Langue** : français.

**Description courte** : reprise automatiquement du champ `description` du manifeste (113
caractères, limite 132) :

```
Bloque les publicités vidéo (pre-roll et mid-roll) des lives Twitch en basculant sur un flux de secours sans pub.
```

**Description** :

```
Ronflux bloque les publicités vidéo (pre-roll et mid-roll) des lives Twitch.

Twitch insère ses publicités directement dans le flux vidéo du live : un bloqueur qui filtre par domaine ne peut pas les retirer. Ronflux agit dans le lecteur. Quand le live contient une publicité, il demande à Twitch le même live pour un autre type de lecteur qui n'en reçoit pas, à la même qualité, et le lecteur continue sur ce flux le temps de la publicité. Il revient ensuite au flux d'origine.

Si aucun flux sans publicité n'est disponible, le lecteur est masqué et le son coupé jusqu'à la fin de la publicité.

• Lives Twitch uniquement : pas les rediffusions ni les clips.
• Aucune donnée collectée, aucun compte, aucun serveur tiers : tout se passe dans votre navigateur, entre vous et Twitch.
• Quelques domaines de bannières et de mesure publicitaire sont aussi bloqués, seulement sur twitch.tv.

Pendant une publicité, la qualité peut baisser si le flux de secours ne propose pas la qualité d'origine, et le lecteur se recharge brièvement à la fin.

Twitch Turbo et les abonnements aux chaînes sont les moyens officiels de ne pas voir de publicités, et ils rémunèrent les streamers.

Ronflux n'est ni affilié à Twitch ni approuvé par Twitch.
```

**Catégorie** : au choix, dans la famille divertissement.

**Visuels** : `node tools/visuels-store.mjs <adresse du site>` les tire du logo et du site
dans `dist/store/` (à refaire après un changement de logo ou de page d'accueil) :

- `icone-128.png` : icône de la fiche, le logo en 96 × 96 avec 16 px de marge transparente ;
- `capture-1-1280x800.png` et `capture-2-1280x800.png` : le haut de la page d'accueil (la
  bande, au milieu d'une pub) et le relevé d'une heure de live ;
- `vignette-440x280.png` : petite vignette promotionnelle.

**Site web** : l'adresse du site (`siteUrl` de `distribution.json`).

## Pratiques de confidentialité

**Objectif unique** :

```
Bloquer les publicités vidéo des lives Twitch en remplaçant, le temps d'une publicité, le flux du live par un flux sans publicité fourni par Twitch.
```

**Justification de declarativeNetRequest** :

```
Bloque, uniquement pour les requêtes émises par les pages twitch.tv, huit domaines de bannières et de mesure publicitaire (edge.ads.twitch.tv, amazon-adsystem.com, imasdk.googleapis.com, doubleclick.net, adsafeprotected.com, moatads.com, scorecardresearch.com, pubmatic.com). Les règles sont statiques, incluses dans l'extension (rules.json), et ne s'appliquent à aucun autre site.
```

**Justification de l'autorisation d'accès à l'hôte** (`*://*.twitch.tv/*`) :

```
Le script de contenu doit s'exécuter dans les pages twitch.tv dès le début de leur chargement pour envelopper le Web Worker du lecteur vidéo : c'est là que les playlists du live sont lues, et que celles qui contiennent une publicité sont remplacées par celles d'un flux sans publicité. L'extension n'agit sur aucun autre site.
```

**Utilisez-vous du code distant ?** Non.

```
Tout le code de l'extension est dans le paquet. Le script de contenu exécute le worker du lecteur que la page Twitch charge elle-même, en y ajoutant le code de l'extension ; il ne télécharge et n'exécute aucun autre code.
```

**Utilisation des données** : ne cocher aucune catégorie. Ronflux ne collecte, ne stocke et
n'envoie aucune donnée : pas de compte, pas de statistiques, aucune requête vers un autre serveur
que ceux de Twitch, que la page interroge déjà.

Cocher les trois attestations :

- je ne vends ni ne transfère les données des utilisateurs à des tiers, en dehors des cas
  d'utilisation approuvés ;
- je n'utilise ni ne transfère les données des utilisateurs à des fins sans rapport avec
  l'objectif unique de mon article ;
- je n'utilise ni ne transfère les données des utilisateurs pour déterminer leur solvabilité ou
  pour accorder des prêts.

**Règles de confidentialité** : aucune URL n'est exigée quand aucune donnée n'est collectée. Si
le formulaire en demande une, donner une page du site qui reprend le paragraphe « Utilisation des
données » ci-dessus.

## Distribution

- **Visibilité** : non répertoriée. L'extension n'apparaît ni dans la recherche ni dans les
  catégories, elle s'installe par le lien direct de sa fiche
  (`https://chromewebstore.google.com/detail/<identifiant>`), à mettre sur le site une fois
  l'article accepté.
- **Régions** : toutes.
- **Prix** : gratuit.

Brave et Edge installent directement depuis le Chrome Web Store (Edge demande d'autoriser les
extensions d'autres boutiques) ; Opera passe par son module « Install Chrome Extensions ».
