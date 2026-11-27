"""PulsePlay Creator Studio C4c: duplicate detection, problem filters, new/edited/archived markers against the latest
published version, unpublished-changes summary, published versions untouched, and permission isolation.
Needs test-env/start.sh. Usage: BASE=http://localhost:8789/PulsePlay/app/ python3 e2e/creator_c4c.py"""
import os, json, subprocess, urllib.request
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8789/PulsePlay/app/'); API = BASE.split('/PulsePlay')[0]
SHOTS = os.environ.get('SHOTS', '/tmp/shots'); os.makedirs(SHOTS, exist_ok=True)
results = []
def ok(c, m): results.append((c, m)); print(('PASS ' if c else 'FAIL ') + m, flush=True)
def sql(q): return subprocess.run(['psql', '-At', '-d', os.environ.get('PP_DB', 'e2e'), '-c', q], capture_output=True, text=True, check=True).stdout.strip()

def bank():
    acts = [{'id': f'k{i}', 'type': 'choice', 'prompt': f'Question {i}: what would you do when the {w} changes?', 'shuffle': True,
             'options': [{'id': 'a', 'text': f'Talk it through {i}', 'points': 0}, {'id': 'b', 'text': f'Wait and see {i}', 'points': 3}]}
            for i, w in enumerate(['plan', 'deadline', 'budget', 'team', 'client', 'scope', 'tool', 'office', 'process', 'priority', 'manager', 'schedule',
                                   'hiring policy', 'travel rule', 'release date', 'pricing model', 'board agenda', 'meeting format', 'reporting line', 'holiday calendar',
                                   'coffee machine', 'project name', 'security check', 'office layout'])]
    acts[13]['prompt'] = acts[1]['prompt']                                           # exact duplicate of question 2
    acts[14]['prompt'] = 'Question 2: what would you do when the deadline changes again?'  # very similar to question 2
    acts[15]['options'][1]['text'] = acts[15]['options'][0]['text']                  # repeated answer
    return acts

def sign_in(ctx, email):
    d = ctx.new_page(); d.goto(BASE + '#/workspace'); d.wait_for_selector('[data-testid=email]')
    d.fill('[data-testid=email]', email); d.click('[data-testid=send]'); d.wait_for_selector('[data-testid=code]')
    d.fill('[data-testid=code]', json.load(urllib.request.urlopen(f'{API}/__test/code?email={email}'))['code']); d.click('[data-testid=verify]')
    d.wait_for_selector('[data-testid=new-score]', timeout=10000); return d

with sync_playwright() as pw:
    b = pw.chromium.launch(); errors = []
    d = sign_in(b.new_context(viewport={'width': 1366, 'height': 900}), 'creator.c4c@example.org'); d.on('pageerror', lambda e: errors.append(str(e)))
    d.click('[data-testid=new-score]'); d.wait_for_selector('[data-testid=checker]'); url = d.url; exp_id = url.split('/edit/')[1]
    d.click('text=Advanced: view the game file')
    g = json.loads(d.input_value('textarea[aria-label="Game file"]')); g['rounds'][0]['activities'] = bank()
    d.fill('textarea[aria-label="Game file"]', json.dumps(g)); d.click('text=Apply file changes'); d.wait_for_selector('text=✓ All changes saved', timeout=15000)
    d.reload(); d.wait_for_selector('[data-testid=qlist]')

    # duplicates
    w = d.inner_text('[data-testid=checker-warnings]')
    ok('Same question as question 14' in w and 'Very similar to question 15' in w and 'Two answers are the same' in w, 'duplicates: same, very similar and repeated answers listed under "Worth a look"')
    d.select_option('[data-testid=f-status]', 'duplicates')
    ok(d.locator('[data-testid=q-row]').count() == 4 and d.locator('[data-testid=q-row-dup]').count() == 4, 'duplicates: filter shows the 4 affected questions with badges')
    d.click('[data-testid=checker-warnings] a >> nth=0'); ok(d.locator('[data-testid=q-nav]').count() == 1, 'duplicates: the warning link opens the question')
    d.click('[data-testid=q-done]'); d.select_option('[data-testid=f-status]', 'all')
    ok(d.locator('[data-testid=q-changes]').count() == 0 and d.locator('[data-testid=unpublished]').count() == 0, 'never published: no change markers yet')

    # publish v1
    d.click('[data-testid=publish]'); d.wait_for_selector('[data-testid=msg]', timeout=20000)
    d.wait_for_selector('[data-testid=q-changes]', timeout=10000)
    ok('No changes since version 1' in d.inner_text('[data-testid=q-changes]') and d.locator('[data-testid=q-row-change]').count() == 0, 'after publishing: "No changes since version 1", no markers (published content compares equal)')

    # edit, archive, add, delete
    rows = d.locator('[data-testid=q-row]')
    rows.nth(2).click(); d.fill('[data-testid=question] [data-testid=q-prompt]', 'Question 2, reworded for clarity'); d.click('[data-testid=q-done]')
    rows.nth(3).click(); d.click('[data-testid=question] [data-testid=q-archive]'); d.click('[data-testid=q-done]')
    d.on('dialog', lambda dl: dl.accept()); rows.nth(5).click(); d.click('[data-testid=question] button[aria-label=Delete]')
    d.click('[data-testid=add-choice]'); d.wait_for_selector('[data-testid=q-nav]'); d.fill('[data-testid=question] [data-testid=q-prompt]', 'A brand new question')
    d.locator('[data-testid=question] [data-testid=q-option]').nth(0).fill('Ask first'); d.locator('[data-testid=question] [data-testid=q-option]').nth(1).fill('Decide alone'); d.click('[data-testid=q-done]')
    d.wait_for_function("document.querySelector('[data-testid=q-changes]')?.innerText.includes('4 unpublished changes')", timeout=10000)
    summary = d.inner_text('[data-testid=q-changes]')
    ok('4 unpublished changes since version 1: 1 new, 1 edited, 1 archived, 1 deleted' in summary, f'changes: summary counts every kind ({summary.splitlines()[0]})')
    marks = d.eval_on_selector_all('[data-testid=q-row-change]', 'els => els.map(e => e.dataset.change).sort()')
    ok(marks == ['archived', 'edited', 'new'], f'changes: rows marked New / Edited / Archived ({marks})')
    d.click('[data-testid=q-show-changes]'); ok(d.locator('[data-testid=q-row]').count() == 3, 'changes: "Show changed" filters to the changed questions')
    ok('Deleted since version 1 (1)' in d.inner_text('[data-testid=q-changes]'), 'changes: deleted question listed separately')
    d.wait_for_selector('text=✓ All changes saved', timeout=15000)
    ok('4 unpublished changes' in d.inner_text('[data-testid=unpublished]') and 'Version 1 stays as it is' in d.inner_text('[data-testid=unpublished]'), 'publish area: summary of unpublished changes; version 1 unchanged until publishing')
    d.screenshot(path=f'{SHOTS}/c4c_changes.png')
    v1_before = sql(f"select md5(content::text) from pp.experience_versions where experience_id = '{exp_id}' and version = 1")

    # publish v2: markers reset, v1 untouched
    d.click('[data-testid=publish]'); d.wait_for_function("document.querySelector('[data-testid=msg]')?.innerText.includes('Published version 2')", timeout=20000)
    d.wait_for_function("document.querySelector('[data-testid=q-changes]')?.innerText.includes('No changes since version 2')", timeout=10000)
    ok(True, 'publish v2: markers reset to "No changes since version 2"')
    v1_after = sql(f"select md5(content::text) from pp.experience_versions where experience_id = '{exp_id}' and version = 1")
    n2 = sql(f"select jsonb_array_length(content->'rounds'->0->'activities') from pp.experience_versions where experience_id = '{exp_id}' and version = 2")
    ok(v1_before == v1_after and n2 == '24', f'versions: version 1 byte-identical after publishing version 2; version 2 has 24 questions ({n2})')

    # permission isolation: another account cannot open, see or compare this game
    o = sign_in(b.new_context(viewport={'width': 1366, 'height': 900}), 'someone.else@example.org'); o.goto(url); o.wait_for_timeout(2500)
    ok('Not found' in o.inner_text('body') and o.locator('[data-testid=qlist]').count() == 0, 'isolation: another account sees "Not found", no questions, no change summary')
    r = o.evaluate("""async id => { const s = JSON.parse(localStorage.getItem('pp_auth')); const res = await fetch('/rest/v1/rpc/pp_get_published', {method: 'POST',
        headers: {apikey: 'testkey', authorization: 'Bearer ' + s.access_token, 'content-type': 'application/json'}, body: JSON.stringify({p_id: id})}); return [res.status, await res.text()]; }""", exp_id)
    ok(r[1] in ('null', '') or r[0] >= 400, f'isolation: the published content is not readable by another account ({r[0]} {r[1][:40]})')
    ok(not errors, f'no page errors {errors[:2]}')
    b.close()
print(f"{sum(c for c, _ in results)} passed, {sum(not c for c, _ in results)} failed")
