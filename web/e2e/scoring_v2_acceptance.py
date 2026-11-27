"""Staged acceptance test for Ego Check v2 scoring (local test environment only, never production).
A creator imports the v2 draft through the Creator Studio game file, publishes it (server-side validation by the publish
function), hosts it, and phones play. Checks: personal v2 results and scores, optional score, team result and privacy
thresholds, summaries tagged with their scoring version, and the existing v1 game unchanged.
Needs test-env/start.sh with the planned scoring-v2 migration. Usage: BASE=... python3 e2e/scoring_v2_acceptance.py"""
import os, json, subprocess, urllib.request, random
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8789/PulsePlay/app/'); API = BASE.split('/PulsePlay')[0]
SHOTS = os.environ.get('SHOTS', '/tmp/shots'); os.makedirs(SHOTS, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__)); WEB = os.path.dirname(HERE)
results = []
def ok(c, m): results.append((c, m)); print(('PASS ' if c else 'FAIL ') + m, flush=True)
def game_file(*args): return subprocess.run(['npx', 'tsx', 'scripts/export-ego-v2.ts', *args], cwd=WEB, capture_output=True, text=True, check=True).stdout
def sql(q): return subprocess.run(['psql', '-At', '-d', os.environ.get('PP_DB', 'e2e'), '-c', q], capture_output=True, text=True, check=True).stdout.strip()

def sign_in(b, email):
    d = b.new_context(viewport={'width': 1366, 'height': 860}).new_page()
    d.goto(BASE + '#/workspace'); d.wait_for_selector('[data-testid=email]')
    d.fill('[data-testid=email]', email); d.click('[data-testid=send]'); d.wait_for_selector('[data-testid=code]')
    code = json.load(urllib.request.urlopen(f'{API}/__test/code?email={email}'))['code']
    d.fill('[data-testid=code]', code); d.click('[data-testid=verify]'); d.wait_for_selector('[data-testid=new-score]', timeout=10000)
    return d

def import_and_publish(d, content):
    d.goto(BASE + '#/workspace'); d.click('[data-testid=new-score]'); d.wait_for_selector('[data-testid=checker]')
    d.click('text=Advanced: view the game file'); d.fill('textarea[aria-label="Game file"]', content)
    d.click('text=Apply file changes'); d.wait_for_selector('text=✓ All changes saved', timeout=15000)
    d.click('[data-testid=publish]'); d.wait_for_selector('[data-testid=msg]', timeout=15000)
    return d.inner_text('[data-testid=msg]'), d.url.split('/edit/')[1]

def join(b, code, name):
    p = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True).new_page()
    p.goto(BASE + f'#/j/{code}'); p.wait_for_selector('[data-testid=nickname]'); p.wait_for_timeout(300)
    p.fill('[data-testid=nickname]', name); p.check('[data-testid=consent]'); p.click('[data-testid=join]')
    p.wait_for_selector(f"text=You're in, {name}!", timeout=10000); return p

def next_(h): h.wait_for_selector('[data-testid=next]:not([disabled])', timeout=15000); h.click('[data-testid=next]')

def play(b, d, exp_id, bank, pickers):
    """Host the published game (default 10 questions), phones answer by policy; returns host page, phones, expected scores."""
    by_prompt = {q['prompt']: q for q in bank}
    d.goto(BASE + f'#/host/{exp_id}'); d.wait_for_selector('[data-testid=create]')
    d.select_option('#answer', '5'); d.click('[data-testid=create]'); d.wait_for_selector('[data-testid=room-code]', timeout=10000)
    code = d.inner_text('[data-testid=room-code]').replace(' ', '')
    phones = [join(b, code, f'P{i + 1}') for i in range(len(pickers))]
    earned = [0] * len(pickers); maxp = [0] * len(pickers); play.two_max = 0
    next_(d); next_(d)
    for qi in range(10):
        d.wait_for_selector(f'[data-testid=prompt][data-idx="{qi}"]', timeout=15000)
        q = by_prompt[d.inner_text('[data-testid=prompt]')]; play.two_max += max(o['points'] for o in q['options']) == 2
        for i, p in enumerate(phones):
            opt = pickers[i](q, qi)
            p.wait_for_selector('button[data-option]:not([disabled])', timeout=15000); p.click(f'button[data-option="{opt["id"]}"]')
            earned[i] += opt['points']; maxp[i] += max(o['points'] for o in q['options'])
        next_(d); d.wait_for_selector('[data-testid=transition], [data-testid=distribution], [data-testid=suppressed]', timeout=15000); next_(d)
    return d, phones, code, [round(100 * e / m) for e, m in zip(earned, maxp)]

low = lambda q, i: min(q['options'], key=lambda o: o['points'])
high = lambda q, i: max(q['options'], key=lambda o: o['points'])
mid = lambda q, i: sorted(q['options'], key=lambda o: o['points'])[2]
def rnd(seed): r = random.Random(seed); return lambda q, i: r.choice(q['options'])

with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--no-sandbox']); errors = []
    d = sign_in(b, 'staging.scoring@example.org'); d.on('pageerror', lambda e: errors.append(str(e)))
    v2 = game_file(); bank = json.loads(v2)['rounds'][0]['activities']
    msg, exp_id = import_and_publish(d, v2)
    ok('Published version 1' in msg, f'creator: v2 game file accepted by the publish function ({msg[:40]})')
    ok(json.loads(sql(f"select content->'scoring' from pp.experience_versions where experience_id = '{exp_id}'"))['version'] == 2, 'publish: stored version carries scoring.version 2')

    # ---- 6 players: open, ego, self-protective, 3 random ----
    d, phones, code, expect = play(b, d, exp_id, bank, [low, high, mid, rnd(1), rnd(2), rnd(3)])
    d.wait_for_selector('text=Look at your phone', timeout=10000)
    got = []
    for i, p in enumerate(phones):
        p.click('[data-testid=reveal]'); p.wait_for_selector('[data-testid=result-card][data-version="2"]')
        got.append(int(p.inner_text('[data-testid=score]').split()[0]))
    ok(got == expect, f'personal: every score = 100 × Σpoints ÷ Σquestion maxima ({got} vs {expect})')
    ok(got[0] == 0 and got[1] == 100, f'personal: always-open = 0, always-highest = 100 ({play.two_max} of 10 questions had a top score of 2)')
    p0 = phones[0].inner_text('[data-testid=result-card]')
    ok("Who's Driving?" in p0 and phones[0].locator('[data-testid=r2-well]').count() == 1 and phones[0].locator('[data-testid=r2-reflect]').count() == 0,
       'personal: open player gets the v2 layout, evidence-based strengths, nothing to reflect on')
    ok(all(phones[i].locator('[data-testid=r2-challenge]').count() == 1 for i in range(6)), 'personal: everyone gets exactly one practical challenge')
    ok(phones[1].locator('[data-testid=r2-reflect]').count() == 1 and phones[1].locator('[data-testid=r2-well]').count() == 0, 'personal: always-ego player gets a reflection and no strengths')
    ok('does not measure your ego or personality' in phones[2].inner_text('[data-testid=r2-score]'), 'personal: score described as a game-based reflection score')
    phones[2].screenshot(path=f'{SHOTS}/v2_accept_phone.png', full_page=True)
    stage = d.inner_text('[data-testid=stage]')
    ok(not any(n in stage for n in [f'P{i}' for i in range(1, 7)]), 'presenter: no names on the results screen')
    next_(d); d.wait_for_selector('[data-testid=group]')
    g = d.inner_text('[data-testid=group]'); avg = d.get_attribute('[data-testid=group-average] [data-value]', 'data-value')
    ok('Our Team Ego Driving Score' in g and avg == str(round(sum(expect) / 6)), f'presenter: team score = mean of valid scores ({avg} vs {round(sum(expect) / 6)})')
    ok('6 completed' in g and d.locator('[data-testid=group-reflect]').count() == 1, 'presenter: completions and reflection prompt shown')
    ok('%' not in g, 'presenter: no category breakdown below 10 valid results (existing threshold)')
    ok(not any(n in g for n in [f'P{i}' for i in range(1, 7)]), 'presenter: no names in the team result')
    d.screenshot(path=f'{SHOTS}/v2_accept_group.png')
    d.click('[data-testid=end]'); d.click('[data-testid=end-confirm]'); d.wait_for_selector('[data-testid=recap]', timeout=10000)
    ok(sql(f"select string_agg(scoring_version::text, ',') from pp.session_summaries where experience_id = '{exp_id}'") == '2', 'history: the v2 room summary is tagged scoring_version 2')

    # ---- Optional score off, 4 players: personal results without a number; team result withheld (< 5) ----
    msg2, exp2 = import_and_publish(d, game_file('en', '--no-score'))
    d, phones, code, expect = play(b, d, exp2, bank, [low, high, mid, rnd(4)])
    phones[3].click('[data-testid=reveal]'); phones[3].wait_for_selector('[data-testid=result-card][data-version="2"]')
    ok(phones[3].locator('[data-testid=r2-score]').count() == 0 and phones[3].locator('[data-testid=score]').count() == 0, 'optional score: hidden when the game turns it off')
    next_(d); d.wait_for_timeout(1500); st = d.inner_text('[data-testid=stage]')
    ok(d.locator('[data-testid=group-average]').count() == 0, 'privacy: team result withheld with 4 valid results (minimum 5)')
    d.click('[data-testid=end]'); d.click('[data-testid=end-confirm]'); d.wait_for_selector('[data-testid=recap]', timeout=10000)

    # ---- Existing v1 game: unchanged ----
    d.goto(BASE + '#/host/ego-check'); d.wait_for_selector('[data-testid=create]'); d.select_option('#answer', '5'); d.click('[data-testid=create]')
    d.wait_for_selector('[data-testid=room-code]', timeout=10000); code1 = d.inner_text('[data-testid=room-code]').replace(' ', '')
    p1 = [join(b, code1, f'V{i}') for i in range(5)]
    next_(d); next_(d)
    for qi in range(10):
        d.wait_for_selector(f'[data-testid=prompt][data-idx="{qi}"]', timeout=15000)
        for i, p in enumerate(p1): p.wait_for_selector('button[data-option]:not([disabled])', timeout=15000); p.click(f'button[data-option="{"abcd"[(i + qi) % 4]}"]')
        next_(d); d.wait_for_selector('[data-testid=transition], [data-testid=distribution], [data-testid=suppressed]', timeout=15000); next_(d)
    p1[0].click('[data-testid=reveal]'); p1[0].wait_for_selector('[data-testid=result-card]')
    ok(p1[0].get_attribute('[data-testid=result-card]', 'data-version') is None, 'v1 game: still the original result card')
    next_(d); d.wait_for_selector('[data-testid=group]'); g1 = d.inner_text('[data-testid=group]')
    ok('Our Team Ego Driving Score' not in g1, 'v1 game: original team result screen')
    d.click('[data-testid=end]'); d.click('[data-testid=end-confirm]'); d.wait_for_selector('[data-testid=recap]', timeout=10000)
    ok(sql("select scoring_version from pp.session_summaries where experience_id = (select id from pp.experiences where slug = 'ego-check') order by ended_at desc limit 1") == '1', 'history: the v1 room summary keeps scoring_version 1')
    ok(not errors, f'no page errors {errors[:2]}')
    b.close()
print(f"{sum(c for c, _ in results)} passed, {sum(not c for c, _ in results)} failed")
