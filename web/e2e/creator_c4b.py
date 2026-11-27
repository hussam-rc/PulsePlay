"""PulsePlay Creator Studio C4b: CSV template, export and import with preview, errors, duplicates, update mode, Arabic,
200 rows, phone width, and published versions left unchanged. Needs test-env/start.sh.
Usage: BASE=http://localhost:8789/PulsePlay/app/ python3 e2e/creator_c4b.py"""
import os, json, subprocess, tempfile, urllib.request
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8789/PulsePlay/app/'); API = BASE.split('/PulsePlay')[0]
SHOTS = os.environ.get('SHOTS', '/tmp/shots'); os.makedirs(SHOTS, exist_ok=True)
AXE = os.path.join(os.path.dirname(__file__), '..', 'node_modules', 'axe-core', 'axe.min.js')
results = []
def ok(c, m): results.append((c, m)); print(('PASS ' if c else 'FAIL ') + m, flush=True)
def sql(q): return subprocess.run(['psql', '-At', '-d', os.environ.get('PP_DB', 'e2e'), '-c', q], capture_output=True, text=True, check=True).stdout.strip()
tmp = tempfile.mkdtemp()
def csv_file(name, text, bom=True):
    p = os.path.join(tmp, name); open(p, 'w', encoding='utf-8-sig' if bom else 'utf-8', newline='').write(text); return p
HEAD = 'id;question;category;area;status;answer_1;points_1;answer_2;points_2;answer_3;points_3;answer_4;points_4'
def rows(n, start=0): return [f';Situation {i}: a moment at work;{["planning", "feedback", "meetings"][i % 3]};;in use;Ask what they need {i};0;Explain calmly {i};0;Go quiet {i};2;Insist you are right {i};3' for i in range(start, start + n)]

with sync_playwright() as pw:
    b = pw.chromium.launch(); errors = []
    ctx = b.new_context(viewport={'width': 1366, 'height': 900}, accept_downloads=True); d = ctx.new_page(); d.on('pageerror', lambda e: errors.append(str(e)))
    d.goto(BASE + '#/workspace'); d.wait_for_selector('[data-testid=email]'); email = 'creator.c4b@example.org'
    d.fill('[data-testid=email]', email); d.click('[data-testid=send]'); d.wait_for_selector('[data-testid=code]')
    d.fill('[data-testid=code]', json.load(urllib.request.urlopen(f'{API}/__test/code?email={email}'))['code']); d.click('[data-testid=verify]')
    d.wait_for_selector('[data-testid=new-score]', timeout=10000); d.click('[data-testid=new-score]'); d.wait_for_selector('[data-testid=csv]')
    exp_id = d.url.split('/edit/')[1]

    # template
    with d.expect_download() as dl: d.click('[data-testid=csv-template]')
    t = open(dl.value.path(), encoding='utf-8').read()
    ok(t.startswith('﻿') and t.split('\r\n')[0].lstrip('﻿').startswith('id;question;category;area;status;answer_1;points_1'), 'template: UTF-8 with BOM, semicolons for Excel, the columns this game needs')

    # a file with errors: preview explains, nothing changes until confirm, cancel leaves the game as it was
    bad = csv_file('bad.csv', '\n'.join([HEAD, ';;x;;;A;0;B;3;;;;', ';Only one answer;x;;;A;0;;;;;;', ';Bad points;x;;;A;zero;B;3;;;;', ';Good one;x;;;"Answer with ; and ""quotes""";0;"Two\nlines";3;;;;']))
    d.set_input_files('[data-testid=csv-file]', bad); d.wait_for_selector('[data-testid=csv-preview]')
    errs = d.locator('[data-testid=csv-error]').all_inner_texts()
    ok(any('question is empty' in e for e in errs) and any('at least 2 answers' in e for e in errs) and any('points_1 must be a whole number' in e for e in errs), f'errors: explained per line ({len(errs)} messages)')
    ok('1 new' in d.inner_text('[data-testid=csv-summary]') and '3 with errors' in d.inner_text('[data-testid=csv-summary]'), 'errors: summary counts new and skipped rows')
    ok(d.locator('[data-testid=question]').count() == 3, 'preview: the game is unchanged before confirming')
    d.click('[data-testid=csv-cancel]'); ok(d.locator('[data-testid=csv-preview]').count() == 0 and d.locator('[data-testid=question]').count() == 3, 'cancel: nothing imported')

    # 200 rows, comma file without BOM, replaces the blank starter questions
    big = csv_file('big.csv', '\n'.join([HEAD.replace(';', ','), *[r.replace(';', ',') for r in rows(200)]]), bom=False)
    d.set_input_files('[data-testid=csv-file]', big); d.wait_for_selector('[data-testid=csv-preview]')
    ok('200 new' in d.inner_text('[data-testid=csv-summary]'), 'import: 200 rows from a comma file without BOM, all valid')
    d.click('[data-testid=csv-confirm]'); d.wait_for_selector('[data-testid=csv-msg]')
    d.wait_for_function("document.querySelectorAll('[data-testid=q-row],[data-testid=question]').length === 200 || document.querySelector('[data-testid=q-count]')?.innerText.startsWith('200')", timeout=10000)
    ok('200 added' in d.inner_text('[data-testid=csv-msg]') and d.inner_text('[data-testid=q-count]').startswith('200'), 'import: 200 questions added after confirming; blank starter questions removed')
    d.wait_for_selector('text=✓ All changes saved', timeout=15000)
    ok('Ready to publish' in d.inner_text('[data-testid=checker]'), 'import: the imported bank passes every check')

    # duplicates
    dup = csv_file('dup.csv', '\n'.join([HEAD, *rows(1, 5), ';Brand new question;x;;;A;0;B;3;;;;', ';brand NEW question;x;;;A;0;B;3;;;;']))
    d.set_input_files('[data-testid=csv-file]', dup); d.wait_for_selector('[data-testid=csv-preview]')
    w = d.locator('[data-testid=csv-warning]').all_inner_texts()
    ok(any('already exists in this game' in x for x in w) and any('on line 3' in x for x in w), 'duplicates: warned against the game and within the file (still importable)')
    d.click('[data-testid=csv-cancel]')

    # publish v1, then export → edit one line → import as update → publish v2; v1 unchanged
    d.click('[data-testid=publish]'); d.wait_for_selector('[data-testid=msg]', timeout=20000)
    ok('Published version 1' in d.inner_text('[data-testid=msg]'), 'publish: version 1 of the imported bank')
    d.select_option('[data-testid=csv-sep]', ',');
    with d.expect_download() as dl: d.click('[data-testid=csv-export]')
    exported = open(dl.value.path(), encoding='utf-8-sig').read().split('\r\n')
    ok(len([l for l in exported if l]) == 201 and exported[0].startswith('id,question'), 'export: header plus 200 questions, with ids')
    exported[1] = exported[1].replace('Situation 0: a moment at work', 'Situation 0, reworded')
    if ',Situation 0, reworded,' in exported[1]: exported[1] = exported[1].replace(',Situation 0, reworded,', ',"Situation 0, reworded",')
    upd = csv_file('upd.csv', '\r\n'.join(exported), bom=False)
    d.set_input_files('[data-testid=csv-file]', upd); d.wait_for_selector('[data-testid=csv-preview]'); d.click('[data-testid=csv-mode-update]')
    ok('0 new · 200 updated' in d.inner_text('[data-testid=csv-summary]'), 'update mode: every row matches an existing id')
    d.click('[data-testid=csv-confirm]'); d.wait_for_selector('[data-testid=csv-msg]'); d.wait_for_selector('text=✓ All changes saved', timeout=15000)
    d.fill('[data-testid=q-search]', 'reworded'); d.wait_for_function("document.querySelector('[data-testid=q-count]').innerText.startsWith('1 of 200')")
    ok(True, 'update mode: the reworded question is updated in place (200 questions, no duplicates)')
    d.click('[data-testid=publish]'); d.wait_for_function("document.querySelector('[data-testid=msg]')?.innerText.includes('Published version 2')", timeout=20000)
    v1 = sql(f"select content->'rounds'->0->'activities'->0->>'prompt' from pp.experience_versions v where v.experience_id = '{exp_id}' and version = 1")
    v2 = sql(f"select content->'rounds'->0->'activities'->0->>'prompt' from pp.experience_versions v where v.experience_id = '{exp_id}' and version = 2")
    ok(v1 == 'Situation 0: a moment at work' and v2 == 'Situation 0, reworded', f'versions: version 1 keeps the old text, version 2 has the update ({v1!r} / {v2!r})')

    # Arabic, right to left
    ar = csv_file('ar.csv', '\n'.join([HEAD, ';زميلة تبكي بعد اجتماع صعب.;empathy;;;أسألها بهدوء إن كانت تريد رفقة;0;أمنحها خصوصيتها ثم أطمئن عليها;0;أتصرف كأن شيئًا لم يحدث;2;أقول لها إنها أخذت الأمر بشكل شخصي;3']))
    d.set_input_files('[data-testid=csv-file]', ar); d.wait_for_selector('[data-testid=csv-preview]')
    cell = d.locator('[data-testid=csv-row] td[dir=auto]').first
    ok('زميلة تبكي' in cell.inner_text() and cell.evaluate('e => getComputedStyle(e).direction') == 'rtl', 'Arabic: text kept exactly and shown right to left in the preview')
    d.add_script_tag(path=AXE)
    v = d.evaluate("axe.run(document.querySelector('[data-testid=csv]'),{resultTypes:['violations']}).then(r=>r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id))")
    ok(not v, f'accessibility (CSV panel and preview): {v or "no serious issues"}')
    d.screenshot(path=f'{SHOTS}/c4b_preview_ar.png')
    d.click('[data-testid=csv-cancel]')

    # phone
    m = b.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True, storage_state=ctx.storage_state()).new_page()
    m.goto(d.url); m.wait_for_selector('[data-testid=csv]'); m.set_input_files('[data-testid=csv-file]', bad); m.wait_for_selector('[data-testid=csv-preview]')
    ok(not m.evaluate('document.documentElement.scrollWidth > innerWidth + 1'), 'phone: CSV panel and preview fit 375 px')
    m.locator('[data-testid=csv]').screenshot(path=f'{SHOTS}/c4b_phone.png')
    ok(not errors, f'no page errors {errors[:2]}')
    b.close()
print(f"{sum(c for c, _ in results)} passed, {sum(not c for c, _ in results)} failed")
