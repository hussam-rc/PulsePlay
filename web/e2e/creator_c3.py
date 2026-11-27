"""Creator Studio slice C3: question-bank management in the no-code builder.
Overview, bank on/off, balance, categories (assign, rename), archive/restore, duplicate, answer scoring, lengths, example games,
publish as new immutable versions, and hosting a published bank with the chosen length.
Needs the test environment (test-env/start.sh). Usage: BASE=http://localhost:8789/PulsePlay/app/ python3 e2e/creator_c3.py"""
import os, json, urllib.request
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8789/PulsePlay/app/'); API = BASE.split('/PulsePlay')[0]
SHOTS = os.environ.get('SHOTS', '/tmp/shots'); os.makedirs(SHOTS, exist_ok=True)
AXE = os.path.join(os.path.dirname(__file__), '..', 'node_modules', 'axe-core', 'axe.min.js')
results = []
def ok(c, m): results.append((c, m)); print(('PASS ' if c else 'FAIL ') + m, flush=True)
CATS = ['Team', 'Feedback', 'Credit']

with sync_playwright() as pw:
    b = pw.chromium.launch(); errors = []
    d = b.new_context(viewport={'width': 1280, 'height': 900}).new_page(); d.on('pageerror', lambda e: errors.append(str(e)))
    d.on('dialog', lambda dl: dl.accept())
    d.goto(BASE + '#/workspace'); d.wait_for_selector('[data-testid=email]')
    email = 'creator.c3@example.org'
    d.fill('[data-testid=email]', email); d.click('[data-testid=send]'); d.wait_for_selector('[data-testid=code]')
    code = json.load(urllib.request.urlopen(f'{API}/__test/code?email={email}'))['code']
    d.fill('[data-testid=code]', code); d.click('[data-testid=verify]'); d.wait_for_selector('[data-testid=new-score]', timeout=10000)
    d.click('[data-testid=new-score]'); d.wait_for_selector('[data-testid=bank]'); editor = d.url
    ok(not d.is_checked('[data-testid=bank-toggle]') and 'every game plays all questions' in d.inner_text('[data-testid=bank]'), 'new game: bank is off; every question plays (previous behaviour)')

    # Build 21 questions through the form: fill the 3 starter questions, then duplicate and edit.
    def fill(i, prompt, texts=None):
        q = d.locator('[data-testid=question]').nth(i)
        q.locator('[data-testid=q-prompt]').fill(prompt)
        for j, t in enumerate(texts or [f'Open reaction {i + 1}', f'Ego reaction {i + 1}']): q.locator('[data-testid=q-option]').nth(j).fill(t)
    for i in range(3): fill(i, f'Situation {i + 1} at work')
    for i in range(3, 21):
        d.locator('[data-testid=question]').nth(i - 1).get_by_role('button', name='Duplicate').click()
        fill(i, f'Situation {i + 1} at work')
    ok(d.locator('[data-testid=question]').count() == 21, 'duplicate: 21 questions built with the Duplicate button')

    # Answer scoring with a top score below 3 on one question (variable maximum)
    q5 = d.locator('[data-testid=question]').nth(4); q5.locator('[data-testid=q-add-option]').click()
    q5.locator('[data-testid=q-option]').nth(2).fill('Self-protective reaction 5')
    q5.get_by_label('Score of answer 2').select_option('2'); q5.get_by_label('Score of answer 3').select_option('1')

    # Bank on, balanced by category
    d.check('[data-testid=bank-toggle]'); d.wait_for_selector('[data-testid=balance-category]')
    ok([d.is_checked(f'[data-testid=len-{n}]') for n in (10, 15, 20)] == [True, True, True], 'bank on: 10 / 15 / 20 offered by default (21 questions)')
    d.click('[data-testid=balance-category]'); d.wait_for_selector('[data-testid=bank-nogroup]', timeout=5000)
    ok('21 questions have no category' in d.inner_text('[data-testid=bank]'), 'balance: missing categories explained in plain language')
    for i in range(21):
        f = d.locator('[data-testid=question]').nth(i).locator('[data-testid=q-group]'); f.fill(CATS[i % 3]); f.press('Enter')
    groups = d.inner_text('[data-testid=bank-groups]')
    ok(all(f'{c}\n7 in use' in groups or f'{c}\n\n7 in use' in groups or (c in groups and '7 in use' in groups) for c in CATS) and 'no category' not in d.inner_text('[data-testid=bank]'), 'categories: three categories with 7 questions each')
    d.click('[data-testid=rename-credit]'); d.get_by_label('New name for Credit').fill('Recognition'); d.get_by_role('button', name='Save').click()
    ok('Recognition' in d.inner_text('[data-testid=bank-groups]') and d.locator('[data-testid=question]').nth(2).locator('[data-testid=q-group]').input_value() == 'Recognition', 'categories: rename updates every question')

    # Archive two questions, then restore one
    for i in (0, 3): d.locator('[data-testid=question]').nth(i).locator('[data-testid=q-archive]').click()
    d.wait_for_function("document.querySelector('[data-testid=bank-overview]').innerText.includes('19')", timeout=5000)
    ov = d.inner_text('[data-testid=bank-overview]')
    ok('19\nIn use' in ov and '2\nArchived' in ov and d.locator('[data-testid=q-archived]').count() == 2, f'archive: overview shows 19 in use, 2 archived ({ov.split()})')
    chk = d.inner_text('[data-testid=checker]')
    ok('✕ 20 questions' in d.inner_text('[data-testid=bank-lengths]') and 'Only 19 questions are in use, so 20-question games cannot be offered yet.' in chk, f'archive: 20 no longer available, explained in the checker (never padded) [{chk[-160:]}]')
    d.locator('[data-testid=question]').nth(3).locator('[data-testid=q-archive]').click()
    d.wait_for_function("document.querySelector('[data-testid=bank-lengths]').innerText.includes('✓ 20')", timeout=5000)
    ok(d.locator('[data-testid=q-archived]').count() == 1 and '✓ 20 questions' in d.inner_text('[data-testid=bank-lengths]'), 'restore: question back in use, 20 available again')

    # Lengths and default
    d.check('[data-testid=len-5]'); d.click('[data-testid=deflen-15]')
    ok(d.get_attribute('[data-testid=deflen-15]', 'aria-pressed') == 'true' and d.is_checked('[data-testid=len-5]'), 'lengths: 5 added, 15 suggested')
    ok('lower top score' in d.inner_text('[data-testid=bank-scoring]'), 'scoring: variable top scores are explained, out of the highest points possible')

    # Example games
    d.click('[data-testid=sample-len-15]'); samples = d.locator('[data-testid=sample]')
    first = samples.nth(0).inner_text()
    ok(samples.count() == 3 and all(samples.nth(k).locator('li').count() == 15 for k in range(3)), 'preview: three example games of 15 questions')
    ok(all(f'{c} 5' in samples.nth(k).inner_text() for k in range(3) for c in ['Team', 'Feedback', 'Recognition']), 'preview: every example game is balanced 5 / 5 / 5')
    ok('Situation 1 at work' not in ' '.join(samples.nth(k).inner_text() for k in range(3)), 'preview: archived question never selected')
    ok('min' in first, 'preview: estimated duration shown')
    d.click('[data-testid=sample-shuffle]'); ok(samples.nth(0).inner_text() != first, 'preview: shuffle shows other example games')
    d.screenshot(path=f'{SHOTS}/c3_bank_1280.png', full_page=True)

    # Publish v1, change, publish v2
    d.wait_for_selector('text=✓ All changes saved', timeout=10000)
    ok('Ready to publish' in d.inner_text('[data-testid=checker]'), 'checker: bank game ready to publish')
    d.click('[data-testid=publish]'); d.wait_for_selector('[data-testid=msg]', timeout=10000)
    ok('Published version 1' in d.inner_text('[data-testid=msg]'), 'publish: version 1 accepted by server-side validation')
    d.locator('[data-testid=question]').nth(1).locator('[data-testid=q-archive]').click(); d.wait_for_selector('text=✓ All changes saved', timeout=10000)
    d.click('[data-testid=publish]'); d.wait_for_function("document.querySelector('[data-testid=msg]')?.innerText.includes('Published version 2')", timeout=10000)
    ok('v1 (' in d.inner_text('body') and 'v2 (' in d.inner_text('body'), 'publish: a change creates version 2; version 1 is kept')
    d.reload(); d.wait_for_selector('[data-testid=bank]')
    ok(d.locator('[data-testid=q-archived]').count() == 2 and d.input_value('[data-testid=question] >> nth=2 >> [data-testid=q-group]') == 'Recognition', 'edit: bank settings, archive and categories survive refresh')

    # Host: lengths from the bank, 15 suggested
    d.click('[data-testid=host]'); d.wait_for_selector('[data-testid=create]')
    ok(d.get_attribute('[data-testid=len-15]', 'aria-pressed') == 'true' and d.locator('[data-testid=len-5]').is_enabled() and d.locator('[data-testid=len-20]').is_disabled(),
       'host: offers the bank lengths, 15 suggested, 20 unavailable with 19 questions in use')
    d.click('[data-testid=create]'); d.wait_for_selector('[data-testid=joined]', timeout=10000)
    ok(d.locator('text=/\\d{3} \\d{3}/').count() > 0, 'host: the published bank opens a real room')

    # Accessibility and phone width
    d.goto(editor); d.wait_for_selector('[data-testid=bank]')
    d.add_script_tag(path=AXE); v = d.evaluate("axe.run(document.querySelector('#bank'),{resultTypes:['violations']}).then(r=>r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id+': '+v.nodes.map(n=>n.target.join(' ')+' '+(n.any[0]||{}).message).join(' | ')))")
    ok(not v, f'axe bank section: {v or "none"}')
    d.set_viewport_size({'width': 375, 'height': 812}); d.wait_for_timeout(400)
    ok(not d.evaluate('document.documentElement.scrollWidth > innerWidth + 1'), 'phone: no sideways scrolling at 375 px')
    d.locator('#bank').screenshot(path=f'{SHOTS}/c3_bank_375.png')
    ok(not errors, f'no page errors {errors[:2]}')
    b.close()
print(f"{sum(c for c, _ in results)} passed, {sum(not c for c, _ in results)} failed")
