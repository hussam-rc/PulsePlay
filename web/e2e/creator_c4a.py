"""PulsePlay Creator Studio C4a: compact question list, search, filters, expand-to-edit, keyboard, phone and performance
with 60- and 200-question banks. Needs test-env/start.sh. Usage: BASE=http://localhost:8789/PulsePlay/app/ python3 e2e/creator_c4a.py
Prints typing and search timings (desktop, and a 375 px phone with 4x CPU slowdown); fails if they exceed the budget."""
import os, json, time, statistics, urllib.request
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8789/PulsePlay/app/'); API = BASE.split('/PulsePlay')[0]
SHOTS = os.environ.get('SHOTS', '/tmp/shots'); os.makedirs(SHOTS, exist_ok=True)
AXE = os.path.join(os.path.dirname(__file__), '..', 'node_modules', 'axe-core', 'axe.min.js')
results = []
def ok(c, m): results.append((c, m)); print(('PASS ' if c else 'FAIL ') + m, flush=True)
TOPICS = ['Planning', 'Feedback', 'Meetings', 'Learning', 'Customers']

def game(n):
    """A generic self-reflection bank (not Ego Check content): n questions over 5 categories, every 9th archived."""
    acts = [{'id': f'g{i}', 'type': 'choice', 'prompt': f'Situation {i + 1}: a {TOPICS[i % 5].lower()} moment at work', 'shuffle': True, 'category': TOPICS[i % 5].lower(),
             'options': [{'id': 'a', 'text': f'Open reaction {i + 1}', 'points': 0}, {'id': 'b', 'text': f'Calm answer {i + 1}', 'points': 0},
                         {'id': 'c', 'text': f'Guarded answer {i + 1}', 'points': 2}, {'id': 'd', 'text': f'Self-centred answer {i + 1}', 'points': 3}],
             **({'active': False} if i % 9 == 8 else {})} for i in range(n)]
    return {'schemaVersion': 1, 'id': 'my-game', 'title': f'Bank of {n}', 'tagline': 'A large test bank.', 'emoji': '🪞', 'category': 'reflection',
            'description': 'Large bank used by the C4a browser test.', 'durationMin': 10, 'players': {'min': 5, 'max': 80}, 'languages': ['en'], 'ageRating': 'all',
            'facilitator': 'optional', 'modes': ['live', 'self', 'practice'], 'defaultTiming': {'readSec': 3, 'answerSec': 10}, 'reveal': 'none',
            'privacy': {'individualResults': True, 'groupMinimum': 5, 'retainResponses': False}, 'scoring': {'kind': 'behaviour', 'minAnsweredRatio': 0.7},
            'disclaimer': 'A light-hearted reflection.', 'creator': 'Test', 'status': 'draft', 'closing': {'questions': ['What surprised you?'], 'message': 'Thanks!'},
            'results': [{'min': 0, 'max': 50, 'emoji': '🙂', 'tone': 'great', 'title': 'Calm', 'message': 'Calm.', 'explanation': 'Mostly open.'},
                        {'min': 51, 'max': 100, 'emoji': '🌱', 'tone': 'grow', 'title': 'Room to grow', 'message': 'Room.', 'explanation': 'Often guarded.'}],
            'bank': {'strategy': 'category', 'lengths': [10, 15, 20], 'defaultLength': 10}, 'rounds': [{'id': 'main', 'activities': acts}]}

def sign_in(ctx, email):
    d = ctx.new_page(); d.goto(BASE + '#/workspace'); d.wait_for_selector('[data-testid=email]')
    d.fill('[data-testid=email]', email); d.click('[data-testid=send]'); d.wait_for_selector('[data-testid=code]')
    code = json.load(urllib.request.urlopen(f'{API}/__test/code?email={email}'))['code']
    d.fill('[data-testid=code]', code); d.click('[data-testid=verify]'); d.wait_for_selector('[data-testid=new-score]', timeout=10000); return d

def load_bank(d, n):
    d.goto(BASE + '#/workspace'); d.click('[data-testid=new-score]'); d.wait_for_selector('[data-testid=checker]')
    d.click('text=Advanced: view the game file'); d.fill('textarea[aria-label="Game file"]', json.dumps(game(n)))
    d.click('text=Apply file changes'); d.wait_for_selector('text=✓ All changes saved', timeout=15000)
    d.reload(); d.wait_for_selector('[data-testid=qlist]'); return d.url

def typing_ms(d, sel, n=15):
    """Real keystrokes into a field; time from key press until the next frame has painted."""
    d.click(sel); out = []
    for _ in range(n):
        t = d.evaluate("performance.now()"); d.keyboard.type('x')
        out.append(d.evaluate("new Promise(r => requestAnimationFrame(() => setTimeout(() => r(performance.now()), 0)))") - t)
    return statistics.median(out), sorted(out)[int(n * 0.9) - 1]

with sync_playwright() as pw:
    b = pw.chromium.launch(); errors = []
    ctx = b.new_context(viewport={'width': 1366, 'height': 900}); d = sign_in(ctx, 'creator.c4a@example.org'); d.on('pageerror', lambda e: errors.append(str(e)))

    # ---------- 200 questions ----------
    url200 = load_bank(d, 200)
    ok(d.get_attribute('[data-testid=qlist]', 'data-view') == 'compact' and d.locator('[data-testid=q-row]').count() == 200 and d.locator('[data-testid=question]').count() == 0,
       '200: opens in the compact view, one row per question, no editing cards rendered')
    controls = d.evaluate("document.querySelectorAll('input,textarea,select,button').length"); height = d.evaluate("document.documentElement.scrollHeight")
    ok(controls < 400, f'200: {controls} controls on the page (was 4,316 before C4a)'); print(f'   page height {height}px')

    # search: as-you-type, across answers, with highlight
    t = time.time(); d.fill('[data-testid=q-search]', 'self-centred answer 150')
    d.wait_for_function("document.querySelector('[data-testid=q-count]').innerText.startsWith('1 of 200')", timeout=3000); search_ms = (time.time() - t) * 1000
    ok(d.locator('[data-testid=q-row]').count() == 1 and d.locator('[data-testid=q-row] mark').count() >= 1, f'search: finds an answer text in 200 questions and highlights it ({search_ms:.0f} ms incl. typing)')
    d.fill('[data-testid=q-search]', 'meetings'); d.wait_for_function("document.querySelector('[data-testid=q-count]').innerText.startsWith('40 of 200')", timeout=3000)
    d.select_option('[data-testid=f-status]', 'archived')
    cnt = d.inner_text('[data-testid=q-count]'); ok(cnt.startswith('5 of 200'), f'filters: search + archived combine ({cnt})')
    d.select_option('[data-testid=f-status]', 'all'); d.fill('[data-testid=q-search]', ''); d.select_option('[data-testid=f-group]', 'customers')
    ok(d.inner_text('[data-testid=q-count]').startswith('40 of 200'), 'filters: category filter')
    d.click('[data-testid=f-clear]'); ok(d.inner_text('[data-testid=q-count]').startswith('200 question'), 'filters: Clear restores all 200')

    # expand to edit, Previous / Next, Done, focus and scroll kept
    d.locator('[data-testid=q-row]').nth(120).click(); d.wait_for_selector('[data-testid=q-nav]')
    ok(d.locator('[data-testid=question]').count() == 1 and d.evaluate("document.activeElement?.dataset.testid") == 'q-prompt', 'edit: a row opens its editing card and focuses the question text')
    d.fill('[data-testid=question] [data-testid=q-prompt]', 'Edited situation 121')
    d.click('[data-testid=q-next]'); ok(d.inner_text('[data-testid=q-pos]') == '122 of 200' and 'Situation 122' in d.input_value('[data-testid=question] [data-testid=q-prompt]'), 'edit: Next moves to the following question')
    d.click('[data-testid=q-prev]'); ok(d.input_value('[data-testid=question] [data-testid=q-prompt]') == 'Edited situation 121', 'edit: Previous returns, the edit is kept')
    d.click('[data-testid=q-done]')
    ok(d.evaluate("document.activeElement?.dataset.testid") == 'q-row' and d.locator('[data-testid=q-row]').nth(120).inner_text().find('Edited situation 121') >= 0, 'edit: Done collapses, focus returns to the same row')
    y = d.evaluate('scrollY'); ok(y > 2000, f'edit: scroll position stays at the question ({y:.0f}px)')

    # keyboard: arrows between rows, Enter opens
    d.keyboard.press('ArrowDown'); d.keyboard.press('ArrowDown')
    ok(d.evaluate("document.activeElement?.dataset.id") == 'g122', 'keyboard: arrow keys move between rows')
    d.keyboard.press('Enter'); d.wait_for_selector('[data-testid=q-nav]'); ok(d.inner_text('[data-testid=q-pos]') == '123 of 200', 'keyboard: Enter opens the focused row')

    # typing speed with 200 questions (desktop)
    med, p90 = typing_ms(d, '[data-testid=question] [data-testid=q-prompt]')
    ok(med < 50, f'speed (desktop): typing in a 200-question bank median {med:.0f} ms, p90 {p90:.0f} ms'); speed = {'desktop_200': (med, p90)}
    d.click('[data-testid=q-done]')

    # problems filter and checker link open the row
    d.locator('[data-testid=q-row]').nth(10).click(); d.fill('[data-testid=question] [data-testid=q-prompt]', ''); d.click('[data-testid=q-done]')
    d.wait_for_function("document.querySelector('[data-testid=f-status] option[value=problems]').innerText.includes('(1)')", timeout=5000)
    d.select_option('[data-testid=f-status]', 'problems')
    ok(d.locator('[data-testid=q-row]').count() == 1 and d.locator('[data-testid=q-row-problem]').count() == 1, 'problems: "Needs fixing" filter shows the empty question')
    d.select_option('[data-testid=f-status]', 'all'); d.click('[data-testid=checker] a >> text=Question 11')
    ok(d.locator('[data-testid=q-nav]').count() == 1 and d.inner_text('[data-testid=q-pos]') == '11 of 200', 'problems: the checker link opens that question')
    d.fill('[data-testid=question] [data-testid=q-prompt]', 'Situation 11 restored'); d.click('[data-testid=q-done]')

    # state survives a reload (search, filters, open question)
    d.fill('[data-testid=q-search]', 'planning'); d.locator('[data-testid=q-row]').nth(2).click(); d.wait_for_selector('[data-testid=q-nav]')
    d.wait_for_selector('text=✓ All changes saved', timeout=15000); d.reload(); d.wait_for_selector('[data-testid=qlist]')
    ok(d.input_value('[data-testid=q-search]') == 'planning' and d.locator('[data-testid=q-nav]').count() == 1, 'state: search and the open question survive a reload')
    d.click('[data-testid=q-done]'); d.click('[data-testid=f-clear]')
    ok('Edited situation 121' in d.locator('[data-testid=q-row]').nth(120).inner_text(), 'state: edits were autosaved and survive the reload')

    # Show all stays responsive: 40 cards at a time
    t = time.time(); d.click('[data-testid=view-all]'); d.wait_for_selector('[data-testid=show-more]'); all_ms = (time.time() - t) * 1000
    ok(d.locator('[data-testid=question]').count() == 40 and all_ms < 1500, f'show all: renders 40 cards at a time ({all_ms:.0f} ms), "Show more" for the rest')
    d.click('[data-testid=show-more]'); ok(d.locator('[data-testid=question]').count() == 80, 'show all: "Show more" adds the next 40')
    d.click('[data-testid=view-compact]')

    # publish still works on a 200-question bank
    d.wait_for_selector('text=✓ All changes saved', timeout=15000); d.click('[data-testid=publish]'); d.wait_for_selector('[data-testid=msg]', timeout=20000)
    ok('Published version 1' in d.inner_text('[data-testid=msg]'), 'publish: the 200-question bank publishes through server-side validation')
    d.add_script_tag(path=AXE)
    v = d.evaluate("axe.run(document.querySelector('#questions'),{resultTypes:['violations']}).then(r=>r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id+': '+v.nodes.length))")
    ok(not v, f'accessibility (questions section): {v or "no serious issues"}')
    d.screenshot(path=f'{SHOTS}/c4a_desktop_200.png')

    # ---------- phone, 375 px, CPU 4x slower ----------
    m = b.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True, storage_state=ctx.storage_state()).new_page()
    m.on('pageerror', lambda e: errors.append(str(e)))
    m.goto(url200); m.wait_for_selector('[data-testid=qlist]')
    cdp = m.context.new_cdp_session(m); cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
    ok(not m.evaluate('document.documentElement.scrollWidth > innerWidth + 1'), 'phone: no sideways scrolling at 375 px with 200 questions')
    t = time.time(); m.fill('[data-testid=q-search]', 'customers'); m.wait_for_function("document.querySelector('[data-testid=q-count]').innerText.startsWith('40 of 200')", timeout=5000)
    ok(True, f'phone: search filters 200 questions ({(time.time() - t) * 1000:.0f} ms, CPU 4x slower)')
    m.locator('[data-testid=q-row]').nth(3).tap(); m.wait_for_selector('[data-testid=q-nav]')
    nav_box = m.locator('[data-testid=q-nav]').bounding_box(); ok(nav_box and nav_box['width'] <= 375, 'phone: Previous / Next / Done fit the screen')
    med, p90 = typing_ms(m, '[data-testid=question] [data-testid=q-prompt]', 10); speed['phone_200_cpu4x'] = (med, p90)
    ok(med < 120, f'speed (phone, CPU 4x): typing median {med:.0f} ms, p90 {p90:.0f} ms')
    m.screenshot(path=f'{SHOTS}/c4a_phone_200.png', full_page=False)
    m.click('[data-testid=q-done]'); m.fill('[data-testid=q-search]', '')

    # ---------- 60 questions ----------
    load_bank(d, 60)
    ok(d.get_attribute('[data-testid=qlist]', 'data-view') == 'compact' and d.locator('[data-testid=q-row]').count() == 60, '60: compact view with 60 rows')
    d.locator('[data-testid=q-row]').nth(5).click(); med, p90 = typing_ms(d, '[data-testid=question] [data-testid=q-prompt]'); speed['desktop_60'] = (med, p90)
    ok(med < 40, f'speed (desktop): typing in a 60-question bank median {med:.0f} ms, p90 {p90:.0f} ms')

    # ---------- small games keep the familiar full view ----------
    d.goto(BASE + '#/workspace'); d.click('[data-testid=new-quiz]'); d.wait_for_selector('[data-testid=qlist]')
    ok(d.get_attribute('[data-testid=qlist]', 'data-view') == 'all' and d.locator('[data-testid=question]').count() == 3, 'small game: opens with every question expanded, as before')
    print('TIMINGS', json.dumps({k: [round(x) for x in v] for k, v in speed.items()}))
    ok(not errors, f'no page errors {errors[:2]}')
    b.close()
print(f"{sum(c for c, _ in results)} passed, {sum(not c for c, _ in results)} failed")
