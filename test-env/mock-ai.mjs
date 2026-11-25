// Mock Anthropic Messages API: returns 4 quiz questions, one invalid (two correct answers) that the function must drop.
import http from 'node:http';
let last = null;
http.createServer(async (req, res) => {
  let b = ''; for await (const c of req) b += c;
  if (req.url === '/last') { res.writeHead(200); return res.end(JSON.stringify(last)); }
  last = { headers: { key: req.headers['x-api-key'], version: req.headers['anthropic-version'] }, body: JSON.parse(b) };
  const qs = [
    { prompt: 'Which time zone is Cairo in?', answers: [{ text: 'EET', correct: true }, { text: 'CET' }, { text: 'GMT' }], explanation: 'Egypt uses Eastern European Time.' },
    { prompt: 'Which tool is best for async stand-ups?', answers: [{ text: 'A shared written thread', correct: true }, { text: 'A daily 1-hour call' }] },
    { prompt: 'Invalid: two correct', answers: [{ text: 'A', correct: true }, { text: 'B', correct: true }] },
    { prompt: 'What does PR stand for in Git?', answers: [{ text: 'Pull request', correct: true }, { text: 'Push release' }], explanation: 'A pull request proposes changes.' },
  ];
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ content: [{ type: 'tool_use', name: 'questions', input: { questions: qs } }] }));
}).listen(8099);
