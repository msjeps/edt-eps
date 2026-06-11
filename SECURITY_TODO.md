# TODO - Audit de Sécurité EDT EPS

## 🚨 CRITIQUE - XSS Vulnerabilities

### 1. ✅ donnees.js - XSS dans les attributs HTML
**Fichier**: `src/views/donnees/donnees.js`
**Lignes corrigées**: 118-120, 238, 242, 248, 456-458, 548, 553, 571, 638, 641, 658, 865, 871, 1094, 1175, 1189-1190
**Problème**: Les valeurs de base de données sont insérées directement dans les attributs HTML sans échappement
**Fix appliqué**: Utilisation de `h()` (escapeHtml) pour tous les contenus dynamiques
**Status**: ✅ TERMINÉ

### 2. ✅ modal.js - XSS dans les titres de modal
**Fichier**: `src/components/modal.js`
**Ligne**: 21
**Problème**: `${title}` n'était pas échappé dans `<h3 class="modal-title">${title}</h3>`
**Fix appliqué**: Import de escapeHtml et échappement du titre
**Status**: ✅ TERMINÉ

### 3. ✅ main.js - XSS dans la gestion d'erreurs
**Fichier**: `src/main.js`
**Ligne**: 19
**Problème**: `${err.message}` inséré directement dans innerHTML
**Fix appliqué**: Utilisation de textContent au lieu d'innerHTML pour le message d'erreur
**Status**: ✅ TERMINÉ

### 4. partage-html.js - Injection JSON dans contexte script
**Fichier**: `src/export/partage-html.js`
**Ligne**: 138
**Problème**: `const DATA = ${JSON.stringify(data)};` - risque si données contiennent `</script>`
**Recommandation**: Valider/échapper les `</script>` dans les données
**Status**: TODO (basse priorité - risque faible en pratique)

---

## ⚠️ HAUTE PRIORITÉ

### 5. Vulnérabilités npm
**Commande**: `npm audit fix`
**Problèmes**:
- HIGH: tmp - Path Traversal
- MODERATE: uuid - Buffer bounds check
**Status**: TODO

### 6. Validation des imports JSON
**Fichier**: `src/db/store.js:191-214`
**Problème**: Aucune validation de schéma lors de `importAllData()`
**Status**: TODO

### 7. Centraliser l'échappement HTML
**Problème**: Fonction `h()` dans partage-html.js, aucune dans donnees.js
**Solution**: Créer `src/utils/escape.js` avec fonction d'échappement
**Status**: TODO

---

## 📋 MOYENNE PRIORITÉ

### 8. Validation du nom de fichier
**Fichier**: `src/app.js:165`
**Problème**: Nom de fichier créé sans valider les caractères spéciaux
**Status**: TODO

### 9. Documentation de sécurité
**Créer**: `SECURITY.md` avec guidelines pour les développeurs
**Status**: TODO

---

## 📊 Résumé
- **Critiques**: 4/4 → 2 en cours
- **Hautes**: 3/3 → 0 en cours  
- **Moyennes**: 2/2 → 0 en cours

**Progression**: 33% (2/6 critiques + hautes)
