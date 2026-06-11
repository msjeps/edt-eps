# SECURITY.md — EDT EPS

## Rapporter une faille de sécurité

**Ne pas** ouvrir de public issue. Contactez-nous à **u2443690962@gmail.com** avec :
- Description détaillée de la vulnérabilité
- Étapes de reproduction
- Impact potentiel
- Suggestions de correctif (optionnel)

Nous répondrons dans les 48h et publierons un patch dans les 7 jours.

---

## Modèle de menace

### Assets critiques
- **Emploi du temps** : données structurées, export public vers Direction des Sports
- **Données enseignants** : ORS, indisponibilités, préférences
- **Réservations installations** : coordinations avec tiers (mairie, Direction Sports)
- **Données de transport** : détails trajets, effectifs classes

### Vecteurs d'attaque principaux
1. **XSS (Cross-Site Scripting)** : injection via données importées, rendu DOM
2. **Injection CSV/Excel** : formules malveillantes dans exports
3. **Path traversal** : File System Access API (sauvegarde dossiers projet)
4. **CSRF** : non applicable (no backend)
5. **Données sensibles en clair** : localStorage, IndexedDB non chiffré par défaut

### Surface d'attaque
- **Imports** : Excel, JSON (wizard, import-utils.js)
- **Exports** : CSV (Mairie, Transport), PDF, Excel (potentiel injection formule)
- **File System Access API** : mémorisation dossier projet, lecture/écriture fichiers
- **Service Worker** : cache, mise en cache de contenu non validé

---

## Vulnérabilités corrigées

### ✅ XSS critiques (11/06/2026)
**Commit:** `2ddf47a 🔒 Corrige vulnérabilités XSS critiques`

**Problèmes identifiés :**
- `innerHTML` direct avec données utilisateur (noms, descriptions)
- Pas de sanitization des champs texte dans le DOM
- Noms profs/classes/activités vulnérables à l'injection JS
- Contenu modal non échappé

**Corrections appliquées :**
- ✅ Remplacer `innerHTML` par `textContent` pour du texte pur
- ✅ Utiliser `createElement()` + `appendChild()` pour structures dynamiques
- ✅ Sanitizer XSS sur les champs nécessitant du HTML (notes avec balises)
- ✅ Audit complet des 50+ appels DOM dynamiques
- ✅ Template literals échappées via `DOMPurify` (si HTML nécessaire)

**Fichiers concernés :**
- `src/views/donnees/donnees.js` → listes tableaux
- `src/views/edt/grid.js` → rendu blocs séances
- `src/views/programmation/programmation.js` → matrice éditable
- `src/components/modal.js` → modales génériques
- `src/export/pdf-edt.js` → contenu PDF

**Vérification :**
```bash
# Chercher les innerHTML dangereux
grep -rn "innerHTML.*[+]" src/ --include="*.js"
grep -rn "insertAdjacentHTML" src/ --include="*.js"
```

---

## Bonnes pratiques par module

### 📥 Imports (`src/import/`)

#### Excel import (`excel-import.js`, `disponibilites.js`)
- ✅ Valider structure fichier AVANT parsing (nombre colonnes, en-têtes)
- ✅ Limiter taille fichier (max 5MB)
- ✅ Sanitizer données : trim, lowercaseCase, listes de valeurs autorisées
- ✅ Rejeter si champs inconnus → afficher erreur
- ❌ Ne pas faire confiance aux en-têtes (vérifier données elles-mêmes)

**Exemple sûr :**
```javascript
// Bon : valider avant d'utiliser
const valideLieu = (nom) => /^[a-zÀ-ÿ\s\-']+$/i.test(nom?.trim());
const nom = input.trim();
if (!valideLieu(nom)) throw new Error(`Lieu invalide : ${nom}`);

// Mauvais : utiliser directement
const nom = input; // Peut contenir <script>
```

#### JSON import (`import-utils.js`)
- ✅ Parser JSON avec `JSON.parse()` + try-catch
- ✅ Valider schéma (voir `schema-validator.js`)
- ✅ Rejeter IDs système (id, createdAt, hashes)
- ✅ Limiter nombre d'entités (max 1000 professeurs, etc.)
- ✅ Logs d'audit : qui, quand, combien d'éléments importés

**Considération spéciale :** les fichiers `.json` chiffrés ne peuvent pas être validés avant déchiffrement. Déchiffrer → valider → charger.

### 📤 Exports (`src/export/`)

#### CSV (Mairie, Transport)
- ✅ Échapper guillemets et nouvelles lignes (RFC 4180)
- ✅ Préfixer champs suspects par `'` (Excel magic prevention)
  ```javascript
  // Malveillant : =1+1 est une formule
  "=1+1"
  
  // Sûr :
  "'=1+1"  // Excel l'affiche comme texte
  ```
- ❌ Ne pas injecter de balises HTML/CSV qui s'évalueraient côté Excel

#### PDF (`pdf-edt.js`)
- ✅ Utiliser jsPDF + contenu texte validé
- ✅ Limiter taille PDF (surveillance mémoire JS)
- ✅ Pas d'URL externes (éviter SSRF si générateur côté serveur un jour)

#### Excel (`excel-edt.js`)
- ✅ Utiliser ExcelJS (pas SheetJS pour éviter vulnérabilités)
- ✅ Préfixer formules par `'`
- ✅ Limiter lignes/colonnes (surveillance mémoire)

### 🗄️ Base de données (`src/db/`)

#### IndexedDB (Dexie.js)
- ✅ Pas de chiffrement par défaut → données sensibles en clair côté client
- ✅ Chrome DevTools accès complet (`F12` → Application → IndexedDB)
- ✅ Service Worker peut accéder DB → vérifier `sw.js` ne fait pas de logs sensibles
- ✅ localStorage pour tokens, sessions → exposé pareil
- **Recommandation :** si besoin protection, implémenter `crypto.js` pour chiffrer sensible avant stockage

#### Changelog et Snapshots
- ✅ Limiter rétention : max 20 snapshots (pile `undo.js`)
- ✅ Ne stocker que diffs, pas copies complètes (risk mémoire)
- ✅ Attention : `snapshots.js` peut exposer historique complet. Droit d'accès ?

### 🔧 File System Access API (`src/utils/filesystem.js`)

**Risque principal :** accès à dossiers projet sur machine utilisateur.

- ✅ Mémoriser un dossier unique (`EDT EPS/PROJET`) → pas d'accès récursif
- ✅ Whitelister extensions : `.json`, `.xlsx`, `.pdf`, `.csv` uniquement
- ✅ Vérifier nom fichier : pas de `../`, pas de chemin absolu
- ✅ Demander permission utilisateur explicite (Web API design)
- ❌ Ne pas automatiser dossier système (Utilisateur/Bureau/Downloads risqué)

**Fallback :** Download HTML5 si FS API non supportée → sûr.

### 🛡️ Service Worker (`sw.js`)

- ✅ Vérifier liste fichiers en cache (manifest.json, index.html, src/*)
- ✅ Pas de cache contenu utilisateur (données DB jamais en cache)
- ✅ Vérifier stratégie : network-first ou cache-first ? → network-first pour données
- ✅ Pas de logs sensibles dans console Service Worker
- ⚠️ Tester mode offline → vérifier comportement prévisible (pas de données corrompues)

---

## Dépendances & vulnérabilités

### Audit actuel (11/06/2026)
```bash
npm audit
```

**Dépendances critiques :**
| Lib | Risque | Mitigation |
|-----|--------|-----------|
| **Dexie.js** v4.x | Faible | Lib stable, UI native, peu d'attack surface |
| **ExcelJS** | Moyen | Parser XML → validation stricte fichiers |
| **jsPDF** | Moyen | Génération côté client → OK, pas de serveur |
| **DOMPurify** | Critique (si utilisé) | Keepr à jour, whitelist tags mini |
| **SortableJS** | Faible | Drag-drop, pas d'accès données |

**À faire :**
- ✅ Remplacer SheetJS par ExcelJS (0 CVE vs 3+)
- ✅ Ajouter DOMPurify si rendu HTML (notes avec balises)
- ⚠️ Pas de TypeScript/Babel → manuellement revoir imports

### Scanning
```bash
# Vérifier vulnérabilités
npm audit fix --force  # Prudence : test après

# Vérifier dépendances ghost
npm ls  # Lister tous les transitive deps

# Vérifier tailles imports
npx bundlesize
```

---

## Données sensibles

### Ce qui est stocké localement
| Donnée | Sensibilité | Stockage | Protection |
|--------|-------------|---------|-----------|
| Emploi du temps | Moyen | IndexedDB | Clair |
| Noms profs/classes | Moyen | IndexedDB | Clair |
| ORS | Élevé | IndexedDB | **Chiffrer** |
| Indisponibilités | Moyen | IndexedDB | Clair |
| Réservations mairie | Moyen | IndexedDB | Clair |
| Transport | Faible | IndexedDB | Clair |
| Historique (changelog) | Moyen | IndexedDB | Clair |
| Snapshots | Moyen | IndexedDB | Clair |

### Recommandations
1. **ORS = données RH sensibles** → chiffrer avant stockage (`crypto.js`)
2. **Exports = données publiques** → pas besoin protection, mais auditer qui accède
3. **localStorage** → jamais stocker sensible ici (plaintext dans DevTools)
4. **Snapshots** → limiter rétention, audit qui les crée/restaure

### Conformité (données de mineurs potentiels)
- ❌ Pas de RGPD implémenté actuellement
- ⚠️ Données enseignants/classes = données de mineurs (si collège)
- **À implémenter** : droit à l'oubli, chiffrement, audit trails, export RGPD

---

## Checklist sécurité pour PR

Avant de merger un PR :

- [ ] **XSS** : Pas d'`innerHTML` avec données user ? Utiliser `textContent` ou `createElement()` ?
- [ ] **Injection** : Imports validés ? Champs obligatoires vérifiés ?
- [ ] **CSV/Excel** : Formules préfixées par `'` ? Guillemets échappés ?
- [ ] **File System** : Paths validés ? Extensions whitelistées ?
- [ ] **DB** : Pas de données sensibles en clair ? Audit trails logs ?
- [ ] **Dépendances** : Nouvelles libs ? Vérifier `npm audit` ?
- [ ] **Service Worker** : Cache pas de données user ? Logs pas sensibles ?
- [ ] **Tests** : Import/export mauvais fichiers → comportement prévisible ?

---

## Procédure incident

### Si une vulnérabilité est détectée

1. **Ne pas publier** sur les issues GitHub
2. **Email immédiat** à u2443690962@gmail.com avec détails
3. **Patch en 7 jours max** → release patch version
4. **Changelog** → documenter fix (sans détails exploitable)
5. **Post-mortem** : comment ça a passé les reviews ? Améliorer checklist ?

### Exemple disclosure
```
Subject: [SECURITY] XSS in ensemble de validation

Description:
- Vecteur : import JSON avec champ "nomActivite"
- Impact : exécution JS arbitraire lors édition programmation
- PoC : [reproduction simple]
- Fix : sanitizer DOMPurify ou utiliser textContent

Merci,
[Name]
```

---

## Ressources & références

### XSS Prevention
- **OWASP Top 10** : https://owasp.org/www-project-top-ten/
- **DOM Security** : https://owasp.org/www-community/attacks/DOM_Based_XSS
- **DOMPurify** : https://github.com/cure53/DOMPurify

### CSV/Excel Safety
- **RFC 4180** (CSV) : https://tools.ietf.org/html/rfc4180
- **Excel Formula Injection** : https://owasp.org/www-community/attacks/CSV_Injection

### IndexedDB
- **Dexie.js docs** : https://dexie.org/
- **Chrome DevTools** : https://developer.chrome.com/docs/devtools/application/storage/

### File System Access
- **Web API** : https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
- **Security** : https://www.w3.org/TR/file-system-access/#privacy

---

## Historique sécurité

| Date | Issue | Status | Détails |
|------|-------|--------|---------|
| 11/06/2026 | XSS critiques | ✅ Fixed | Commit 2ddf47a : sanitization DOM |
| 11/06/2026 | SheetJS vulnérabilités | ✅ Fixed | Commit remplacer xlsx par exceljs |
| - | RGPD/droit oubli | ⏳ Backlog | Données mineurs potentiels |
| - | Chiffrement ORS | ⏳ Backlog | crypto.js existe, pas intégré |

---

**Dernière mise à jour :** 11/06/2026  
**Mainteneur :** EDT EPS Dev Team
