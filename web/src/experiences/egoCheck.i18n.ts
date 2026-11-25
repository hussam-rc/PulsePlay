// Translations of "Who is in Control?" (same ids, points, bands and themes as the English original).
// German uses Swiss spelling (ss). Arabic is Modern Standard Arabic. Please have native speakers review before client use.
import type { Experience } from '../engine/schema';
import { egoCheck } from './egoCheck';

type Q = [string, [string, string, string, string]];
type Band = [string, string, string, string, string]; // title, message, explanation, groupTitle, groupMessage
type Theme = [string, string, string, string, string]; // label, strength, growth, habit, challenge
interface Tr {
  title: string; tagline: string; description: string; disclaimer: string;
  q: Record<string, Q>; results: [Band, Band, Band, Band]; transitions: string[];
  closing: { questions: string[]; message: string }; defaultHabit: string; defaultChallenge: string; themes: Record<string, Theme>;
}

const de: Tr = {
  title: 'Wer hat das Steuer?', tagline: 'Wer fährt heute: du oder dein Ego?',
  description: 'Zehn Alltagsmomente bei der Arbeit, je ein paar Sekunden. Geh mit deinem ersten Impuls und schau dann in einen privaten Spiegel: Sitzt du am Steuer, oder fahren deine Reflexe? Die Gruppe sieht nur einen anonymen Teamwert.',
  disclaimer: 'Ein augenzwinkerndes Reflexionsspiel, kein psychologischer Test und kein Leistungsinstrument. Gefühle zählen nie gegen dich, nur Reaktionen.',
  q: {
    q1: ['Deine Folie wird im Meeting zerpflückt. Erste Reaktion?', ['Ich starte eine Gegenpräsentation mit 12 Folien. 🛡️', 'Ich lächle, nicke und beschliesse still, dass sie keinen Geschmack haben.', 'Autsch. Aber ich höre zu.', '«Fair! Was würdest du ändern?»']],
    q2: ['Eine Kollegin bekommt Applaus für etwas, das du mitgebaut hast.', ['Ich spiele die Szene den ganzen Abend im Kopf ab. 🎬', '«Fun Fact: Das war zum Teil ich!» 🙋', 'Ich klatsche am lautesten. 👏', 'Ein kleines «hmm», dann hole ich mir einen Kaffee.']],
    q3: ['Hoppla. Du entdeckst gerade deinen eigenen Fehler.', ['Ich hebe die Hand: «Mein Fehler, ich behebe ihn!»', 'Ich prüfe zuerst, wer sonst noch daran gearbeitet hat. 🕵️', 'Ich behebe ihn um 23 Uhr und sage niemandem etwas. 🥷', 'Ich erkläre, was passiert ist, und stehe dazu.']],
    q4: ['Jemand ist mit deiner brillanten Idee nicht einverstanden.', ['Ich erkläre sie nochmals. Lauter. 📢', '«Spannend! Was siehst du, das ich nicht sehe?»', 'Innerlich seufzen, äusserlich offen bleiben.', 'Die Person hat es offensichtlich noch nicht verstanden.']],
    q5: ['Ein Kollege schlägt einen Ansatz vor, der … tatsächlich besser ist als deiner.', ['Wechseln! Die beste Idee gewinnt. 🏆', 'Gib mir kurz Zeit zum Trauern, dann bin ich dabei.', 'Ich verteidige meine Idee wie mein Erstgeborenes.', '«Super!» (Ich suche schon nach den Schwachstellen.) 🔍']],
    q6: ['Deine Chefin will Änderungen an etwas, das du tagelang poliert hast.', ['Ich nehme es persönlich. 💔', '«Klar, welches Ergebnis brauchst du?»', 'Ich sage «aber …», bevor sie den Satz beendet.', 'Enttäuscht, aber ich höre zu.']],
    q7: ['Du wirst mitten im Satz unterbrochen. Schon wieder.', ['Meine Augenbrauen übernehmen das Reden. 🤨', '«Lass mich den Gedanken beenden, dann bin ich ganz Ohr.»', 'Ich unterbreche zurück. Fair ist fair. 🎤', 'Ich lasse ausreden und nehme dann ruhig meinen Faden wieder auf.']],
    q8: ['Das Team feiert einen grossen Erfolg, und niemand erwähnt deinen Beitrag.', ['Der Kuchen schmeckt plötzlich schlechter. 🍰', 'Erfolg ist Erfolg. Party! 🎉', 'Ich schicke ein Recap-Mail mit meinen Beiträgen.', 'Ich merke es, zucke mit den Schultern und geniesse den Kuchen.']],
    q9: ['Jemand fragt dich etwas, wovon du keine Ahnung hast.', ['«Keine Ahnung, aber ich finde es heraus!»', 'Ich antworte trotzdem souverän. Klingt plausibel. 🤓', '«Fragen wir jemanden, der es wirklich weiss.»', 'Ich wechsle das Thema zum Wetter. ☀️']],
    q10: ['Du bist dir 100 % sicher, aber das Team wählt eine andere Richtung.', ['Ich argumentiere weiter, bis das Meeting vorbei ist. ⏰', 'Ich sage meine Bedenken und ziehe dann voll mit.', 'Ich mache mit, warte aber heimlich auf mein «Hab ich doch gesagt».', 'Ich bleibe neugierig und helfe, dass es funktioniert.']],
  },
  results: [
    ['Cool, ruhig und am Steuer!', 'Dein Ego macht ein Nickerchen auf dem Rücksitz. 😴 Du fährst. Weiter so!', 'Deine Antworten zeigen Neugier, Bescheidenheit und Offenheit, auch in Momenten, die wehtun.', 'Unser Team ist cool, ruhig und am Steuer!', 'Unsere Egos schlafen. Wir entscheiden, wie wir reagieren. 😴'],
    ['Du hast meistens die Kontrolle!', 'Ab und zu hupt dein Ego vom Rücksitz. 📯 Aber meistens behältst du das Steuer.', 'Die meisten deiner Reaktionen sind offen und kooperativ. Einige Situationen ziehen dich ins Verteidigen oder Beweisen, was sehr menschlich ist.', 'Wir haben meistens die Kontrolle!', 'Ein paar Hupen vom Rücksitz, aber wir behalten das Steuer. 📯'],
    ['Dein Ego greift manchmal ins Steuer', 'In manchen Momenten lenkt dein erster Reflex. Es zu bemerken ist der schwierigste Teil, und das hast du gerade getan.', 'In mehreren Situationen hat dein erster Reflex deine Position oder deine Anerkennung geschützt. Das zu bemerken ist der schwierigste Teil, und das hast du gerade getan.', 'Unsere Egos greifen manchmal ins Steuer', 'Unsere Reflexe übernehmen ab und zu. Gut, dass wir es merken. 🚦'],
    ['Zeit, das Steuer zurückzuholen!', 'Heute ist dein Ego viel gefahren. Gute Nachricht: Reflexe lassen sich umtrainieren, eine Pause nach der anderen. 💪', 'Heute haben deine schnellen Reaktionen eher verteidigt, überzeugt oder Anerkennung beansprucht. Das sagt mehr über schnelle Reflexe als darüber, wer du bist, und Reflexe kann man trainieren.', 'Holen wir uns das Steuer gemeinsam zurück!', 'Unsere Egos sind heute viel gefahren. Ein guter Startpunkt für dieses Gespräch. 🏎️'],
  ],
  transitions: ['Ein paar Reflexe sind gerade aufgewacht … 👀', 'Der Spiegel hat das gesehen. 🪞', 'Hände ans Steuer, alle! 🚗', 'Warst das du oder dein Ego? 🤔', 'Grünes Licht, weiter geht\'s! 🚦', 'Kurz in den Rückspiegel schauen. 😏', 'Das Lama schaut zu. 🦙', 'Anschnallen, die nächste ist scharf. 🌶️', 'Niemand hat deine Antwort gesehen. Nur du. 🤫', 'Ziellinie! 🏁'],
  closing: { questions: ['Wann übernimmt mein Ego das Steuer?', 'Wie kann ich es früher bemerken?', 'Was kann ich morgen anders machen?'], message: 'Reflexe sind menschlich. Lass sie nur nicht jedes Meeting fahren. 🚗💜' },
  defaultHabit: 'Frag im Meeting weiterhin: «Was übersehe ich?» So bleibst du am Steuer.',
  defaultChallenge: 'Frag diese Woche eine Kollegin oder einen Kollegen, wie du sie besser unterstützen kannst.',
  themes: {
    feedback: ['Feedback', 'Du bleibst offen, wenn deine Arbeit kritisiert wird.', 'Kritik bringt dich schnell in die Verteidigung.', 'Wenn Feedback kommt, stell zuerst eine Frage, bevor du antwortest.', 'Frag jemanden: «Was könnte ich besser machen?» Und hör einfach zu.'],
    credit: ['Anerkennung', 'Du kannst den Erfolg anderer feiern, ohne mitzuzählen.', 'Anerkennung für gemeinsame Arbeit ist dir sehr wichtig.', 'Nenne jede Woche laut den Beitrag einer Kollegin oder eines Kollegen.', 'Danke diesen Monat jemandem öffentlich für seine Hilfe.'],
    mistake: ['Fehler', 'Du stehst offen zu deinen Fehlern.', 'Bei einem Fehler schaust du zuerst woanders hin.', 'Sag früh «das geht auf mich» und teile dann die Lösung.', 'Teile einen kleinen Fehler mit deinem Team und was du daraus gelernt hast.'],
    disagree: ['Widerspruch', 'Du wirst neugierig, wenn andere anderer Meinung sind.', 'Widerspruch schaltet dich in den Überzeugungsmodus.', 'Bevor du antwortest, fasse ihre Sicht in einem Satz zusammen.', 'Frag bei der nächsten Meinungsverschiedenheit zuerst: «Was übersehe ich?»'],
    idea: ['Bessere Ideen', 'Bei dir gewinnt die beste Idee, egal von wem.', 'Die eigene Idee loszulassen fällt dir schwer.', 'Frag «welche Option ist die beste für den Kunden?» statt «wessen Idee?».', 'Baue im nächsten Meeting auf der Idee von jemand anderem auf.'],
    change: ['Änderungswünsche', 'Du konzentrierst dich auf das Ergebnis, nicht auf deinen Stolz.', 'Änderungswünsche fühlen sich schnell persönlich an.', 'Frag «welches Ergebnis brauchst du?», bevor du die Arbeit verteidigst.', 'Frag bei einem Änderungswunsch zuerst nach dem Ziel, bevor du reagierst.'],
    interrupt: ['Unterbrechungen', 'Du bleibst ruhig bei deinem Punkt, wenn du unterbrochen wirst.', 'Unterbrechungen können einen Gegenangriff auslösen.', 'Probier: «Lass mich den Gedanken beenden, dann bin ich ganz Ohr.»', 'Bemerke einen Moment, in dem du unterbrechen willst, und warte drei Sekunden.'],
    teamwin: ['Teamerfolge', 'Gemeinsame Erfolge genügen dir.', 'Nicht erwähnt zu werden kann einen schönen Moment trüben.', 'Feiere zuerst das Teamergebnis; sprich Anerkennung später unter vier Augen an, wenn es wichtig ist.', 'Gratuliere dem Team zu einem Erfolg und lass dich selbst dabei weg.'],
    unknown: ['Nicht wissen', 'Du sagst ohne Mühe «ich weiss es nicht».', 'Nicht zu wissen fühlt sich an wie Gesichtsverlust.', 'Übe: «Ich weiss es noch nicht, ich finde es heraus.»', 'Sag morgen mindestens einmal «ich weiss es nicht», und bleib dran.'],
    decision: ['Teamentscheide', 'Du ziehst mit, sobald das Team entschieden hat.', 'Nach einem Entscheid loszulassen kostet dich Kraft.', 'Schreib nach einem Entscheid auf, wie du hilfst, dass er funktioniert.', 'Hilf einem Entscheid voran, mit dem du nicht einverstanden warst.'],
  },
};

const fr: Tr = {
  title: 'Qui est aux commandes ?', tagline: 'Qui conduit aujourd’hui : toi ou ton ego ?',
  description: 'Dix situations de travail du quotidien, quelques secondes chacune. Suis ton premier instinct, puis regarde-toi dans un miroir privé : es-tu au volant, ou tes réflexes conduisent-ils ? Le groupe ne voit qu’un score d’équipe anonyme.',
  disclaimer: 'Un jeu de réflexion avec humour, pas un test psychologique ni un outil d’évaluation. Les émotions ne comptent jamais contre toi, seules les réactions comptent.',
  q: {
    q1: ['Ta présentation se fait démolir en réunion. Première réaction ?', ['Je lance une contre-présentation de 12 slides. 🛡️', 'Je souris, je hoche la tête et je décide en silence qu’ils n’ont aucun goût.', 'Aïe. Mais je les écoute.', '« Juste ! Qu’est-ce que tu changerais ? »']],
    q2: ['Une collègue est applaudie pour un projet que tu as aidé à construire.', ['Je repasse la scène dans ma tête toute la soirée. 🎬', '« Anecdote : c’était un peu moi ! » 🙋', 'J’applaudis le plus fort. 👏', 'Un petit « hmm », puis je vais chercher un café.']],
    q3: ['Oups. Tu viens de repérer ta propre erreur.', ['Je lève la main : « Ma faute, je corrige ! »', 'Je vérifie d’abord qui d’autre y a touché. 🕵️', 'Je corrige à 23 h et je n’en parle à personne. 🥷', 'J’explique ce qui s’est passé et je l’assume.']],
    q4: ['Quelqu’un n’est pas d’accord avec ton idée brillante.', ['Je la réexplique. Plus fort. 📢', '« Intéressant ! Qu’est-ce que tu vois que je ne vois pas ? »', 'Soupir intérieur, esprit ouvert à l’extérieur.', 'Visiblement, il n’a pas encore compris.']],
    q5: ['Un collègue propose une approche… vraiment meilleure que la tienne.', ['On change ! La meilleure idée gagne. 🏆', 'Laisse-moi faire mon deuil une minute, puis je suis partant.', 'Je défends mon idée comme mon premier-né.', '« Super ! » (Je cherche déjà ses failles.) 🔍']],
    q6: ['Ta responsable demande des changements sur un travail que tu as peaufiné pendant des jours.', ['Je le prends personnellement. 💔', '« Bien sûr, de quel résultat as-tu besoin ? »', 'Je dis « mais… » avant qu’elle finisse sa phrase.', 'Déçu, mais j’écoute.']],
    q7: ['On te coupe la parole en pleine phrase. Encore.', ['Mes sourcils parlent pour moi. 🤨', '« Laisse-moi finir cette idée, ensuite je t’écoute. »', 'Je lui coupe la parole à mon tour. Chacun son tour. 🎤', 'Je le laisse finir, puis je reprends calmement mon fil.']],
    q8: ['L’équipe remporte un grand succès, et personne ne mentionne ta contribution.', ['Le gâteau a soudain moins bon goût. 🍰', 'Une victoire est une victoire. Place à la fête ! 🎉', 'J’envoie un récapitulatif par e-mail avec mes contributions.', 'Je le remarque, je hausse les épaules et je savoure le gâteau.']],
    q9: ['On te pose une question dont tu n’as aucune idée.', ['« Aucune idée, mais je vais trouver ! »', 'Je réponds avec assurance quand même. Ça a l’air crédible. 🤓', '« Demandons à quelqu’un qui sait vraiment. »', 'Je change de sujet et parle de la météo. ☀️']],
    q10: ['Tu es sûr à 100 % d’avoir raison, mais l’équipe choisit une autre direction.', ['Je continue à argumenter jusqu’à la fin de la réunion. ⏰', 'Je partage mes doutes, puis je soutiens pleinement la décision.', 'Je suis le mouvement, mais j’attends en secret mon « je vous l’avais dit ».', 'Je reste curieux et j’aide à ce que ça marche.']],
  },
  results: [
    ['Cool, calme et au volant !', 'Ton ego fait la sieste à l’arrière. 😴 C’est toi qui conduis. Continue comme ça !', 'Tes réponses montrent de la curiosité, de l’humilité et de l’ouverture, même dans les moments qui piquent.', 'Notre équipe est cool, calme et aux commandes !', 'Nos egos font la sieste. Nous choisissons comment réagir. 😴'],
    ['Tu gardes presque toujours le contrôle !', 'De temps en temps, ton ego klaxonne depuis l’arrière. 📯 Mais tu gardes en général le volant.', 'La plupart de tes réactions sont ouvertes et coopératives. Quelques situations te poussent à te défendre ou à faire tes preuves, ce qui est très humain.', 'Nous gardons presque toujours le contrôle !', 'Quelques coups de klaxon à l’arrière, mais nous gardons le volant. 📯'],
    ['Ton ego prend parfois le volant', 'Dans certains moments, ton premier réflexe dirige. Le remarquer est le plus difficile, et tu viens de le faire.', 'Dans plusieurs situations, ton premier réflexe a protégé ta position ou ta reconnaissance. Le remarquer est le plus difficile, et tu viens de le faire.', 'Nos egos prennent parfois le volant', 'Nos réflexes prennent parfois le dessus. Heureusement qu’on le remarque. 🚦'],
    ['Il est temps de reprendre le volant !', 'Aujourd’hui, ton ego a beaucoup conduit. Bonne nouvelle : les réflexes se rééduquent, une pause à la fois. 💪', 'Aujourd’hui, tes réactions rapides ont plutôt défendu, convaincu ou revendiqué le mérite. Cela en dit plus sur des réflexes rapides que sur qui tu es, et les réflexes s’entraînent.', 'Reprenons le volant ensemble !', 'Nos egos ont beaucoup conduit aujourd’hui. Un excellent point de départ pour en parler. 🏎️'],
  ],
  transitions: ['Quelques réflexes viennent de se réveiller… 👀', 'Le miroir a tout vu. 🪞', 'Les mains sur le volant, tout le monde ! 🚗', 'C’était toi ou ton ego ? 🤔', 'Feu vert, on continue ! 🚦', 'Un petit coup d’œil dans le rétroviseur. 😏', 'Le lama vous regarde. 🦙', 'Attachez vos ceintures, celle-ci est épicée. 🌶️', 'Personne n’a vu ta réponse. Seulement toi. 🤫', 'Ligne d’arrivée ! 🏁'],
  closing: { questions: ['Quand mon ego prend-il le volant ?', 'Comment le remarquer plus tôt ?', 'Que puis-je faire autrement demain ?'], message: 'Les réflexes sont humains. Ne les laisse simplement pas conduire chaque réunion. 🚗💜' },
  defaultHabit: 'Continue à demander « qu’est-ce que je rate ? » en réunion. Ça te garde au volant.',
  defaultChallenge: 'Demande cette semaine à un collègue comment tu pourrais mieux le soutenir.',
  themes: {
    feedback: ['Feedback', 'Tu restes ouvert quand ton travail est critiqué.', 'La critique te met vite sur la défensive.', 'Quand un feedback arrive, pose une question avant de répondre.', 'Demande à un collègue : « Que pourrais-je mieux faire ? » Et écoute simplement.'],
    credit: ['Reconnaissance', 'Tu sais célébrer la réussite d’un collègue sans compter les points.', 'La reconnaissance pour un travail commun compte beaucoup pour toi.', 'Cite chaque semaine à voix haute la contribution d’un collègue.', 'Remercie publiquement quelqu’un pour son aide ce mois-ci.'],
    mistake: ['Erreurs', 'Tu assumes ouvertement tes erreurs.', 'Face à une erreur, tu regardes d’abord ailleurs.', 'Dis tôt « c’est pour moi », puis partage la solution.', 'Partage une petite erreur avec ton équipe et ce que tu en as appris.'],
    disagree: ['Désaccord', 'Tu deviens curieux quand on n’est pas d’accord avec toi.', 'Le désaccord te fait passer en mode « convaincre ».', 'Avant de répondre, résume leur point de vue en une phrase.', 'Lors du prochain désaccord, demande d’abord : « Qu’est-ce que je rate ? »'],
    idea: ['Meilleures idées', 'Tu laisses gagner la meilleure idée, peu importe d’où elle vient.', 'Lâcher ta propre idée est difficile.', 'Demande « quelle option est la meilleure pour le client ? » plutôt que « l’idée de qui ? ».', 'Construis sur l’idée de quelqu’un d’autre lors de ta prochaine réunion.'],
    change: ['Demandes de changement', 'Tu te concentres sur le résultat, pas sur ta fierté.', 'Les demandes de changement peuvent sembler personnelles.', 'Demande « de quel résultat as-tu besoin ? » avant de défendre ton travail.', 'Face à une demande de changement, interroge l’objectif avant de réagir.'],
    interrupt: ['Interruptions', 'Tu gardes calmement ta position quand on t’interrompt.', 'Les interruptions peuvent déclencher une contre-attaque.', 'Essaie : « Laisse-moi finir cette idée, ensuite je t’écoute. »', 'Repère un moment où tu veux interrompre, et attends trois secondes.'],
    teamwin: ['Victoires d’équipe', 'Les succès partagés te suffisent.', 'Ne pas être mentionné peut gâcher un beau moment.', 'Célèbre d’abord le résultat de l’équipe ; parle de reconnaissance plus tard en tête-à-tête si c’est important.', 'Félicite l’équipe pour une réussite sans te mettre en avant.'],
    unknown: ['Ne pas savoir', 'Tu dis facilement « je ne sais pas ».', 'Ne pas savoir peut donner l’impression de perdre la face.', 'Entraîne-toi : « Je ne sais pas encore, je vais trouver. »', 'Dis « je ne sais pas » au moins une fois demain, et fais le suivi.'],
    decision: ['Décisions d’équipe', 'Tu t’engages dès que l’équipe a décidé.', 'Lâcher prise après une décision te demande un vrai effort.', 'Une fois la décision prise, note une façon d’aider à ce qu’elle réussisse.', 'Aide à faire avancer une décision avec laquelle tu n’étais pas d’accord.'],
  },
};

const ar: Tr = {
  title: 'من يمسك المقود؟', tagline: 'من يقود اليوم: أنت أم الأنا لديك؟',
  description: 'عشرة مواقف يومية في العمل، لكلٍّ منها بضع ثوانٍ. اتبع حدسك الأول، ثم انظر في مرآة خاصة: هل أنت خلف المقود، أم أن ردود فعلك هي التي تقود؟ لا ترى المجموعة إلا نتيجة جماعية مجهولة الهوية.',
  disclaimer: 'لعبة تأمل خفيفة الظل، وليست اختبارًا نفسيًا ولا أداة لتقييم الأداء. المشاعر لا تُحسب ضدك أبدًا، وحدها ردود الفعل تُحسب.',
  q: {
    q1: ['تتعرض شريحتك لانتقاد لاذع في اجتماع. ما ردة فعلك الأولى؟', ['أطلق عرضًا مضادًا من 12 شريحة. 🛡️', 'أبتسم وأومئ برأسي، وأقرر في سري أن ذوقهم سيئ.', 'آخ. لكنني أستمع إليهم.', '«معكم حق! ماذا كنتم ستغيرون؟»']],
    q2: ['زميلتك تنال تصفيقًا على عمل ساعدتَ في بنائه.', ['أعيد المشهد في رأسي طوال المساء. 🎬', '«معلومة طريفة: جزء من هذا كان من عملي!» 🙋', 'أصفق بأعلى صوت. 👏', '«همم» صغيرة، ثم أذهب لأحضر قهوة.']],
    q3: ['أوبس. اكتشفتَ للتو خطأً ارتكبته أنت.', ['أرفع يدي: «خطئي، سأصلحه!»', 'أتحقق أولًا ممن عمل عليه أيضًا. 🕵️', 'أصلحه في الحادية عشرة ليلًا ولا أخبر أحدًا. 🥷', 'أشرح ما حدث وأتحمل المسؤولية.']],
    q4: ['شخص ما لا يوافق على فكرتك العبقرية.', ['أشرحها مرة أخرى. بصوت أعلى. 📢', '«مثير للاهتمام! ما الذي تراه ولا أراه؟»', 'تنهيدة في الداخل، وعقل منفتح في الخارج.', 'من الواضح أنه لم يفهمها بعد.']],
    q5: ['زميل يقترح طريقة… أفضل من طريقتك فعلًا.', ['لنغيّر! الفكرة الأفضل تفوز. 🏆', 'أمهلني لحظة لأحزن، ثم أنا معكم.', 'أدافع عن فكرتي كأنها مولودي الأول.', '«رائع!» (وأنا أبحث بالفعل عن عيوبها.) 🔍']],
    q6: ['مديرتك تطلب تعديلات على عمل صقلته لأيام.', ['آخذ الأمر على محمل شخصي. 💔', '«بالتأكيد، ما النتيجة التي تحتاجينها؟»', 'أقول «لكن…» قبل أن تُنهي جملتها.', 'أشعر بخيبة أمل، لكنني أستمع.']],
    q7: ['يقاطعك أحدهم في منتصف الجملة. مرة أخرى.', ['حاجباي يتكلمان نيابة عني. 🤨', '«دعني أُكمل هذه الفكرة، ثم أنا كلي آذان صاغية.»', 'أقاطعه بدوري. العين بالعين. 🎤', 'أتركه يُكمل، ثم أعود بهدوء إلى فكرتي.']],
    q8: ['الفريق يحقق نجاحًا كبيرًا، ولا أحد يذكر دورك.', ['فجأة يصبح طعم الكعكة أسوأ. 🍰', 'النجاح نجاح. وقت الاحتفال! 🎉', 'أرسل بريدًا إلكترونيًا يلخص مساهماتي.', 'ألاحظ ذلك، أهز كتفيّ، وأستمتع بالكعكة.']],
    q9: ['يسألك أحدهم عن شيء لا تعرف عنه شيئًا.', ['«لا أعرف، لكنني سأعرف!»', 'أجيب بثقة على أي حال. يبدو مقنعًا. 🤓', '«لنسأل شخصًا يعرف حقًا.»', 'أغيّر الموضوع إلى الطقس. ☀️']],
    q10: ['أنت متأكد مئة بالمئة أنك على حق، لكن الفريق يختار اتجاهًا آخر.', ['أواصل الجدال حتى ينتهي الاجتماع. ⏰', 'أعبّر عن مخاوفي، ثم أدعم القرار بالكامل.', 'أوافق، لكنني أنتظر سرًا لحظة «ألم أقل لكم؟».', 'أبقى فضوليًا وأساعد على إنجاحه.']],
  },
  results: [
    ['هادئ ورائق وخلف المقود!', 'الأنا لديك يأخذ قيلولة في المقعد الخلفي. 😴 أنت من يقود. استمر هكذا!', 'تُظهر إجاباتك فضولًا وتواضعًا وانفتاحًا، حتى في اللحظات المؤلمة.', 'فريقنا هادئ ورائق وممسك بالمقود!', 'الأنا لدينا نائم. نحن من يختار كيف نتصرف. 😴'],
    ['أنت ممسك بالمقود في معظم الأحيان!', 'من حين لآخر يطلق الأنا لديك البوق من المقعد الخلفي. 📯 لكنك غالبًا تحتفظ بالمقود.', 'معظم ردود فعلك منفتحة وتعاونية. بعض المواقف تدفعك إلى الدفاع عن نفسك أو إثبات ذاتك، وهذا أمر إنساني جدًا.', 'نحن ممسكون بالمقود في معظم الأحيان!', 'بضع أبواق من المقعد الخلفي، لكننا نحتفظ بالمقود. 📯'],
    ['الأنا يمسك المقود أحيانًا', 'في بعض اللحظات تقود ردة فعلك الأولى. ملاحظة ذلك هي أصعب جزء، وقد فعلته للتو.', 'في عدة مواقف حمت ردة فعلك الأولى موقعك أو التقدير الذي تستحقه. ملاحظة ذلك هي أصعب جزء، وقد فعلته للتو.', 'الأنا لدينا يمسك المقود أحيانًا', 'ردود فعلنا تتولى القيادة أحيانًا. من الجيد أننا ننتبه لذلك. 🚦'],
    ['حان وقت استعادة المقود!', 'اليوم قاد الأنا لديك كثيرًا. الخبر الجيد: يمكن تدريب ردود الفعل من جديد، وقفة بعد وقفة. 💪', 'اليوم مالت ردود فعلك السريعة إلى الدفاع أو الإقناع أو المطالبة بالتقدير. هذا يقول عن سرعة ردود الفعل أكثر مما يقول عن حقيقتك، وردود الفعل يمكن تدريبها.', 'لنستعد المقود معًا!', 'الأنا لدينا قاد كثيرًا اليوم. نقطة انطلاق رائعة لهذا الحديث. 🏎️'],
  ],
  transitions: ['بعض ردود الفعل استيقظت للتو… 👀', 'المرآة رأت ذلك. 🪞', 'الأيدي على المقود يا جماعة! 🚗', 'هل كان ذلك أنت أم الأنا لديك؟ 🤔', 'الإشارة خضراء، لنكمل! 🚦', 'نظرة سريعة في المرآة الخلفية. 😏', 'اللاما تراقب. 🦙', 'اربطوا الأحزمة، السؤال القادم حار. 🌶️', 'لم يرَ أحد إجابتك. أنت فقط. 🤫', 'خط النهاية! 🏁'],
  closing: { questions: ['متى يمسك الأنا لديّ بالمقود؟', 'كيف ألاحظ ذلك في وقت أبكر؟', 'ماذا يمكنني أن أفعل بشكل مختلف غدًا؟'], message: 'ردود الفعل أمر إنساني. فقط لا تدعها تقود كل اجتماع. 🚗💜' },
  defaultHabit: 'واصل السؤال في الاجتماعات: «ما الذي يفوتني؟» هكذا تبقى خلف المقود.',
  defaultChallenge: 'اسأل زميلًا هذا الأسبوع كيف يمكنك دعمه بشكل أفضل.',
  themes: {
    feedback: ['الملاحظات', 'تبقى منفتحًا عندما يُنتقد عملك.', 'النقد قد يضعك في موقف دفاعي بسرعة.', 'عندما تصلك ملاحظة، اطرح سؤالًا واحدًا قبل أن ترد.', 'اسأل زميلًا: «ما الشيء الذي يمكنني تحسينه؟» واكتفِ بالاستماع.'],
    credit: ['التقدير', 'تستطيع الاحتفال بنجاح زميل دون أن تحسب النقاط.', 'التقدير على العمل المشترك يهمك كثيرًا.', 'اذكر كل أسبوع مساهمة زميل بصوت عالٍ.', 'اشكر شخصًا علنًا على مساعدة قدّمها لك هذا الشهر.'],
    mistake: ['الأخطاء', 'تعترف بأخطائك بصراحة.', 'عند الخطأ قد تبحث أولًا في مكان آخر.', 'قل مبكرًا «هذا خطئي»، ثم شارك الحل.', 'شارك فريقك خطأً صغيرًا وما تعلمته منه.'],
    disagree: ['الاختلاف', 'يثير فضولك أن يختلف الآخرون معك.', 'الاختلاف قد يحوّلك إلى وضع الإقناع.', 'قبل أن ترد، لخّص وجهة نظرهم في جملة واحدة.', 'في الخلاف القادم، اسأل أولًا: «ما الذي يفوتني؟»'],
    idea: ['أفكار أفضل', 'تدع الفكرة الأفضل تفوز أيًا كان صاحبها.', 'التخلي عن فكرتك أمر صعب عليك.', 'اسأل «أي خيار هو الأفضل للعميل؟» بدلًا من «فكرة من؟».', 'ابنِ على فكرة شخص آخر في اجتماعك القادم.'],
    change: ['طلبات التعديل', 'تركّز على النتيجة لا على كبريائك.', 'طلبات التعديل قد تبدو أمرًا شخصيًا.', 'اسأل «ما النتيجة التي تحتاجها؟» قبل الدفاع عن العمل.', 'عند طلب تعديل، اسأل عن الهدف قبل أن تتفاعل.'],
    interrupt: ['المقاطعة', 'تحافظ على موقفك بهدوء عندما يقاطعك أحد.', 'المقاطعة قد تستفز هجومًا مضادًا.', 'جرّب: «دعني أُكمل هذه الفكرة، ثم أنا كلي آذان صاغية.»', 'لاحظ لحظة تريد فيها المقاطعة، وانتظر ثلاث ثوانٍ.'],
    teamwin: ['نجاحات الفريق', 'النجاح المشترك يكفيك.', 'ألا يُذكر اسمك قد يفسد لحظة جميلة.', 'احتفل بنتيجة الفريق أولًا، وناقش التقدير لاحقًا على انفراد إن كان مهمًا.', 'هنّئ الفريق على نجاح دون أن تذكر نفسك.'],
    unknown: ['عدم المعرفة', 'تقول «لا أعرف» بارتياح.', 'عدم المعرفة قد يشعرك بفقدان ماء الوجه.', 'تدرّب على: «لا أعرف بعد، وسأعرف.»', 'قل «لا أعرف» مرة واحدة على الأقل غدًا، وتابع الأمر.'],
    decision: ['قرارات الفريق', 'تلتزم بالقرار بمجرد أن يتخذه الفريق.', 'التخلي بعد اتخاذ القرار يتطلب منك جهدًا حقيقيًا.', 'بعد اتخاذ القرار، اكتب طريقة واحدة ستساعد بها على نجاحه.', 'ساعد في دفع قرار لم تكن موافقًا عليه إلى الأمام.'],
  },
};

const TR = { de, fr, ar } as const;
export type ContentLang = 'en' | keyof typeof TR;

/** The same game in another language: identical ids, points, bands and themes, so results are comparable across languages. */
export function localize(lang: keyof typeof TR): Experience {
  const tr = TR[lang], e: Experience = structuredClone(egoCheck);
  e.id = `ego-check-${lang}`; e.languages = [lang];
  e.title = tr.title; e.tagline = tr.tagline; e.description = tr.description; e.disclaimer = tr.disclaimer;
  for (const a of e.rounds.flatMap(r => r.activities)) {
    const [prompt, opts] = tr.q[a.id]; a.prompt = prompt;
    if (a.type === 'choice') a.options.forEach((o, i) => { o.text = opts[i]; });
  }
  e.results = e.results!.map((b, i) => { const [title, message, explanation, groupTitle, groupMessage] = tr.results[i]; return { ...b, title, message, explanation, groupTitle, groupMessage }; });
  e.transitions = tr.transitions; e.closing = tr.closing;
  e.insights = { defaultHabit: tr.defaultHabit, defaultChallenge: tr.defaultChallenge,
    themes: Object.fromEntries(Object.entries(tr.themes).map(([k, [label, strength, growth, habit, challenge]]) => [k, { label, strength, growth, habit, challenge }])) };
  return e;
}
export const EGO_CHECK_VARIANTS = (['de', 'fr', 'ar'] as const).map(localize);
