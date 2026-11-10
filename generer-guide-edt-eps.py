#!/usr/bin/env python3
"""Génère edt-eps.pdf, le guide d'utilisation d'EDT EPS.
Usage : python3 generer-guide-edt-eps.py   (reportlab requis, polices Arial de macOS)

EDT EPS est une application web (pas d'APK) : le guide n'a donc pas de lien de téléchargement d'APK.
Le texte reprend l'aide intégrée de l'app (src/views/aide/aide.js) : à mettre à jour ici quand elle change.
Pas de numéro de version affiché dans l'app : le pied de page porte la date de génération du guide.
Convention EPS : aucun tiret cadratin dans les documents générés."""
import datetime
import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle,
                                KeepTogether)

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, 'edt-eps.pdf')
MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre',
        'novembre', 'décembre']
AUJ = datetime.date.today()
DATE_FR = '%d %s %d' % (AUJ.day, MOIS[AUJ.month - 1], AUJ.year)
URL_APP = 'https://apps.outils-eps.fr/edt-eps/'

POL = '/System/Library/Fonts/Supplemental/'
pdfmetrics.registerFont(TTFont('F', POL + 'Arial.ttf'))
pdfmetrics.registerFont(TTFont('FB', POL + 'Arial Bold.ttf'))
pdfmetrics.registerFont(TTFont('FI', POL + 'Arial Italic.ttf'))
pdfmetrics.registerFont(TTFont('FM', POL + 'Courier New Bold.ttf'))
pdfmetrics.registerFontFamily('F', normal='F', bold='FB', italic='FI', boldItalic='FB')

BLEU = colors.HexColor('#2563EB')       # couleur-primaire de l'app (--c-primary)
BLEU_BG = colors.HexColor('#E8EEF9')
ORANGE = colors.HexColor('#B45309')
ORANGE_BG = colors.HexColor('#FEF3E2')
GRIS = colors.HexColor('#555555')
GRIS_BG = colors.HexColor('#F3F4F6')

corps = ParagraphStyle('corps', fontName='F', fontSize=9.3, leading=12.6, spaceAfter=4,
                       textColor=colors.HexColor('#333333'))
puce = ParagraphStyle('puce', parent=corps, leftIndent=14, bulletIndent=3, spaceAfter=3)
cellule = ParagraphStyle('cellule', parent=corps, fontSize=8.6, leading=11.2, spaceAfter=0)
cellule_t = ParagraphStyle('cellule_t', parent=cellule, fontName='FB', textColor=colors.white)
titre = ParagraphStyle('titre', fontName='FB', fontSize=24, leading=28, textColor=colors.HexColor('#222222'))
sous = ParagraphStyle('sous', fontName='F', fontSize=10.5, leading=14, textColor=GRIS, spaceAfter=4)
h2 = ParagraphStyle('h2', fontName='FB', fontSize=13, leading=16, textColor=BLEU, spaceBefore=10, spaceAfter=4,
                    keepWithNext=1)
h3 = ParagraphStyle('h3', fontName='FB', fontSize=10.3, leading=13, textColor=colors.HexColor('#222222'),
                    spaceBefore=5, spaceAfter=3, keepWithNext=1)
intro = ParagraphStyle('intro', parent=corps, keepWithNext=1)
note = ParagraphStyle('note', parent=corps, fontSize=8.8, leading=12.2)
LARG = 170 * mm


def P(t, st=corps):
    return Paragraph(t, st)


def B(t):
    return Paragraph(t, puce, bulletText='•')


def N(n, t):
    return Paragraph(t, puce, bulletText='%d.' % n)


def encadre(paragraphes, fond=BLEU_BG, bord=BLEU):
    t = Table([[paragraphes]], colWidths=[LARG])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), fond), ('BOX', (0, 0), (-1, -1), 1, bord),
                           ('LEFTPADDING', (0, 0), (-1, -1), 10), ('TOPPADDING', (0, 0), (-1, -1), 6),
                           ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    return t


def tableau(entetes, lignes, largeurs):
    """Tableau à en-tête bleu ; chaque cellule est un Paragraph (retour à la ligne automatique)."""
    donnees = [[Paragraph(e, cellule_t) for e in entetes]]
    for l in lignes:
        donnees.append([Paragraph(c, cellule) for c in l])
    t = Table(donnees, colWidths=[x * mm for x in largeurs], repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, GRIS_BG]),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#CCCCCC')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5)]))
    return t


def en_tete(canvas, doc):
    w, h = A4
    canvas.saveState()
    canvas.setFillColor(BLEU)
    canvas.rect(0, h - 5 * mm, w, 5 * mm, stroke=0, fill=1)
    canvas.rect(0, 0, w, 5 * mm, stroke=0, fill=1)
    canvas.setFont('F', 8)
    canvas.setFillColor(GRIS)
    canvas.drawRightString(w - 20 * mm, 10 * mm,
                           "Guide d'utilisation - EDT EPS - mis à jour le %s - page %d" % (DATE_FR, doc.page))
    canvas.restoreState()


def contenu():
    s = []
    s.append(P("Guide d'utilisation", titre))
    s.append(P("EDT EPS : emploi du temps et coordination EPS (mis à jour le %s)" % DATE_FR, sous))
    ligne = Table([['']], colWidths=[LARG], rowHeights=[2])
    ligne.setStyle(TableStyle([('LINEBELOW', (0, 0), (-1, -1), 1.5, BLEU)]))
    s += [ligne, Spacer(1, 4)]

    # --- Présentation
    s.append(P("À quoi sert l'application ?", h2))
    s.append(P("<b>EDT EPS</b> aide le coordonnateur d'un établissement (collège, lycée ou mixte) à construire "
               "l'emploi du temps de l'équipe EPS : programmation annuelle des activités, placement des séances "
               "dans la semaine, détection automatique des conflits, suivi des réservations d'installations et "
               "des transports, puis exports prêts à transmettre (mairie, service transport, enseignants)."))
    s.append(P("Les données restent <b>sur votre ordinateur</b> : rien n'est envoyé sur internet."))

    s.append(P("Accès", h2))
    s.append(P("EDT EPS est une <b>application web</b> : aucune installation, aucun fichier à télécharger. "
               "Elle s'utilise directement dans un navigateur récent (Chrome, Edge, Firefox, Safari), de "
               "préférence sur ordinateur."))
    s.append(encadre([Paragraph(
        "<b>Adresse de l'application</b> :<br/>"
        '<font name="FM" size="8.5">%s</font><br/>'
        "Le premier chargement demande une connexion internet ; ensuite, vos données sont enregistrées "
        "localement dans le navigateur de cet ordinateur." % URL_APP, corps)]))
    s.append(Spacer(1, 4))
    s.append(P("<b>Important</b> : comme les données sont dans le navigateur, elles ne suivent pas d'un ordinateur "
               "à l'autre. Pensez à <b>sauvegarder régulièrement le projet en fichier JSON</b> (bouton <i>Sauvegarder</i> de la "
               "barre latérale, voir « Sauvegarde et chargement »)."))

    # --- Démarrage rapide
    s.append(P('Démarrage rapide en 4 étapes', h2))
    s.append(N(1, "<b>Configuration</b> : lancez l'assistant (roue crantée en bas de la barre latérale) et renseignez "
                  "l'établissement, les enseignants, les classes, les activités et les installations. Comptez "
                  "environ 10 minutes pour un établissement type."))
    s.append(N(2, "<b>Programmation annuelle</b> : dans l'onglet <i>Programmation</i>, affectez une activité et "
                  "une installation à chaque classe pour chaque période. C'est la base qui alimente l'emploi du "
                  "temps."))
    s.append(N(3, "<b>Emploi du temps</b> : l'onglet <i>EDT</i> affiche la grille de la semaine. Déplacez les "
                  "séances par glisser-déposer, ajustez les horaires, verrouillez ce qui est définitif."))
    s.append(N(4, "<b>Exports</b> : depuis l'onglet <i>Exports</i>, générez le CSV mairie, le CSV transport, les "
                  "PDF de l'EDT ou l'Excel de synthèse."))

    # --- Données
    s.append(P("L'onglet Données", h2))
    s.append(P("Toutes les entités du projet se gèrent dans des tableaux modifiables."))
    s.append(tableau(
        ['Onglet', 'Ce que vous pouvez faire'],
        [['Enseignants', "Ajouter ou modifier des enseignants, renseigner l'ORS, saisir les indisponibilités "
                         "(jours, plages horaires)."],
         ['Classes', "Créer les classes par niveau (6e à Terminale), associer un enseignant référent."],
         ['Activités', "Choisir les APSA du catalogue EPS par champ d'apprentissage (CA1 à CA4), définir la durée "
                       "et l'installation requise."],
         ['Installations', "Gérer les lieux et les installations, importer les disponibilités de la mairie "
                           "(bouton <b>Import mairie</b>) ou une liste de lieux déjà prête (bouton "
                           "<b>Importer lieux</b>)."],
         ['Périodes', "Paramétrer les trimestres, semestres ou périodes personnalisées."],
         ['Créneaux', "Définir les plages horaires de base (modifiables par période dans Programmation)."]],
        [32, 138]))
    s.append(Spacer(1, 6))
    s.append(P("Importer des lieux et des installations", h3))
    s.append(P("Dans Données, onglet <i>Installations</i>, le bouton <b>Importer lieux</b> évite de ressaisir "
               "à la main les lieux et installations déjà connus. Deux formats sont acceptés :"))
    s.append(B("<b>Fichier JSON</b> exporté depuis EDT EPS."))
    s.append(B("<b>Fichier CSV</b> à deux colonnes obligatoires, <b>LIEUX</b> et <b>INSTALLATIONS</b>, une ligne "
               "par installation (exemple : <font name='FM' size='8.5'>Stade;Piste</font> puis "
               "<font name='FM' size='8.5'>Stade;Terrain</font>)."))
    s.append(P("Un aperçu s'affiche avant de valider. Les lieux dont le nom existe déjà sont ignorés ; les "
               "installations nouvelles sont ajoutées aux lieux existants. Les lieux importés depuis un CSV "
               "sont créés en extra-muros avec transport en bus, modifiable ensuite lieu par lieu. L'import peut "
               "être annulé (Ctrl+Z)."))

    # --- Programmation
    s.append(P('Programmation annuelle', h2))
    s.append(P("La matrice <b>classe × période</b> est le cœur du planning annuel."))
    s.append(B("Cliquez sur une cellule vide pour affecter une activité, une installation et un créneau."))
    s.append(B("Un <b>badge bleu</b> indique un horaire propre à la période (différent du créneau de base)."))
    s.append(B("Un avertissement <b>orange</b> signale qu'une activité est déjà utilisée sur la même période ; "
               "<b>bleu</b> si c'est sur une autre période."))
    s.append(B("Les séances d'une période longue (semestre) s'affichent en <i>fantômes grisés</i> dans les "
               "sous-périodes (trimestres) pour visualiser les chevauchements."))
    s.append(B("La vue <b>Installation × Période</b> (onglet à droite) montre l'occupation des espaces sportifs."))

    # --- EDT
    s.append(P('Emploi du temps (EDT)', h2))
    s.append(P("Grille de la semaine interactive, avec gestion des conflits en temps réel."))
    s.append(B("<b>Glisser-déposer</b> : déplacez un bloc dans la même journée ou vers un autre jour. Un dialogue "
               "propose de déplacer pour « Cette période uniquement » ou « Toutes les périodes »."))
    s.append(B("<b>Clic sur un bloc</b> : ouvre la fenêtre de détail et de modification de la séance."))
    s.append(B("<b>Filtre période</b> : changez la période dans la barre d'outils (T1, T2, T3…)."))
    s.append(B("<b>Filtre vue</b> : affichez l'EDT d'un enseignant, d'une classe ou d'une installation précise."))
    s.append(B("<b>Légende</b> : le bouton <i>Légende</i> affiche ou masque la légende des installations "
               "(utile pour gagner de la hauteur d'écran)."))
    s.append(B("Les séances en conflit ont une <b>bordure rouge</b> ; l'onglet <i>Conflits</i> donne le détail."))

    s.append(P("Verrouiller", h3))
    s.append(B("<b>Verrou d'une séance</b> : dans la fenêtre d'une séance, cochez « Verrouiller » pour "
               "l'empêcher d'être déplacée par accident (un cadenas apparaît sur le bloc)."))
    s.append(B("<b>Verrouillage global de l'EDT</b> : le bouton <i>Verrouiller l'EDT</i> de la barre d'outils "
               "fige tout l'emploi du temps une fois accepté : plus aucun ajout, déplacement, modification ou "
               "suppression (glisser-déposer désactivé, bouton <i>+ Séance</i> grisé, Ctrl+Z bloqué). Le bouton "
               "devient ambre (<i>EDT verrouillé</i>) et un clic sur un bloc l'ouvre en lecture seule."))
    s.append(P("La <i>Programmation</i> reste modifiable pendant le verrouillage ; un bandeau rappelle que la "
               "synchronisation vers l'EDT est différée jusqu'au déverrouillage."))

    s.append(P("Séances d'Association Sportive (AS)", h3))
    s.append(P("L'AS ne se déclare ni comme une classe ni comme une activité : c'est un type de séance que l'on "
               "place directement dans la grille."))
    s.append(N(1, "Cliquez sur <b>+ Séance</b>."))
    s.append(N(2, "Cochez « Séance d'Association Sportive » tout en haut du formulaire."))
    s.append(N(3, "Le champ Classe est remplacé par un <b>intitulé libre</b> (ex. « AS Badminton ») et le champ "
                  "Activité par une <b>saisie libre</b> : l'AS peut proposer des activités hors programmation."))
    s.append(P("L'AS <b>ne compte pas</b> dans les 6 h par jour d'ORS mais <b>occupe bien l'installation</b>. "
               "Le bouton <i>AS visible / masquée</i> de la barre d'outils l'affiche ou la cache. Le champ "
               "« AS (heures) » de Données, onglet Enseignants, sert uniquement à déclarer le volume horaire "
               "statutaire, pas à placer les créneaux."))

    # --- Conflits
    s.append(P('Détection de conflits', h2))
    s.append(P("Les conflits sont détectés automatiquement à chaque modification. Le badge rouge de la barre "
               "latérale indique le nombre de conflits actifs.", intro))
    s.append(tableau(
        ['Type', 'Déclencheur'],
        [['Conflit ressource', "Même enseignant, même classe ou même installation sur deux séances simultanées."],
         ['ORS dépassé', "Un enseignant dépasse 6 h d'EPS par jour (AS exclue)."],
         ['Écart 24 h', "Deux séances d'une même classe de collège espacées de moins de 24 h."],
         ['Incompatibilité', "Activité incompatible avec l'installation (ex. natation hors piscine)."],
         ['Indisponibilité', "Enseignant ou installation marqué indisponible sur ce créneau."],
         ['Capacité', "Effectif de la classe supérieur à la capacité de l'installation."]],
        [38, 132]))

    # --- Réservations
    s.append(P('Réservations', h2))
    s.append(P("Suivez le statut des demandes auprès de la Direction des Sports. Changez le statut avec le bouton "
               "d'action de chaque réservation dans le tableau.", intro))
    s.append(tableau(
        ['Statut', 'Signification'],
        [['Proposé', "Créneau généré depuis la Programmation, pas encore transmis."],
         ['Demandé', "Demande envoyée à la mairie, en attente de réponse."],
         ['Accepté', "Créneau confirmé."],
         ['Refusé', "Créneau refusé (un conflit apparaît alors dans la grille EDT)."]],
        [38, 132]))

    # --- Vues individuelles
    s.append(P('Vues individuelles', h2))
    s.append(P("L'onglet <i>Vues</i> génère des fiches individuelles (une carte par enseignant, par classe ou par "
               "installation), consultables à l'écran et pratiques à imprimer isolément, par exemple "
               "l'occupation d'un seul gymnase. Elles sont indépendantes des exports PDF."))
    s.append(B("<b>4 filtres indépendants</b> : Enseignants, Installations, Périodes, Classes, toujours visibles "
               "en haut de l'écran, chacun avec « Tous / Toutes » par défaut."))
    s.append(B("Les filtres se <b>combinent</b> : Installations = Gymnase et Classes = 6eA n'affiche que les "
               "séances de 6eA au gymnase."))
    s.append(B("<b>Regroupement automatique</b> selon le premier filtre précis (priorité enseignant, puis classe, "
               "puis installation) ; sans filtre précis, le regroupement se fait par enseignant."))
    s.append(B("En mode « Toutes les périodes », un badge <b>S1 / T2</b> apparaît sur chaque bloc, et un badge "
               "orange signale une entité dont toutes les séances sont dans une seule période. Les heures "
               "hebdomadaires sont alors <b>annualisées</b> (2 h en S1 seul sur 2 semestres s'affichent 1 h par "
               "semaine, avec un astérisque)."))
    s.append(B("Les heures d'ORS et les heures d'AS sont affichées séparément."))
    s.append(B("Le bouton <i>Imprimer</i> reprend, dans le titre et le sous-titre de la page imprimée, le "
               "regroupement actif et les filtres appliqués."))

    # --- Exports
    s.append(P('Exports', h2))
    s.append(tableau(
        ['Format', 'Contenu', 'Pour qui'],
        [['CSV Mairie', "Créneaux par installation (format Direction des Sports).", "Service municipal"],
         ['CSV Transport', "Une ligne = une demande de bus (classe, lieu, départ et retour).", "Service transport"],
         ['PDF EDT équipe', "Grille de l'équipe en paysage A4, couleurs alignées sur la légende.",
          "Affichage, distribution"],
         ['PDF EDT enseignants', "Fiches individuelles en portrait par enseignant (ORS et total hebdomadaire).",
          "Les enseignants"],
         ['PDF EDT classes', "Fiches individuelles en portrait par classe.", "Les classes"],
         ['PDF EDT installation', "Fiche portrait A4 par installation, groupée par jour puis par période "
                                  "(classe, activité et enseignant).", "Gestionnaire d'installation"],
         ['Excel EDT', "Tableau complet de l'emploi du temps, avec mise en forme en couleur.", "Administration"],
         ['Excel Synthèses', "Occupation intra et extra-muros, heures par enseignant, bilan transport (colonne "
                             "Nb rotations).", "Direction"],
         ['JSON Projet', "Sauvegarde complète de toutes les données (bouton <i>Sauvegarder</i> de la barre latérale).",
          "Archivage, transfert"]],
        [34, 96, 40]))
    s.append(Spacer(1, 5))
    s.append(P("Les fichiers sont enregistrés dans le dossier <font name='FM' size='8.5'>EDT EPS/EXPORTS/</font> "
               "mémorisé, ou dans Téléchargements si le navigateur ne permet pas de mémoriser un dossier."))
    s.append(P("Les séances d'AS figurent sur les PDF et dans l'occupation des installations, mais pas dans la "
               "charge horaire ORS des enseignants."))

    s.append(P("Dates de transport : exclusions et ajouts", h3))
    s.append(B("<b>Dates à exclure</b> : retire des dates du planning PDF et du CSV transport (journée "
               "pédagogique, voyage, bac blanc…). Renseignez une <i>date de fin</i> pour exclure une période "
               "entière (option « jours ouvrés uniquement » pour ne viser que du lundi au vendredi), ou utilisez "
               "<i>Sélection multiple sur calendrier</i> pour cocher des jours non consécutifs (ex. tous les "
               "vendredis de septembre)."))
    s.append(B("<b>Dates à ajouter</b> : pour un besoin de bus ponctuel hors planning habituel (sortie, "
               "compétition, rattrapage). Indiquez la date, la classe, le lieu et les horaires ; l'ajout ne "
               "dépend d'aucune séance de l'EDT et reste valable si l'emploi du temps change."))
    s.append(B("Exclusions et ajouts sont pris en compte automatiquement dans le CSV transport, le PDF du "
               "planning transport et la colonne Nb rotations de l'Excel de synthèses."))
    s.append(B("Les deux listes sont <b>repliables</b> (bouton « Masquer / Afficher les dates ») ; le compteur de "
               "dates reste visible même repliée."))

    # --- Sauvegarde
    s.append(P('Sauvegarde et chargement', h2))
    s.append(B("<b>Sauvegarder</b> : enregistre toutes les données en JSON dans le dossier "
               "<font name='FM' size='8.5'>EDT EPS/PROJET/</font>. Un point jaune dans la barre de statut "
               "indique des modifications non sauvegardées."))
    s.append(B("<b>Charger</b> : importe un fichier JSON de projet. "
               "<b>Attention : cela remplace toutes les données actuelles.</b>"))
    s.append(B("<b>Versions</b> : crée un instantané daté de l'état actuel. Restaurez ou comparez deux "
               "instantanés depuis la fenêtre Versions."))
    s.append(B("<b>Annuler (ou Ctrl+Z)</b> : revient avant la dernière modification, jusqu'à 20 niveaux."))
    s.append(Spacer(1, 3))
    s.append(encadre([Paragraph(
        "<b>Enregistrement automatique, mais sauvegarde manuelle.</b> Chaque modification est tout de suite "
        "enregistrée dans le navigateur. En revanche, le fichier JSON n'est créé que lorsque vous appuyez sur "
        "<i>Sauvegarder</i> : c'est lui qui permet de changer d'ordinateur ou de se protéger si les données du navigateur "
        "sont effacées.", corps)], fond=ORANGE_BG, bord=ORANGE))

    # --- Raccourcis
    s.append(P('Raccourcis clavier', h2))
    s.append(tableau(
        ['Raccourci', 'Action'],
        [['Ctrl + Z', "Annuler la dernière action."],
         ['Ctrl + S', "Non disponible : utilisez le bouton <i>Sauvegarder</i> de la barre latérale."],
         ['Échap', "Fermer une fenêtre ou un panneau."],
         ['Entrée', "Valider un formulaire (dans les fenêtres)."],
         ['Glisser-déposer', "Déplacer une séance dans la grille EDT."]],
        [38, 132]))

    # --- FAQ
    s.append(P('Questions fréquentes', h2))
    faq = [
        ("Mes données sont-elles sauvegardées automatiquement ?",
         "Toutes les modifications sont immédiatement enregistrées dans le stockage local du navigateur. En "
         "revanche, la sauvegarde en fichier JSON doit être déclenchée à la main avec le bouton <i>Sauvegarder</i>. Faites-la "
         "régulièrement pour transférer ou archiver votre projet."),
        ("Comment transférer le projet sur un autre ordinateur ?",
         "Sauvegardez le projet en JSON (bouton <i>Sauvegarder</i>), copiez le fichier sur l'autre machine, puis utilisez le bouton "
         "<i>Charger</i> pour l'importer dans EDT EPS."),
        ("L'application fonctionne-t-elle hors connexion ?",
         "Le premier chargement demande une connexion internet. Une fois l'application chargée, les fonctions "
         "principales restent disponibles sans connexion, hormis la récupération du calendrier scolaire "
         "officiel."),
        ("Comment gérer plusieurs établissements ?",
         "EDT EPS gère un seul établissement par projet. Pour plusieurs établissements, créez autant de "
         "fichiers JSON distincts et chargez celui dont vous avez besoin."),
        ("Comment supprimer toutes les données et repartir de zéro ?",
         "Relancez l'assistant de configuration (roue crantée de la barre latérale) : à la première étape, un bouton « Réinitialiser "
         "le projet » efface toutes les données après confirmation."),
        ("Les séances créées dans l'EDT sont-elles visibles dans Programmation ?",
         "Oui. Toute séance ajoutée directement dans la grille crée automatiquement l'entrée de programmation "
         "correspondante (créneau classe et programmation annuelle). Les séances d'AS font exception : elles ne "
         "sont rattachées à aucune classe ni à la programmation."),
        ("Où déclarer l'Association Sportive ?",
         "Dans <b>Emploi du temps, puis + Séance</b>, en cochant « Séance d'Association Sportive » (voir plus "
         "haut). Elle ne se déclare pas dans Données."),
        ("Comment figer l'emploi du temps une fois accepté par tout le monde ?",
         "Cliquez sur <b>Verrouiller l'EDT</b> dans la barre d'outils de l'onglet Emploi du temps. Tant que le "
         "bouton est ambre (cadenas fermé), aucune modification n'est possible sur la grille. La Programmation annuelle "
         "reste modifiable ; ses changements se répercutent sur l'EDT au déverrouillage."),
    ]
    for q, r in faq:
        s.append(KeepTogether([P('<b>%s</b>' % q, ParagraphStyle('q', parent=corps, spaceAfter=1)), P(r)]))

    # --- Confidentialité
    s.append(P('Confidentialité', h2))
    s.append(P("Le stockage est <b>100 % local</b> (IndexedDB, dans le navigateur de l'ordinateur) : aucune donnée "
               "n'est envoyée sur un serveur. Les noms des enseignants et des classes ne quittent donc cet "
               "ordinateur que dans les fichiers que vous exportez vous-même. Sur un ordinateur partagé, "
               "sauvegardez votre projet en JSON puis réinitialisez-le avant de partir."))

    s.append(Spacer(1, 8))
    s.append(P("EDT EPS, application développée par <b>Nathalie Prenois</b>, professeure EPS (Antibes), "
               "<b>https://outils-eps.fr</b>",
               ParagraphStyle('fin', parent=note, alignment=1, textColor=GRIS)))
    return s


doc = BaseDocTemplate(SORTIE, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=15 * mm,
                      bottomMargin=15 * mm, title="Guide d'utilisation - EDT EPS",
                      author='Nathalie Prenois', subject='EDT EPS, guide mis à jour le %s' % DATE_FR)
cadre = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='f')
doc.addPageTemplates([PageTemplate(id='p', frames=[cadre], onPage=en_tete)])
doc.build(contenu())
print('OK', SORTIE, DATE_FR)
