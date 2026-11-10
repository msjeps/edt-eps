#!/bin/bash
# Régénère edt-eps.pdf depuis l'Aide intégrée puis le re-joint à la Release GitHub v1.0
# (le lien https://github.com/msjeps/edt-eps/releases/latest/download/edt-eps.pdf reste donc à jour).
# Usage : ./publier-guide.sh            (génère + envoie)
#         ./publier-guide.sh --local    (génère seulement, sans envoyer)
# À lancer après CHAQUE modification de src/views/aide/aide.js ou des fonctionnalités qu'elle décrit.
set -e
cd "$(dirname "$0")"
python3 generer-guide-edt-eps.py
if [ "$1" = "--local" ]; then echo "PDF généré, non envoyé (--local)."; exit 0; fi
gh release upload v1.0 edt-eps.pdf --clobber --repo msjeps/edt-eps
echo "edt-eps.pdf mis à jour : https://github.com/msjeps/edt-eps/releases/latest/download/edt-eps.pdf"
