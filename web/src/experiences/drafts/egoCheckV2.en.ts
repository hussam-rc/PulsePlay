// DRAFT for review (Release 3.0B). Not registered in the catalogue and not published.
// "Who is in Control?" v2: a 60-question bank, 10 per dimension, balanced by dimension, 10 / 15 / 20 questions per game.
//
// Rubric (every question has exactly one answer at each level, all four believable):
//   0  curious, open          asks, explores, credits others
//   1  healthy self-regard    states own view respectfully, names a feeling, asks for fair credit or a fair process
//   2  self-protective        justifies first, keeps score, quietly withdraws
//   3  ego takes the wheel     dismisses, wins the argument, claims credit, retaliates
// Confidence, respectful disagreement, emotions and asking for fair recognition never score above 1.
import type { Experience } from '../../engine/schema';

export const DIMENSIONS = ['self-awareness', 'feedback', 'recognition', 'collaboration', 'humility', 'empathy'] as const;
export type Dimension = typeof DIMENSIONS[number];

// Answer letters are mixed per question so no letter is "always the open one"; players also see their own shuffled order.
const ORDERS = [[0, 1, 2, 3], [2, 0, 3, 1], [1, 3, 0, 2], [3, 2, 1, 0], [1, 0, 3, 2], [2, 3, 0, 1]];
let n = 0;
/** q(id, dimension, prompt, [0-point, 1-point, 2-point, 3-point]) */
const q = (id: string, dimension: Dimension, prompt: string, byLevel: [string, string, string, string]) => {
  const order = ORDERS[n++ % ORDERS.length];
  return {
    id, type: 'choice' as const, theme: dimension, dimension, prompt, shuffle: true, rev: 1,
    options: order.map((level, k) => ({ id: 'abcd'[k], text: byLevel[level], points: level })),
  };
};

export const BANK_EN = [
  // ---------- Self-awareness ----------
  q('sa1', 'self-awareness', 'Halfway through an argument, you realise you were wrong.',
    ['Say so and thank them for the push', 'Admit it briefly and move on', 'Switch to a smaller point you\'re right about', 'Keep going; backing down now looks weak']),
  q('sa2', 'self-awareness', 'A colleague says you interrupt a lot in meetings.',
    ['Ask for an example so you can notice it', 'Say you\'ll watch for it, though it surprises you', 'Mention that others interrupt too', 'Explain that you only interrupt when it\'s needed']),
  q('sa3', 'self-awareness', 'You snapped at someone in a stressful meeting.',
    ['Apologise to them afterwards, in person', 'Explain later that it was the pressure, not them', 'Hope they didn\'t notice and move on', 'Decide they pushed you to it']),
  q('sa4', 'self-awareness', 'Your team survey says you\'re "hard to approach".',
    ['Ask a few people what would make it easier', 'Feel stung, then look for patterns in the comments', 'Assume it comes from one or two unhappy people', 'Conclude people just don\'t like direct feedback']),
  q('sa5', 'self-awareness', 'You realise you\'ve done most of the talking in the meeting.',
    ['Stop and ask what others think', 'Wrap up your point and pass the floor', 'Finish your full point first; it matters', 'Keep going; you know the topic best']),
  q('sa6', 'self-awareness', 'A decision you pushed for turns out badly.',
    ['Name it in the review and share what you learned', 'Own your part when someone asks', 'Point to the factors nobody could foresee', 'Remind people the team agreed to it too']),
  q('sa7', 'self-awareness', 'You notice you get irritated whenever one colleague speaks.',
    ['Ask yourself what exactly triggers it', 'Stay professional and talk it through with a friend', 'Avoid working with them where you can', 'Let a few sharp comments show how you feel']),
  q('sa8', 'self-awareness', 'Someone asks why you always take the lead on projects.',
    ['Ask if others would like to lead next time', 'Say you enjoy it, and offer to share it', 'Say someone has to, and nobody else steps up', 'Take it as a compliment and carry on']),
  q('sa9', 'self-awareness', 'A friend jokes that you never admit you\'re wrong.',
    ['Laugh and ask when they last noticed it', 'Laugh, and quietly think about it', 'Laugh it off; it\'s just a joke', 'List the times you did admit it']),
  q('sa10', 'self-awareness', 'Your rating this year is lower than you expected.',
    ['Ask what the next level would look like for you', 'Share your view calmly, with examples', 'Accept it, but put in less extra effort', 'Escalate it; the rating is clearly wrong']),

  // ---------- Feedback and criticism ----------
  q('fb1', 'feedback', 'Your manager rewrites half of your report before it goes out.',
    ['Ask what made the new version stronger', 'Ask to discuss bigger changes with you next time', 'Accept it, but feel less motivated next time', 'Point out the parts that were better before']),
  q('fb2', 'feedback', 'A colleague corrects your numbers in front of the whole team.',
    ['Thank them and fix it on the spot', 'Thank them, and ask for a private heads-up next time', 'Say nothing, but remember it', 'Point out a mistake in their work too']),
  q('fb3', 'feedback', 'Your proposal is rejected with little explanation.',
    ['Ask what would make it work next time', 'Say you\'re disappointed and ask for the reasons', 'Stop proposing ideas for a while', 'Push it again through someone more senior']),
  q('fb4', 'feedback', 'A client says your presentation was "too long".',
    ['Ask which part they\'d cut', 'Agree to tighten it, and keep the key data', 'Explain that the topic needed that detail', 'Decide they didn\'t really get the content']),
  q('fb5', 'feedback', 'Your yearly review contains criticism you didn\'t see coming.',
    ['Ask for examples so you can understand it', 'Say it surprised you and ask why it came up only now', 'Nod, then quietly dismiss it', 'Argue each point until it\'s softened']),
  q('fb6', 'feedback', 'A junior colleague points out a flaw in your plan.',
    ['Thank them and adjust the plan', 'Check it, then credit them if they\'re right', 'Fix it quietly without mentioning them', 'Explain why it\'s not really a flaw']),
  q('fb7', 'feedback', 'Useful feedback reaches you in a rude tone.',
    ['Focus on what is useful in it', 'Tell them the tone made it hard to hear', 'Ignore all of it because of the tone', 'Reply in the same tone']),
  q('fb8', 'feedback', 'Your draft comes back with comments on every page.',
    ['Work through them and ask about unclear ones', 'Take a short break, then work through them', 'Accept the small ones, skip the rest', 'Defend your choice on each comment']),
  q('fb9', 'feedback', 'Your manager says your idea "needs more thinking".',
    ['Ask which part needs the most work', 'Agree, and ask for a date to revisit it', 'Hear it as a polite no and let it go', 'Ask someone else to approve it instead']),
  q('fb10', 'feedback', 'A peer gives you feedback that feels unfair.',
    ['Ask what they saw that led them there', 'Say you see it differently, and why', 'Thank them, then ignore it', 'Tell others how unfair they\'re']),

  // ---------- Recognition and validation ----------
  q('rc1', 'recognition', 'A colleague presents your idea in a meeting without naming you.',
    ['Build on it and add what you know', 'Say with a smile: "Glad my idea is landing"', 'Stay quiet, and share less with them next time', 'Correct them sharply in front of everyone']),
  q('rc2', 'recognition', 'Your manager thanks the team but names only one colleague.',
    ['Congratulate that colleague too', 'Ask your manager later how they see your part', 'Feel overlooked and keep it to yourself', 'Send a recap listing everything you did']),
  q('rc3', 'recognition', 'A newer colleague gets the promotion you wanted.',
    ['Congratulate them and ask what made the difference', 'Congratulate them, and ask your manager about your path', 'Congratulate them, then keep your distance', 'Point out how long you\'ve been here']),
  q('rc4', 'recognition', 'Your work helps a big success, but nobody mentions you.',
    ['Enjoy the result; the work mattered', 'Mention your role in your next one-to-one', 'Feel let down and do less extra work', 'Make sure everyone hears it was yours']),
  q('rc5', 'recognition', 'A colleague is praised for something you do every week.',
    ['Join in the praise', 'Later suggest the team highlight routine work too', 'Think: nobody ever notices what I do', 'Point out that you do this every week']),
  q('rc6', 'recognition', 'Your post gets far fewer reactions than a colleague\'s similar one.',
    ['Read theirs to see what landed', 'Feel a small sting, then move on', 'Check the numbers again several times', 'Delete your post']),
  q('rc7', 'recognition', 'You stayed late to help, and nobody says thank you.',
    ['Let it go; you helped because it mattered', 'Say a quick thank you\'d mean a lot next time', 'Decide not to stay late again', 'Remind them how much you gave up']),
  q('rc8', 'recognition', 'A client praises your work, but writes only to your manager.',
    ['Feel glad the client is happy', 'Ask your manager to forward it to you', 'Wonder why the client didn\'t write to you', 'Reply to all to clarify it was your work']),
  q('rc9', 'recognition', 'Someone else is chosen to present your team\'s project.',
    ['Help them prepare', 'Say you\'d like to present next time', 'Skip the rehearsal; they\'ve got it', 'Add your own points during their talk']),
  q('rc10', 'recognition', 'Colleagues meet about your topic without inviting you.',
    ['Ask what came out of it', 'Ask to be included next time', 'Assume you\'re being sidelined', 'Complain about it to the team']),

  // ---------- Collaboration and control ----------
  q('cl1', 'collaboration', 'The team picks an approach you argued against.',
    ['Ask how you can help it succeed', 'Note your concern once, then commit', 'Do your part, but strictly by the book', 'Keep a list of what goes wrong']),
  q('cl2', 'collaboration', 'A colleague does a task differently from how you\'d.',
    ['Ask why they chose that way', 'Share your way as one option', 'Redo it later your way', 'Tell them to do it your way']),
  q('cl3', 'collaboration', 'You\'re asked to hand over a project you started.',
    ['Write a clear handover and offer help', 'Ask to stay informed on big decisions', 'Hand it over, but keep the key contacts', 'Keep checking in and correcting their choices']),
  q('cl4', 'collaboration', 'In a group task, someone else takes the lead.',
    ['Support them and pick up a part', 'Offer your ideas, then follow their lead', 'Do your part and stay quiet', 'Steer the group back to your plan']),
  q('cl5', 'collaboration', 'A teammate asks for help with something you\'d do faster.',
    ['Show them how, step by step', 'Help, and agree on a quicker way next time', 'Do it for them to save time', 'Tell them they should know this by now']),
  q('cl6', 'collaboration', 'Your manager gives your project a co-lead.',
    ['Agree together how to split the work', 'Say you\'re surprised, then plan together', 'Agree, but keep the important parts', 'Make sure everyone still sees you as the lead']),
  q('cl7', 'collaboration', 'A decision is made while you\'re on holiday.',
    ['Ask for the reasons and go with it', 'Share your view, then accept the decision', 'Accept it, but feel left out', 'Push to reopen it because you weren\'t there']),
  q('cl8', 'collaboration', 'Your team wants a tool you think is worse.',
    ['Try it with an open mind', 'Agree to a trial with a review date', 'Keep using your own tool on the side', 'Refuse until they see your point']),
  q('cl9', 'collaboration', 'A colleague takes over a client you used to handle.',
    ['Brief them on what works with that client', 'Offer help if questions come up', 'Wait for them to ask you', 'Stay in direct contact with the client']),
  q('cl10', 'collaboration', 'Your idea is merged with someone else\'s in a brainstorm.',
    ['Enjoy it; the mix is stronger', 'Check that your key point survived', 'Prefer your original, but say nothing', 'Argue for your original version']),

  // ---------- Humility and learning ----------
  q('hl1', 'humility', 'The new intern shows you a much faster way to do a daily task.',
    ['Ask them to show you more tricks', 'Thank them and try it tomorrow', 'Stick with your way; it works', 'Explain why your way is actually safer']),
  q('hl2', 'humility', 'Someone younger explains a topic you thought you knew.',
    ['Ask follow-up questions', 'Listen, then add what you know', 'Wait for a chance to show you knew it', 'Correct small details to show your expertise']),
  q('hl3', 'humility', 'A colleague is clearly better at something you\'re known for.',
    ['Ask them how they do it', 'Admit it, and keep improving', 'Avoid tasks where they shine next to you', 'Point out where they still fall short']),
  q('hl4', 'humility', 'You don\'t know the answer to a client\'s question.',
    ['Say you\'ll find out and follow up', 'Share what you know and check the rest', 'Give a vague answer that sounds right', 'Answer confidently anyway']),
  q('hl5', 'humility', 'A peer suggests a training course for you.',
    ['Ask which one helped them', 'Look into it, though you feel experienced', 'Say you\'re too busy right now', 'Say you could teach that course']),
  q('hl6', 'humility', 'You\'re the most senior person, and the team disagrees with you.',
    ['Ask what they see that you don\'t', 'Explain your view, then hear them out', 'Let them try it, expecting it to fail', 'Decide anyway; you\'re the one accountable']),
  q('hl7', 'humility', 'A colleague asks a "basic" question in a meeting.',
    ['Answer kindly; others may wonder too', 'Answer briefly and continue', 'Answer, hinting they should know this', 'Sigh and say it was covered before']),
  q('hl8', 'humility', 'A junior colleague catches a mistake of yours.',
    ['Thank them in front of the team', 'Thank them privately and fix it', 'Fix it and say nothing', 'Explain why it wasn\'t really a mistake']),
  q('hl9', 'humility', 'Someone outside your field questions your expert opinion.',
    ['Ask what makes them think so', 'Explain your reasoning simply', 'Remind them of your experience', 'Dismiss it; they don\'t know the field']),
  q('hl10', 'humility', 'A tool you built is replaced by a better one.',
    ['Help the team switch', 'Share what you learned building yours', 'Keep pointing out what yours did better', 'Warn people the new one will fail']),

  // ---------- Empathy and emotional reactions ----------
  q('em1', 'empathy', 'A colleague snaps at you during a stressful deadline.',
    ['Ask later if they\'re OK', 'Tell them calmly it didn\'t feel good', 'Keep your distance for a few days', 'Snap back; it\'s only fair']),
  q('em2', 'empathy', 'A teammate is in tears after a tough meeting.',
    ['Offer a quiet moment and a coffee', 'Give them space and check in later', 'Act as if you didn\'t notice', 'Tell them it wasn\'t that bad']),
  q('em3', 'empathy', 'A client is angry about a delay that wasn\'t your fault.',
    ['Acknowledge their frustration first', 'Explain the cause calmly, then offer options', 'Make clear it wasn\'t your team', 'Tell them they\'re overreacting']),
  q('em4', 'empathy', 'A colleague has been missing deadlines lately.',
    ['Ask privately how they\'re doing', 'Raise it with them kindly and directly', 'Work around them', 'Point it out in front of the team']),
  q('em5', 'empathy', 'A teammate is upset that their idea was rejected.',
    ['Ask what they liked most about it', 'Say you understand, and explain the decision', 'Change the subject', 'Say it wasn\'t a great idea anyway']),
  q('em6', 'empathy', 'A new colleague struggles to follow fast meetings in a second language.',
    ['Share a short summary with them afterwards', 'Slow down when they ask you to', 'Keep your pace; they will catch up', 'Talk only to the people who follow']),
  q('em7', 'empathy', 'Two colleagues are in conflict, and both complain to you.',
    ['Listen to both and suggest they talk', 'Stay neutral and keep out of it', 'Agree with whoever you\'re talking to', 'Pass the story on to others']),
  q('em8', 'empathy', 'Someone shares a personal problem in your one-to-one.',
    ['Listen and ask what would help', 'Listen, and share a similar experience', 'Give quick advice and move on', 'Turn the talk to your own problems']),
  q('em9', 'empathy', 'Your manager seems stressed and short with everyone.',
    ['Ask if you can take something off their plate', 'Keep your updates short today', 'Complain about their mood to colleagues', 'Push back sharply when they\'re short with you']),
  q('em10', 'empathy', 'A teammate has been unusually quiet for a week.',
    ['Ask privately how they\'re doing', 'Include them a bit more in conversations', 'Assume it\'s not your business', 'Joke about their silence in a meeting']),
];

export const INSIGHTS_EN: NonNullable<Experience['insights']> = {
  themes: {
    'self-awareness': { label: 'Self-awareness', strength: 'You notice your own reactions and can name them.', growth: 'Your own patterns can be hard to spot in the moment.', habit: 'After a tense moment, ask yourself: what did I just protect?', challenge: 'Ask one colleague: "What do I do that I might not notice?"' },
    feedback: { label: 'Feedback', strength: 'You stay curious when your work is criticised.', growth: 'Criticism can switch you into defending quickly.', habit: 'When feedback comes, ask one question before you answer.', challenge: 'Ask for one piece of honest feedback this week, and only listen.' },
    recognition: { label: 'Recognition', strength: 'You can enjoy shared success without keeping score.', growth: 'Being overlooked can stay with you for a while.', habit: 'Name a colleague\'s contribution out loud each week.', challenge: 'Ask for recognition once, openly and calmly, instead of hoping for it.' },
    collaboration: { label: 'Collaboration', strength: 'You let go of control when the team needs it.', growth: 'Letting others do it their way takes real effort.', habit: 'Before stepping in, ask: does this need my way, or just a good way?', challenge: 'Hand over one task this week and do not correct it.' },
    humility: { label: 'Learning', strength: 'You learn from anyone, whatever their title or age.', growth: 'Not knowing can feel like losing face.', habit: 'Practise "I don\'t know yet, I\'ll find out."', challenge: 'Ask a younger or newer colleague to teach you one thing.' },
    empathy: { label: 'Empathy', strength: 'You notice how others feel and respond with care.', growth: 'Under pressure, other people\'s feelings can slip out of view.', habit: 'In tense moments, name the other person\'s feeling before the facts.', challenge: 'Check in privately with someone who seemed off this week.' },
  },
  defaultHabit: 'Keep asking "what am I missing?" in meetings. It keeps you in the driver\'s seat.',
  defaultChallenge: 'Ask one colleague how you could support them better this week.',
};

export const RESULTS_EN: NonNullable<Experience['results']> = [
  { min: 0, max: 25, emoji: '🧘', tone: 'great', title: "You're in the driver's seat!", message: 'Calm hands on the wheel. Your first reflexes stay curious, even when a moment stings.',
    explanation: 'In most situations you chose the open, curious reaction, including the uncomfortable ones.', groupTitle: "We're in the driver's seat!", groupMessage: 'As a group we mostly react with curiosity. Let\'s keep it that way. 🧘' },
  { min: 26, max: 50, emoji: '😎', tone: 'good', title: "You're mostly in control!", message: 'Now and then your ego honks from the back seat, but you keep the wheel.',
    explanation: 'Most of your reactions are open or healthily confident. A few moments pull you towards protecting your position, which is very human.', groupTitle: "We're mostly in control!", groupMessage: 'A few honks from the back seat, but we keep the wheel. 😎' },
  { min: 51, max: 75, emoji: '🦙', tone: 'watch', title: 'Your ego is grabbing the wheel!', message: 'In some moments your first reflex steers. That\'s human, and the wheel is still yours.',
    explanation: 'In several situations your first reflex protected your position or your credit. Noticing that is the hardest part, and you just did.', groupTitle: 'Our egos sometimes grab the wheel!', groupMessage: 'Our reflexes take over now and then. Good thing we\'re noticing. 🦙' },
  { min: 76, max: 100, emoji: '👑', tone: 'grow', title: 'Your ego is driving!', message: 'Today your ego did much of the driving. Good news: reflexes can be retrained, one pause at a time. 💪',
    explanation: 'Today your quick reactions leaned towards defending, convincing or claiming credit. That says more about fast reflexes than about who you are.', groupTitle: 'Let\'s take back the wheel together!', groupMessage: 'Our egos did a lot of the driving today. A great starting point for this conversation. 👑' },
];
