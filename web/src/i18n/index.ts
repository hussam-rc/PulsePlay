// Interface strings for players, the projector and the main navigation. Game content keeps its own language.
// German follows Swiss spelling (ss). Arabic is Modern Standard Arabic and renders right-to-left.
const en = {
  'keep.saved': '💾 Saved on this phone only. Nobody else can see it.', 'keep.delete': '🗑 Delete my result', 'keep.confirm': 'Delete your result from this phone? This cannot be undone.', 'keep.deleted': 'Deleted. Nothing about you is left on this phone.', 'keep.title': 'Your result', 'keep.ended': 'The game has ended. Your result is still here for you.',
  'res.meterLow': 'You drive', 'res.meterHigh': 'Autopilot drives', 'res.score': 'Your score',
  'nav.discover': 'Discover', 'nav.play': 'Play', 'nav.create': 'Create', 'nav.host': 'Host', 'nav.workspace': 'My Workspace',
  'tagline': 'Bring people together. One game at a time.',
  'privacy.short': 'Answers stay private. The room only sees anonymous group results.',
  'practice.banner': 'PRACTICE MODE · simulated players only. Nothing is saved.',
  'lang.label': 'Language',
  // join
  'join.title': 'Join {title}', 'join.aGame': 'a game', 'join.code': 'Room code', 'join.nickname': 'Nickname', 'join.avatar': 'Pick an avatar',
  'join.before': '🔒 Before you join', 'join.screen': 'Your nickname and avatar appear on the big screen.', 'join.private': 'Your answers and result stay private on your phone.',
  'join.groupOnly': 'Only group totals are shown.', 'join.noData': 'No account, email or device data is collected. Joining is voluntary.',
  'join.board': 'Show my nickname and score on the leaderboard (optional)', 'join.consent': 'I understand and want to play.',
  'join.started': 'Game already started', 'join.joining': 'Joining…', 'join.go': 'Join 🚗',
  'join.err.code': 'Room codes have 6 digits.', 'join.err.nick': 'Please enter a nickname.', 'join.err.consent': 'Tick the box to confirm you want to play.',
  'join.noRoom': 'No game with that code is running.', 'join.joined': '{n} joined', 'join.connecting': 'Connecting…', 'join.keepTrying': "We'll keep trying.",
  'join.leave': 'Leave and delete my answers',
  // phone
  'phone.ended': 'This game has ended', 'phone.thanks': 'Thanks for playing!', 'phone.in': "You're in, {name}!", 'phone.getReady': 'Get ready — first question coming up.',
  'phone.watch': 'Watch the big screen. The host will start soon.', 'phone.read': '👀 Read…', 'phone.openSoon': 'answers open soon', 'phone.choose': 'Choose now!',
  'phone.paused': '⏸ Paused by the host', 'phone.locked': '✅ Locked in', 'phone.timeUp': "⏰ Time's up — skipped, not counted against you",
  'phone.correct': '✅ Correct!', 'phone.missed': '⏰ Missed.', 'phone.notQuite': '🤔 Not quite.', 'phone.lookScreen': 'Look at the big screen for how the group voted.',
  'phone.ready': 'Your result is ready', 'phone.tap': 'Tap to see it. Only you can see this.', 'phone.onBoard': "You're on the leaderboard as {name}.",
  'phone.options': 'Answer options', 'phone.note': 'Your private note (only you see it)', 'phone.save': 'Save',
  // result card
  'res.parked': 'Parked before the finish line', 'res.notEnough': "You answered {a} of {t}. That's not enough for a fair score this time.", 'res.again': "Play again any time — speed isn't the point.",
  'res.correct': 'correct', 'res.strength': 'Strength', 'res.notice': 'Worth noticing', 'res.habit': 'Habit to try', 'res.challenge': "Tomorrow's challenge",
  'res.copy': '📋 Copy my result', 'res.copied': 'Copied. Nothing was shared automatically.', 'res.copyBlocked': 'Copy blocked — take a screenshot instead.',
  // projector
  'stage.practiceQr': 'Practice room · in a live game, players scan this code', 'stage.scan': 'Scan the code, or go to the link and enter', 'stage.joined': 'joined',
  'stage.more': '{n} more for group results', 'stage.readS': '{n} s to read', 'stage.answerS': '{n} s to answer on your phone', 'stage.privateOn': 'Your answers and score stay on your phone',
  'stage.groupOnly': 'Only group totals are shown', 'stage.boardNote': 'Optional leaderboard: only names people chose to share', 'stage.q': 'Question {i} / {n}', 'stage.paused': '⏸ Paused',
  'stage.readOpen': '👀 Read… answers open in', 'stage.s': 's', 'stage.answerNow': '📱 Answer on your phone!', 'stage.locked': 'Answers locked.', 'stage.suppressed': 'Results appear once {n}+ people answer.',
  'stage.answered': '{a} of {n} answered', 'stage.shuffled': 'Options are shuffled on each phone and never shown here.', 'stage.lookPhone': 'Look at your phone', 'stage.fun': 'That was fun!',
  'stage.privateRes': 'Your personal result is private — only you can see it.', 'stage.played': '{n} people played. Thank you!', 'stage.noGroup': 'Not enough players for a group result… yet!',
  'stage.noGroupWhy': "We need at least {min} completed games to show an anonymous average — today we have {n}. That protects everyone's privacy.", 'stage.groupResult': '🏢 Our group result',
  'stage.pctCorrect': '% correct', 'stage.completed': '{n} completed', 'stage.breakdownLater': 'The breakdown appears from {n} completed games, so small groups stay anonymous.',
  'stage.notMeasure': 'This is the average of the people who played today, not a measurement.', 'stage.beforeGo': 'Before you go… 💜',
  'stage.nobodyBoard': "Nobody chose to appear on the leaderboard. That's fine too!", 'stage.board': '🏆 Leaderboard', 'stage.volunteers': '(volunteers only)',
  // host bar
  'host.start': 'Start ▶', 'host.first': 'First question 🚦', 'host.open': 'Open answers now', 'host.waiting': 'Waiting for answers…', 'host.next': 'Next question ▶',
  'host.results': 'Show results 🪞', 'host.wrap': 'Wrap up ▶', 'host.group': 'Reveal group result 🏢', 'host.reflect': 'Reflection ▶', 'host.done': 'Finished 💜',
  'host.resume': '▶ Resume', 'host.pause': '⏸ Pause', 'host.fs': '⛶ Full screen', 'host.keys': 'Space/→ next · P pause · F full screen', 'host.retrying': 'Retrying…',
};
export type Key = keyof typeof en;
type Dict = Record<Key, string>;

const de: Dict = {
  'keep.saved': '💾 Nur auf diesem Handy gespeichert. Niemand sonst sieht es.', 'keep.delete': '🗑 Mein Ergebnis löschen', 'keep.confirm': 'Ergebnis von diesem Handy löschen? Das kann nicht rückgängig gemacht werden.', 'keep.deleted': 'Gelöscht. Auf diesem Handy ist nichts mehr von dir gespeichert.', 'keep.title': 'Dein Ergebnis', 'keep.ended': 'Das Spiel ist beendet. Dein Ergebnis bleibt für dich hier.',
  'res.meterLow': 'Du fährst', 'res.meterHigh': 'Autopilot fährt', 'res.score': 'Dein Wert',
  'nav.discover': 'Entdecken', 'nav.play': 'Mitspielen', 'nav.create': 'Erstellen', 'nav.host': 'Leiten', 'nav.workspace': 'Mein Arbeitsbereich',
  'tagline': 'Menschen zusammenbringen. Ein Spiel nach dem anderen.',
  'privacy.short': 'Antworten bleiben privat. Der Raum sieht nur anonyme Gruppenergebnisse.',
  'practice.banner': 'ÜBUNGSMODUS · nur simulierte Teilnehmende. Es wird nichts gespeichert.',
  'lang.label': 'Sprache',
  'join.title': '{title} beitreten', 'join.aGame': 'einem Spiel', 'join.code': 'Raumcode', 'join.nickname': 'Spitzname', 'join.avatar': 'Wähle einen Avatar',
  'join.before': '🔒 Bevor du beitrittst', 'join.screen': 'Dein Spitzname und Avatar erscheinen auf dem grossen Bildschirm.', 'join.private': 'Deine Antworten und dein Ergebnis bleiben privat auf deinem Handy.',
  'join.groupOnly': 'Es werden nur Gruppenergebnisse gezeigt.', 'join.noData': 'Kein Konto, keine E-Mail, keine Gerätedaten. Die Teilnahme ist freiwillig.',
  'join.board': 'Meinen Spitznamen und Punktestand in der Rangliste zeigen (freiwillig)', 'join.consent': 'Ich habe das verstanden und möchte mitspielen.',
  'join.started': 'Spiel hat schon begonnen', 'join.joining': 'Beitreten…', 'join.go': 'Beitreten 🚗',
  'join.err.code': 'Raumcodes haben 6 Ziffern.', 'join.err.nick': 'Bitte gib einen Spitznamen ein.', 'join.err.consent': 'Bitte bestätige mit dem Häkchen, dass du mitspielen möchtest.',
  'join.noRoom': 'Mit diesem Code läuft gerade kein Spiel.', 'join.joined': '{n} dabei', 'join.connecting': 'Verbinden…', 'join.keepTrying': 'Wir versuchen es weiter.',
  'join.leave': 'Verlassen und meine Antworten löschen',
  'phone.ended': 'Dieses Spiel ist beendet', 'phone.thanks': 'Danke fürs Mitspielen!', 'phone.in': 'Du bist dabei, {name}!', 'phone.getReady': 'Mach dich bereit – gleich kommt die erste Frage.',
  'phone.watch': 'Schau auf den grossen Bildschirm. Es geht gleich los.', 'phone.read': '👀 Lesen…', 'phone.openSoon': 'Antworten öffnen gleich', 'phone.choose': 'Jetzt wählen!',
  'phone.paused': '⏸ Pausiert', 'phone.locked': '✅ Gespeichert', 'phone.timeUp': '⏰ Zeit um – übersprungen, zählt nicht gegen dich',
  'phone.correct': '✅ Richtig!', 'phone.missed': '⏰ Verpasst.', 'phone.notQuite': '🤔 Nicht ganz.', 'phone.lookScreen': 'Auf dem grossen Bildschirm siehst du, wie die Gruppe abgestimmt hat.',
  'phone.ready': 'Dein Ergebnis ist bereit', 'phone.tap': 'Tippen zum Anzeigen. Nur du siehst es.', 'phone.onBoard': 'Du stehst als {name} in der Rangliste.',
  'phone.options': 'Antwortmöglichkeiten', 'phone.note': 'Deine private Notiz (nur du siehst sie)', 'phone.save': 'Speichern',
  'res.parked': 'Kurz vor dem Ziel geparkt', 'res.notEnough': 'Du hast {a} von {t} beantwortet. Das reicht diesmal nicht für ein faires Ergebnis.', 'res.again': 'Spiel jederzeit nochmals – Tempo ist nicht das Ziel.',
  'res.correct': 'richtig', 'res.strength': 'Stärke', 'res.notice': 'Gut zu wissen', 'res.habit': 'Gewohnheit zum Ausprobieren', 'res.challenge': 'Challenge für morgen',
  'res.copy': '📋 Mein Ergebnis kopieren', 'res.copied': 'Kopiert. Es wurde nichts automatisch geteilt.', 'res.copyBlocked': 'Kopieren blockiert – mach stattdessen einen Screenshot.',
  'stage.practiceQr': 'Übungsraum · im echten Spiel scannen alle diesen Code', 'stage.scan': 'Code scannen oder Link öffnen und eingeben', 'stage.joined': 'dabei',
  'stage.more': 'noch {n} für Gruppenergebnisse', 'stage.readS': '{n} s zum Lesen', 'stage.answerS': '{n} s zum Antworten auf dem Handy', 'stage.privateOn': 'Antworten und Punkte bleiben auf deinem Handy',
  'stage.groupOnly': 'Es werden nur Gruppenergebnisse gezeigt', 'stage.boardNote': 'Freiwillige Rangliste: nur Namen, die selbst freigegeben wurden', 'stage.q': 'Frage {i} / {n}', 'stage.paused': '⏸ Pausiert',
  'stage.readOpen': '👀 Lesen… Antworten öffnen in', 'stage.s': 's', 'stage.answerNow': '📱 Jetzt auf dem Handy antworten!', 'stage.locked': 'Antworten geschlossen.', 'stage.suppressed': 'Ergebnisse erscheinen ab {n} Antworten.',
  'stage.answered': '{a} von {n} haben geantwortet', 'stage.shuffled': 'Die Antworten sind auf jedem Handy gemischt und werden hier nicht gezeigt.', 'stage.lookPhone': 'Schau auf dein Handy', 'stage.fun': 'Das hat Spass gemacht!',
  'stage.privateRes': 'Dein persönliches Ergebnis ist privat – nur du siehst es.', 'stage.played': '{n} Personen haben mitgespielt. Danke!', 'stage.noGroup': 'Noch zu wenige für ein Gruppenergebnis!',
  'stage.noGroupWhy': 'Für einen anonymen Durchschnitt braucht es mindestens {min} abgeschlossene Spiele – heute sind es {n}. Das schützt die Privatsphäre aller.', 'stage.groupResult': '🏢 Unser Gruppenergebnis',
  'stage.pctCorrect': '% richtig', 'stage.completed': '{n} abgeschlossen', 'stage.breakdownLater': 'Die Verteilung erscheint ab {n} abgeschlossenen Spielen, damit kleine Gruppen anonym bleiben.',
  'stage.notMeasure': 'Das ist der Durchschnitt der heutigen Runde, keine Messung.', 'stage.beforeGo': 'Bevor ihr geht… 💜',
  'stage.nobodyBoard': 'Niemand wollte in die Rangliste. Auch gut!', 'stage.board': '🏆 Rangliste', 'stage.volunteers': '(nur Freiwillige)',
  'host.start': 'Start ▶', 'host.first': 'Erste Frage 🚦', 'host.open': 'Antworten jetzt öffnen', 'host.waiting': 'Warten auf Antworten…', 'host.next': 'Nächste Frage ▶',
  'host.results': 'Ergebnisse zeigen 🪞', 'host.wrap': 'Abschluss ▶', 'host.group': 'Gruppenergebnis zeigen 🏢', 'host.reflect': 'Reflexion ▶', 'host.done': 'Fertig 💜',
  'host.resume': '▶ Weiter', 'host.pause': '⏸ Pause', 'host.fs': '⛶ Vollbild', 'host.keys': 'Leertaste/→ weiter · P Pause · F Vollbild', 'host.retrying': 'Neuer Versuch…',
};

const fr: Dict = {
  'keep.saved': '💾 Enregistré sur ce téléphone uniquement. Personne d’autre ne le voit.', 'keep.delete': '🗑 Supprimer mon résultat', 'keep.confirm': 'Supprimer ton résultat de ce téléphone ? C’est définitif.', 'keep.deleted': 'Supprimé. Plus rien de toi n’est enregistré sur ce téléphone.', 'keep.title': 'Ton résultat', 'keep.ended': 'La partie est terminée. Ton résultat reste ici pour toi.',
  'res.meterLow': 'Tu conduis', 'res.meterHigh': 'Le pilote auto conduit', 'res.score': 'Ton score',
  'nav.discover': 'Découvrir', 'nav.play': 'Jouer', 'nav.create': 'Créer', 'nav.host': 'Animer', 'nav.workspace': 'Mon espace',
  'tagline': 'Rassembler les gens, un jeu à la fois.',
  'privacy.short': 'Les réponses restent privées. La salle ne voit que des résultats de groupe anonymes.',
  'practice.banner': 'MODE ENTRAÎNEMENT · joueurs simulés uniquement. Rien n’est enregistré.',
  'lang.label': 'Langue',
  'join.title': 'Rejoindre {title}', 'join.aGame': 'une partie', 'join.code': 'Code de la salle', 'join.nickname': 'Pseudo', 'join.avatar': 'Choisis un avatar',
  'join.before': '🔒 Avant de rejoindre', 'join.screen': 'Ton pseudo et ton avatar s’affichent sur le grand écran.', 'join.private': 'Tes réponses et ton résultat restent privés sur ton téléphone.',
  'join.groupOnly': 'Seuls les totaux du groupe sont affichés.', 'join.noData': 'Aucun compte, aucun e-mail, aucune donnée de l’appareil. La participation est volontaire.',
  'join.board': 'Afficher mon pseudo et mon score au classement (facultatif)', 'join.consent': 'J’ai compris et je veux jouer.',
  'join.started': 'La partie a déjà commencé', 'join.joining': 'Connexion…', 'join.go': 'Rejoindre 🚗',
  'join.err.code': 'Les codes de salle ont 6 chiffres.', 'join.err.nick': 'Saisis un pseudo.', 'join.err.consent': 'Coche la case pour confirmer que tu veux jouer.',
  'join.noRoom': 'Aucune partie en cours avec ce code.', 'join.joined': '{n} connectés', 'join.connecting': 'Connexion…', 'join.keepTrying': 'Nous réessayons.',
  'join.leave': 'Quitter et supprimer mes réponses',
  'phone.ended': 'Cette partie est terminée', 'phone.thanks': 'Merci d’avoir joué !', 'phone.in': 'Tu es dans la partie, {name} !', 'phone.getReady': 'Prépare-toi, la première question arrive.',
  'phone.watch': 'Regarde le grand écran. La partie va bientôt commencer.', 'phone.read': '👀 Lis…', 'phone.openSoon': 'les réponses s’ouvrent bientôt', 'phone.choose': 'Choisis maintenant !',
  'phone.paused': '⏸ En pause', 'phone.locked': '✅ Enregistré', 'phone.timeUp': '⏰ Temps écoulé : question passée, sans pénalité',
  'phone.correct': '✅ Correct !', 'phone.missed': '⏰ Manqué.', 'phone.notQuite': '🤔 Pas tout à fait.', 'phone.lookScreen': 'Regarde le grand écran pour voir comment le groupe a voté.',
  'phone.ready': 'Ton résultat est prêt', 'phone.tap': 'Touche pour le voir. Toi seul le vois.', 'phone.onBoard': 'Tu es au classement sous le nom {name}.',
  'phone.options': 'Choix de réponse', 'phone.note': 'Ta note privée (toi seul la vois)', 'phone.save': 'Enregistrer',
  'res.parked': 'Garé avant la ligne d’arrivée', 'res.notEnough': 'Tu as répondu à {a} sur {t}. Ce n’est pas assez pour un score juste cette fois.', 'res.again': 'Rejoue quand tu veux : la vitesse n’est pas le but.',
  'res.correct': 'correctes', 'res.strength': 'Point fort', 'res.notice': 'À noter', 'res.habit': 'Habitude à essayer', 'res.challenge': 'Défi pour demain',
  'res.copy': '📋 Copier mon résultat', 'res.copied': 'Copié. Rien n’a été partagé automatiquement.', 'res.copyBlocked': 'Copie bloquée : fais plutôt une capture d’écran.',
  'stage.practiceQr': 'Salle d’entraînement · en vrai, les joueurs scannent ce code', 'stage.scan': 'Scanne le code ou ouvre le lien et saisis', 'stage.joined': 'connectés',
  'stage.more': 'encore {n} pour les résultats de groupe', 'stage.readS': '{n} s pour lire', 'stage.answerS': '{n} s pour répondre sur ton téléphone', 'stage.privateOn': 'Tes réponses et ton score restent sur ton téléphone',
  'stage.groupOnly': 'Seuls les totaux du groupe sont affichés', 'stage.boardNote': 'Classement facultatif : seulement les noms partagés volontairement', 'stage.q': 'Question {i} / {n}', 'stage.paused': '⏸ En pause',
  'stage.readOpen': '👀 Lisez… les réponses s’ouvrent dans', 'stage.s': 's', 'stage.answerNow': '📱 Répondez sur votre téléphone !', 'stage.locked': 'Réponses fermées.', 'stage.suppressed': 'Les résultats s’affichent dès {n} réponses.',
  'stage.answered': '{a} sur {n} ont répondu', 'stage.shuffled': 'Les réponses sont mélangées sur chaque téléphone et ne s’affichent pas ici.', 'stage.lookPhone': 'Regardez votre téléphone', 'stage.fun': 'C’était amusant !',
  'stage.privateRes': 'Votre résultat personnel est privé : vous seul le voyez.', 'stage.played': '{n} personnes ont joué. Merci !', 'stage.noGroup': 'Pas encore assez de joueurs pour un résultat de groupe !',
  'stage.noGroupWhy': 'Il faut au moins {min} parties terminées pour afficher une moyenne anonyme ; aujourd’hui il y en a {n}. Cela protège la vie privée de chacun.', 'stage.groupResult': '🏢 Notre résultat de groupe',
  'stage.pctCorrect': ' % de bonnes réponses', 'stage.completed': '{n} terminées', 'stage.breakdownLater': 'La répartition s’affiche à partir de {n} parties terminées, pour que les petits groupes restent anonymes.',
  'stage.notMeasure': 'C’est la moyenne des participants d’aujourd’hui, pas une mesure.', 'stage.beforeGo': 'Avant de partir… 💜',
  'stage.nobodyBoard': 'Personne n’a voulu apparaître au classement. C’est très bien aussi !', 'stage.board': '🏆 Classement', 'stage.volunteers': '(volontaires uniquement)',
  'host.start': 'Démarrer ▶', 'host.first': 'Première question 🚦', 'host.open': 'Ouvrir les réponses', 'host.waiting': 'En attente des réponses…', 'host.next': 'Question suivante ▶',
  'host.results': 'Afficher les résultats 🪞', 'host.wrap': 'Conclure ▶', 'host.group': 'Afficher le résultat du groupe 🏢', 'host.reflect': 'Réflexion ▶', 'host.done': 'Terminé 💜',
  'host.resume': '▶ Reprendre', 'host.pause': '⏸ Pause', 'host.fs': '⛶ Plein écran', 'host.keys': 'Espace/→ suivant · P pause · F plein écran', 'host.retrying': 'Nouvelle tentative…',
};

const ar: Dict = {
  'keep.saved': '💾 محفوظة على هذا الهاتف فقط. لا يراها أحد غيرك.', 'keep.delete': '🗑 احذف نتيجتي', 'keep.confirm': 'هل تريد حذف نتيجتك من هذا الهاتف؟ لا يمكن التراجع عن ذلك.', 'keep.deleted': 'تم الحذف. لم يعد هناك أي شيء عنك على هذا الهاتف.', 'keep.title': 'نتيجتك', 'keep.ended': 'انتهت اللعبة. نتيجتك باقية هنا من أجلك.',
  'res.meterLow': 'أنت تقود', 'res.meterHigh': 'الطيار الآلي يقود', 'res.score': 'نتيجتك',
  'nav.discover': 'استكشف', 'nav.play': 'العب', 'nav.create': 'أنشئ', 'nav.host': 'أدِر', 'nav.workspace': 'مساحة عملي',
  'tagline': 'نجمع الناس معًا، لعبةً تلو الأخرى.',
  'privacy.short': 'تبقى الإجابات خاصة. لا تعرض القاعة إلا نتائج جماعية مجهولة الهوية.',
  'practice.banner': 'وضع التدريب · لاعبون افتراضيون فقط. لا يُحفظ أي شيء.',
  'lang.label': 'اللغة',
  'join.title': 'انضم إلى {title}', 'join.aGame': 'لعبة', 'join.code': 'رمز الغرفة', 'join.nickname': 'الاسم المستعار', 'join.avatar': 'اختر صورة رمزية',
  'join.before': '🔒 قبل الانضمام', 'join.screen': 'يظهر اسمك المستعار وصورتك الرمزية على الشاشة الكبيرة.', 'join.private': 'تبقى إجاباتك ونتيجتك خاصة على هاتفك.',
  'join.groupOnly': 'لا تُعرض إلا مجاميع المجموعة.', 'join.noData': 'لا حساب ولا بريد إلكتروني ولا بيانات عن جهازك. المشاركة اختيارية.',
  'join.board': 'أظهر اسمي المستعار ونتيجتي في لوحة الترتيب (اختياري)', 'join.consent': 'فهمت وأرغب في اللعب.',
  'join.started': 'بدأت اللعبة بالفعل', 'join.joining': 'جارٍ الانضمام…', 'join.go': 'انضم 🚗',
  'join.err.code': 'يتكون رمز الغرفة من 6 أرقام.', 'join.err.nick': 'يرجى إدخال اسم مستعار.', 'join.err.consent': 'ضع علامة في المربع لتأكيد رغبتك في اللعب.',
  'join.noRoom': 'لا توجد لعبة جارية بهذا الرمز.', 'join.joined': 'انضم {n}', 'join.connecting': 'جارٍ الاتصال…', 'join.keepTrying': 'سنواصل المحاولة.',
  'join.leave': 'غادر واحذف إجاباتي',
  'phone.ended': 'انتهت هذه اللعبة', 'phone.thanks': 'شكرًا على اللعب!', 'phone.in': 'أنت معنا يا {name}!', 'phone.getReady': 'استعد، السؤال الأول قادم.',
  'phone.watch': 'تابع الشاشة الكبيرة. ستبدأ اللعبة قريبًا.', 'phone.read': '👀 اقرأ…', 'phone.openSoon': 'تُفتح الإجابات قريبًا', 'phone.choose': 'اختر الآن!',
  'phone.paused': '⏸ متوقفة مؤقتًا', 'phone.locked': '✅ تم الحفظ', 'phone.timeUp': '⏰ انتهى الوقت: تم تخطي السؤال ولن يُحسب ضدك',
  'phone.correct': '✅ صحيح!', 'phone.missed': '⏰ فاتك السؤال.', 'phone.notQuite': '🤔 ليس تمامًا.', 'phone.lookScreen': 'انظر إلى الشاشة الكبيرة لترى كيف صوّتت المجموعة.',
  'phone.ready': 'نتيجتك جاهزة', 'phone.tap': 'اضغط لرؤيتها. لا يراها أحد غيرك.', 'phone.onBoard': 'أنت في لوحة الترتيب باسم {name}.',
  'phone.options': 'خيارات الإجابة', 'phone.note': 'ملاحظتك الخاصة (لا يراها غيرك)', 'phone.save': 'حفظ',
  'res.parked': 'توقفت قبل خط النهاية', 'res.notEnough': 'أجبت عن {a} من {t}. هذا لا يكفي لنتيجة منصفة هذه المرة.', 'res.again': 'العب مرة أخرى متى شئت، فالسرعة ليست الهدف.',
  'res.correct': 'صحيحة', 'res.strength': 'نقطة قوة', 'res.notice': 'جدير بالملاحظة', 'res.habit': 'عادة تستحق التجربة', 'res.challenge': 'تحدي الغد',
  'res.copy': '📋 انسخ نتيجتي', 'res.copied': 'تم النسخ. لم تتم مشاركة أي شيء تلقائيًا.', 'res.copyBlocked': 'النسخ غير متاح، التقط صورة للشاشة بدلًا من ذلك.',
  'stage.practiceQr': 'غرفة تدريب · في اللعبة الحقيقية يمسح اللاعبون هذا الرمز', 'stage.scan': 'امسح الرمز أو افتح الرابط وأدخل', 'stage.joined': 'انضموا',
  'stage.more': 'بقي {n} لعرض نتائج المجموعة', 'stage.readS': '{n} ث للقراءة', 'stage.answerS': '{n} ث للإجابة على هاتفك', 'stage.privateOn': 'تبقى إجاباتك ونتيجتك على هاتفك',
  'stage.groupOnly': 'لا تُعرض إلا مجاميع المجموعة', 'stage.boardNote': 'لوحة ترتيب اختيارية: فقط الأسماء التي اختار أصحابها مشاركتها', 'stage.q': 'السؤال {i} / {n}', 'stage.paused': '⏸ متوقفة مؤقتًا',
  'stage.readOpen': '👀 اقرأوا… تُفتح الإجابات خلال', 'stage.s': 'ث', 'stage.answerNow': '📱 أجيبوا على هواتفكم!', 'stage.locked': 'أُغلقت الإجابات.', 'stage.suppressed': 'تظهر النتائج عند إجابة {n} أشخاص أو أكثر.',
  'stage.answered': 'أجاب {a} من {n}', 'stage.shuffled': 'تُخلط الخيارات على كل هاتف ولا تُعرض هنا.', 'stage.lookPhone': 'انظروا إلى هواتفكم', 'stage.fun': 'كانت ممتعة!',
  'stage.privateRes': 'نتيجتك الشخصية خاصة، لا يراها أحد غيرك.', 'stage.played': 'شارك {n} أشخاص. شكرًا لكم!', 'stage.noGroup': 'عدد اللاعبين لا يكفي بعدُ لنتيجة جماعية!',
  'stage.noGroupWhy': 'نحتاج إلى {min} مشاركات مكتملة على الأقل لعرض متوسط مجهول الهوية، ولدينا اليوم {n}. هذا يحمي خصوصية الجميع.', 'stage.groupResult': '🏢 نتيجة مجموعتنا',
  'stage.pctCorrect': '٪ صحيحة', 'stage.completed': 'أكمل {n}', 'stage.breakdownLater': 'يظهر التوزيع ابتداءً من {n} مشاركة مكتملة، كي تبقى المجموعات الصغيرة مجهولة الهوية.',
  'stage.notMeasure': 'هذا متوسط المشاركين اليوم، وليس قياسًا.', 'stage.beforeGo': 'قبل أن تغادروا… 💜',
  'stage.nobodyBoard': 'لم يختر أحد الظهور في لوحة الترتيب، ولا بأس بذلك!', 'stage.board': '🏆 لوحة الترتيب', 'stage.volunteers': '(المتطوعون فقط)',
  'host.start': 'ابدأ ◀', 'host.first': 'السؤال الأول 🚦', 'host.open': 'افتح الإجابات الآن', 'host.waiting': 'بانتظار الإجابات…', 'host.next': 'السؤال التالي ◀',
  'host.results': 'اعرض النتائج 🪞', 'host.wrap': 'الختام ◀', 'host.group': 'اكشف نتيجة المجموعة 🏢', 'host.reflect': 'التأمل ◀', 'host.done': 'انتهت 💜',
  'host.resume': '◀ استئناف', 'host.pause': '⏸ إيقاف مؤقت', 'host.fs': '⛶ ملء الشاشة', 'host.keys': 'مسافة/← التالي · P إيقاف · F ملء الشاشة', 'host.retrying': 'إعادة المحاولة…',
};

export const LOCALES = {
  en: { dir: 'ltr' as const, label: 'English', strings: en as Dict },
  de: { dir: 'ltr' as const, label: 'Deutsch', strings: de },
  fr: { dir: 'ltr' as const, label: 'Français', strings: fr },
  ar: { dir: 'rtl' as const, label: 'العربية', strings: ar },
};
export type Locale = keyof typeof LOCALES;
const KEY = 'pp_lang';
const pick = (): Locale => {
  try { const s = localStorage.getItem(KEY); if (s && s in LOCALES) return s as Locale; } catch { /* ignore */ }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').slice(0, 2);
  return (nav in LOCALES ? nav : 'en') as Locale;
};
let current: Locale = pick();
const subs = new Set<() => void>();
const apply = () => { if (typeof document !== 'undefined') { document.documentElement.lang = current; document.documentElement.dir = LOCALES[current].dir; } };
apply();

export const lang = () => current;
export const dir = () => LOCALES[current].dir;
export function setLang(l: Locale) { current = l; try { localStorage.setItem(KEY, l); } catch { /* ignore */ } apply(); subs.forEach(f => f()); }
export const onLang = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export function t(k: Key, vars?: Record<string, string | number>) {
  let s = LOCALES[current].strings[k] ?? en[k] ?? k;
  if (vars) for (const [n, v] of Object.entries(vars)) s = s.split(`{${n}}`).join(String(v));
  return s;
}
