"""Creator Studio slice C1: starter templates, try without an account, use a template through sign-in, edit, preview, publish, host.
Needs the test environment (test-env/start.sh). Usage: BASE=http://localhost:8789/PulsePlay/app/ python3 e2e/creator_c1.py"""
import os, json, urllib.request
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8789/PulsePlay/app/'); API = BASE.split('/PulsePlay')[0]
SHOTS = os.environ.get('SHOTS', '/tmp/shots'); os.makedirs(SHOTS, exist_ok=True)
AXE = os.path.join(os.path.dirname(__file__), '..', 'node_modules', 'axe-core', 'axe.min.js')
results = []
def ok(c, m): results.append((c, m)); print(('PASS ' if c else 'FAIL ') + m, flush=True)
def overflow(p): return p.evaluate('document.documentElement.scrollWidth > innerWidth + 1')

with sync_playwright() as pw:
    b = pw.chromium.launch(); errors = []
    m = b.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True).new_page(); m.on('pageerror', lambda e: errors.append(str(e)))
    rpc_calls = []; m.on('request', lambda r: rpc_calls.append(r.url) if '/rest/v1/' in r.url or '/functions/v1/' in r.url else None)
    m.goto(BASE + '#/create'); m.wait_for_selector('[data-testid^=tpl-]')
    names = m.eval_on_selector_all('[data-testid^=tpl-] h3', 'els => els.map(e => e.innerText)')
    ok(names == ['Trivia Quiz', 'Icebreaker', 'Would You Rather?', 'Opinion Poll', 'Personal Reflection'], f'create: five starter templates {names}')
    ok('Team Challenge' not in m.inner_text('body'), 'create: no unfinished Team Challenge shown')
    ok(not overflow(m), 'create: no sideways scrolling at 375 px'); m.screenshot(path=f'{SHOTS}/c1_create_375.png', full_page=True)

    # Try without an account: practice mode, nothing sent to the server
    rpc_calls.clear(); m.click('[data-testid=try-trivia]'); m.wait_for_selector('[data-testid=joined]')
    m.click('[data-testid=next]'); m.click('[data-testid=next]')
    m.wait_for_selector('[data-testid=prompt]'); first = m.inner_text('[data-testid=prompt]')
    m.click('[data-testid=next]'); m.wait_for_selector('[data-testid=explanation]', timeout=40000)
    ok(first == 'Which planet is known as the Red Planet?' and 'rust' in m.inner_text('[data-testid=explanation]'), 'try: template plays with simulated players and shows the explanation')
    ok(not rpc_calls, f'try: no account and no server calls ({len(rpc_calls)})')
    m.goto(BASE + '#/create/try/does-not-exist'); m.wait_for_selector('[data-testid^=tpl-]'); ok(True, 'try: unknown template returns to the gallery')

    # Use a template: choice survives sign-in, explicit space confirmation, editor opens with the content
    d = b.new_context(viewport={'width': 1280, 'height': 860}).new_page(); d.on('pageerror', lambda e: errors.append(str(e)))
    d.goto(BASE + '#/create'); d.click('[data-testid=use-opinion]'); d.wait_for_selector('[data-testid=email]')
    email = 'creator.c1@example.org'
    d.fill('[data-testid=email]', email); d.click('[data-testid=send]'); d.wait_for_selector('[data-testid=code]')
    code = json.load(urllib.request.urlopen(f'{API}/__test/code?email={email}'))['code']
    d.fill('[data-testid=code]', code); d.click('[data-testid=verify]'); d.wait_for_selector('[data-testid=pending-template]', timeout=10000)
    ok('Opinion Poll' in d.inner_text('[data-testid=pending-template]') and 'personal space' in d.inner_text('[data-testid=pending-template]'), 'use: after sign-in the chosen template waits, with the target space named')
    d.click('[data-testid=create-from-template]'); d.wait_for_selector('[data-testid=checker]')
    ok('Ready to publish' in d.inner_text('[data-testid=checker]') and d.locator('[data-testid=question]').count() == 4, 'use: editor opens with the template, 4 questions, ready to publish')
    ok(d.input_value('[data-testid=b-title]') == 'Team Pulse', 'use: template title prefilled')
    # edit the first question and publish
    d.fill('[data-testid=b-title]', 'Our Team Pulse'); d.wait_for_timeout(1500)
    d.click('[data-testid=publish]'); d.wait_for_selector('[data-testid=msg]', timeout=10000)
    ok('Published version 1' in d.inner_text('[data-testid=msg]'), 'publish: edited template published through server-side validation')
    d.reload(); d.wait_for_selector('[data-testid=checker]'); ok(d.input_value('[data-testid=b-title]') == 'Our Team Pulse', 'edit: change saved automatically and survives refresh')
    d.click('[data-testid=preview]'); d.wait_for_selector('[data-testid=joined]'); ok(True, 'preview: simulated players for the creator\'s draft')
    d.go_back(); d.wait_for_selector('[data-testid=host]'); d.click('[data-testid=host]'); d.wait_for_selector('[data-testid=create]')
    setup_has_title = 'Our Team Pulse' in d.inner_text('body')
    d.click('[data-testid=create]'); d.wait_for_selector('[data-testid=joined]', timeout=10000)
    ok(setup_has_title and d.locator('text=/\\d{3} \\d{3}/').count() > 0, 'host: the published template opens a real room with a join code')
    # pending choice cleared, no surprise drafts
    d.goto(BASE + '#/workspace'); d.wait_for_selector('[data-testid=library]'); d.wait_for_timeout(800)
    ok(d.locator('[data-testid=pending-template]').count() == 0, 'use: template choice is cleared after use')
    d.add_script_tag(path=AXE); v = d.evaluate("axe.run(document,{resultTypes:['violations']}).then(r=>r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id))")
    d.goto(BASE + '#/create'); d.wait_for_timeout(800); d.add_script_tag(path=AXE)
    v2 = d.evaluate("axe.run(document,{resultTypes:['violations']}).then(r=>r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id))")
    ok(not v2, f'axe /create: {v2 or "none"}')
    ok(not errors, f'no page errors {errors[:2]}')
    b.close()
print(f"{sum(c for c, _ in results)} passed, {sum(not c for c, _ in results)} failed")
