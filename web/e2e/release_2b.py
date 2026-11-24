"""Release 2.0B journeys: concierge, game-specific results and highlights, next steps, section guidance, languages, reduced motion, accessibility.
Usage: BASE=http://localhost:8789/PulsePlay/app/ SHOTS=/tmp/shots python3 e2e/release_2b.py"""
import os
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8789/PulsePlay/app/'); SHOTS = os.environ.get('SHOTS', '/tmp/shots'); os.makedirs(SHOTS, exist_ok=True)
AXE = os.path.join(os.path.dirname(__file__), '..', 'node_modules', 'axe-core', 'axe.min.js')
results = []
def ok(c, m): results.append((c, m)); print(('PASS ' if c else 'FAIL ') + m, flush=True)
def overflow(p): return p.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
def recs(p): return p.eval_on_selector_all('[data-testid^=rec-]:not([data-testid^=rec-host])', 'els => els.map(e => e.dataset.testid.slice(4))')
def axe(p):
    p.add_script_tag(path=AXE)
    return p.evaluate("axe.run(document, { resultTypes: ['violations'] }).then(r => r.violations.filter(v => ['serious','critical'].includes(v.impact)).map(v => v.id + ' x' + v.nodes.length))")

def practice_to_results(p, game, join=None):
    """Run a practice room (simulated players) until the end-of-game results screen."""
    p.goto(BASE + f'#/practice/{game}'); p.wait_for_selector('[data-testid=joined]')
    if join:
        p.fill('[data-testid=phone] [data-testid=nickname]', join); p.check('[data-testid=phone] [data-testid=consent]'); p.click('[data-testid=phone] [data-testid=join]')
        p.wait_for_selector(f"text=You're in, {join}!")
    p.click('[data-testid=next]'); p.click('[data-testid=next]')
    for q in range(10):
        p.wait_for_selector(f'[data-testid=prompt][data-idx="{q}"]', timeout=15000)
        p.click('[data-testid=next]')  # skip reading
        if join:
            p.wait_for_selector('[data-testid=phone] button[data-option]:not([disabled])', timeout=10000)
            p.click('[data-testid=phone] button[data-option] >> nth=0')
        p.wait_for_selector('[data-testid=next]:not([disabled]):has-text("Next question"), [data-testid=next]:not([disabled]):has-text("Show results"), [data-testid=next]:not([disabled]):has-text("results")', timeout=30000)
        p.click('[data-testid=next]')
    p.wait_for_selector('[data-testid^=results-]', timeout=15000)

with sync_playwright() as pw:
    b = pw.chromium.launch(); errors = []
    ctx = b.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True)
    m = ctx.new_page(); m.on('pageerror', lambda e: errors.append(str(e)))

    # --- Concierge: from the hero, four taps, explained suggestions
    m.goto(BASE + '#/discover'); m.click('[data-testid=open-find]'); m.wait_for_selector('[data-testid=find-q]')
    ok(m.evaluate('document.activeElement?.dataset?.testid') == 'find-q', 'concierge: focus moves to the question (screen readers)')
    for k, v in [('a', 'colleagues'), ('g', 'laugh'), ('s', '6-15'), ('t', '5-10')]:
        m.click(f'[data-testid=opt-{k}-{v}]')
    m.wait_for_selector('[data-testid=find-results]'); r = recs(m)
    ok(r and r[0] == 'would-you-rather' and len(r) <= 3, f'concierge: icebreaker for 15 colleagues → Would You Rather first {r}')
    reasons = m.inner_text('[data-testid=rec-would-you-rather] ul')
    ok(reasons.count('✓') >= 3 or len(reasons.splitlines()) >= 3, 'concierge: each suggestion explains why')
    ok(not overflow(m), 'concierge: no sideways scrolling at 375 px'); m.screenshot(path=f'{SHOTS}/2b_find_375.png', full_page=True)
    ok(m.is_visible('[data-testid=rec-host-would-you-rather]'), 'concierge: Host action on suggestions')
    # direct link + refresh keep the results
    url = m.url; m.reload(); m.wait_for_selector('[data-testid=find-results]'); ok(recs(m) == r, 'concierge: refresh keeps the answers (in the link)')
    p2 = ctx.new_page(); p2.goto(BASE + '#/find?a=friends&g=teamwork&s=2-5&t=long'); p2.wait_for_selector('[data-testid=find-results], [data-testid=find-none]')
    ok('ego-check' not in recs(p2), 'concierge: never suggests a game that needs more people than the group has')
    p2.goto(BASE + '#/find?a=students&g=learn&s=1&t=10-20'); p2.wait_for_selector('[data-testid=find-results]')
    ok(recs(p2)[:1] == ['myth-or-fact'] and p2.is_visible('text=Play solo'), 'concierge: solo learning → Myth or Fact with Play solo')
    p2.close()
    m.click('[data-testid=find-results] header button >> nth=1'); m.wait_for_selector('[data-testid=find-q]')
    ok('What do you want' in m.inner_text('[data-testid=find-q]'), 'concierge: tapping an answer chip goes back to that question')
    m.click('text=Back'); m.wait_for_selector('[data-testid=opt-a-colleagues]'); ok(True, 'concierge: back button works')

    # --- Results: opinion game highlights
    d = b.new_context(viewport={'width': 1280, 'height': 800}).new_page(); d.on('pageerror', lambda e: errors.append(str(e)))
    practice_to_results(d, 'would-you-rather')
    ok(d.is_visible('[data-testid=results-aggregate]') and d.is_visible('[data-testid=hi-divided]') and d.is_visible('[data-testid=hi-united]'), 'Would You Rather: end shows most divided and most united questions')
    ok('Talk about it' in d.inner_text('[data-testid=hi-divided]'), 'Would You Rather: highlight comes with a discussion prompt')
    d.wait_for_timeout(1200); d.screenshot(path=f'{SHOTS}/2b_wyr_highlights.png', full_page=True)
    d.reload(); d.wait_for_timeout(1500)
    # --- Quiz highlights
    practice_to_results(d, 'myth-or-fact')
    ok(d.is_visible('[data-testid=hi-toughest]'), 'Myth or Fact: end shows the toughest claim')
    ok('got it right' in d.inner_text('[data-testid=hi-toughest]'), 'Myth or Fact: shows how many got it right')
    d.screenshot(path=f'{SHOTS}/2b_myth_highlights.png', full_page=True)
    # --- Reflection game: private result + takeaway, animated group average
    practice_to_results(d, 'ego-check', join='Hussam')
    ok(not d.is_visible('[data-testid=highlights]'), 'Who is in Control?: no per-question highlights (private reflection)')
    d.click('[data-testid=phone] [data-testid=reveal]'); d.wait_for_selector('[data-testid=phone] [data-testid=copy-takeaway]')
    ok(True, 'Who is in Control?: phone offers a takeaway to copy without the score')
    d.click('[data-testid=next]'); d.wait_for_selector('[data-testid=group-average]'); d.wait_for_timeout(1300)
    fin = d.get_attribute('[data-testid=group-average] [data-value]', 'data-value'); shown = d.inner_text('[data-testid=group-average] [data-value] [aria-hidden]')
    ok(fin.isdigit() and shown == fin, f'group average counts up to its final value ({shown} = {fin})')
    stage = d.inner_text('[data-testid=group]'); ok('Hussam' not in stage, 'group result never shows names')
    d.screenshot(path=f'{SHOTS}/2b_ego_group.png')

    # --- Reduced motion: numbers appear immediately
    rm = b.new_context(viewport={'width': 1280, 'height': 800}, reduced_motion='reduce').new_page()
    practice_to_results(rm, 'ego-check', join='Ana'); rm.click('[data-testid=next]'); rm.wait_for_selector('[data-testid=group-average]')
    lbl = rm.get_attribute('[data-testid=group-average] [data-value]', 'data-value'); txt = rm.inner_text('[data-testid=group-average] [data-value] [aria-hidden]')
    ok(lbl == txt, f'reduced motion: group average shown at once ({txt} = {lbl})')

    # --- Solo: translated, with next steps
    s = b.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True).new_page(); s.add_init_script("localStorage.setItem('pp_lang','de')")
    s.goto(BASE + '#/play/myth-or-fact'); s.wait_for_selector('[data-testid=solo-start]')
    ok('Fragen in deinem Tempo' in s.inner_text('body'), 'solo (DE): intro translated')
    s.click('[data-testid=solo-start]')
    for q in range(10):
        s.wait_for_selector('button[data-option]:not([disabled])'); s.click('button[data-option] >> nth=0'); s.wait_for_selector('.anim-pop button.btn-primary'); s.click('.anim-pop button.btn-primary')
    s.wait_for_selector('[data-testid=next-steps]'); ok('Für eine Gruppe leiten' in s.inner_text('[data-testid=next-steps]'), 'solo (DE): next steps offer hosting it for a group')
    ok(not overflow(s), 'solo: no sideways scrolling at 375 px')

    # --- One product: every section says what it is for
    for path, want in [('#/host', 'Run an experience'), ('#/create', 'Build something new'), ('#/play', 'Running it for a group')]:
        m.goto(BASE + path); m.wait_for_selector('[data-testid=section-purpose]'); ok(want in m.inner_text('[data-testid=section-purpose]'), f'section guidance on {path}')
    m.goto(BASE + '#/host'); ok(m.is_visible('a[href$="#/find"]'), 'Host links to the concierge')

    # --- Arabic concierge
    a = b.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True).new_page(); a.add_init_script("localStorage.setItem('pp_lang','ar')")
    a.goto(BASE + '#/find'); a.wait_for_selector('[data-testid=find-q]')
    ok(a.evaluate('document.documentElement.dir') == 'rtl' and 'من سينضم' in a.inner_text('[data-testid=find-q]') and not overflow(a), 'concierge (AR): translated, right-to-left, no overflow')
    a.screenshot(path=f'{SHOTS}/2b_find_ar.png')

    # --- Accessibility
    d.goto(BASE + '#/find'); d.wait_for_selector('[data-testid=find-q]'); d.wait_for_timeout(1000); v = axe(d); ok(not v, f'axe /find question: {v or "none"}')
    d.goto(BASE + '#/find?a=colleagues&g=connect&s=16-50&t=10-20'); d.wait_for_selector('[data-testid=find-results]'); d.wait_for_timeout(800); v = axe(d); ok(not v, f'axe /find results: {v or "none"}')
    d.goto(BASE + '#/host'); d.wait_for_timeout(500); v = axe(d); ok(not v, f'axe /host: {v or "none"}')
    ok(not errors, f'no page errors {errors[:2]}')
    b.close()
print(f"{sum(c for c, _ in results)} passed, {sum(not c for c, _ in results)} failed")
