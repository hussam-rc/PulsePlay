"""Release 2.0A journeys: Discover, cards, detail, mobile navigation, languages, accessibility (axe-core).
Usage: BASE=http://localhost:8789/PulsePlay/app/ SHOTS=/tmp/shots python3 e2e/release_2a.py"""
import os, json
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8789/PulsePlay/app/'); SHOTS = os.environ.get('SHOTS', '/tmp/shots'); os.makedirs(SHOTS, exist_ok=True)
AXE = os.path.join(os.path.dirname(__file__), '..', 'node_modules', 'axe-core', 'axe.min.js')
results = []
def ok(c, m): results.append((c, m)); print(('PASS ' if c else 'FAIL ') + m, flush=True)
def cards(p): return p.eval_on_selector_all('article[data-testid^=card-]', 'els => els.map(e => e.dataset.testid.slice(5))')
def overflow(p): return p.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
def axe(p):
    p.add_script_tag(path=AXE)
    r = p.evaluate("axe.run(document, { resultTypes: ['violations'] }).then(r => r.violations.filter(v => ['serious','critical'].includes(v.impact)).map(v => v.id + ' x' + v.nodes.length))")
    return r

with sync_playwright() as pw:
    b = pw.chromium.launch(); errors = []
    m = b.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True, locale='en-US').new_page()
    m.on('pageerror', lambda e: errors.append(str(e)))
    m.goto(BASE + '#/discover'); m.wait_for_selector('text=Less awkward meetings')
    m.screenshot(path=f'{SHOTS}/2a_discover_375.png', full_page=True)
    ok(not overflow(m), 'discover: no sideways scrolling at 375 px')
    ok(m.is_visible('[data-testid=hero-code]'), 'hero: room-code field visible on first screen')
    tabs = m.eval_on_selector_all('[data-testid=tabbar] a', 'els => els.map(a => a.innerText.trim())')
    ok(len(tabs) == 5 and all(len(t) > 2 for t in tabs), f'mobile: bottom tab bar with 5 labelled items {tabs}')
    ok(not m.is_visible('[data-testid=coming-next] li'), 'roadmap collapsed by default (catalogue first)')
    # hero join
    m.fill('[data-testid=hero-code]', '12'); m.click('[data-testid=hero-join]'); ok(m.is_visible('#hero-code-err'), 'hero join: short code explained inline')
    m.fill('[data-testid=hero-code]', '482913'); m.click('[data-testid=hero-join]'); m.wait_for_url('**#/j/482913'); ok(True, 'hero join: valid code opens the join page with the code')
    m.goto(BASE + '#/discover'); m.wait_for_selector('[data-testid=purpose-icebreak]')
    # purposes
    m.click('[data-testid=purpose-icebreak]'); ok(cards(m) == ['would-you-rather'], f'purpose "Break the ice" shows matching games {cards(m)}')
    m.click('[data-testid=purpose-learn]'); ok(cards(m) == ['myth-or-fact'], 'purpose "Learn together" shows the quiz')
    m.click('[data-testid=purpose-ideas]'); ok(m.is_visible('[data-testid=empty-purpose] >> text=Create one'), 'purpose without games: honest empty state with a create link')
    m.click('[data-testid=purpose-ideas]'); ok(len(cards(m)) == 3, 'purpose toggles off')
    # filters
    m.click('summary:has-text("More filters")'); m.select_option('[data-testid=f-duration]', 'short'); ok(sorted(cards(m)) == ['myth-or-fact', 'would-you-rather'], 'filter: up to 10 min')
    m.select_option('[data-testid=f-duration]', 'any'); m.select_option('[data-testid=f-group]', '50+'); ok(sorted(cards(m)) == ['ego-check', 'myth-or-fact', 'would-you-rather'], 'filter: 50+ people')
    m.select_option('[data-testid=f-group]', 'any')
    m.fill('#search', 'myth'); ok(cards(m) == ['myth-or-fact'], 'search still works'); m.fill('#search', '')
    # cards show only supported actions and what you do
    ok(all(m.inner_text(f'[data-testid=card-{g}] [data-testid=what-you-do]').strip() for g in cards(m)), 'cards say what participants will do')
    ok(m.is_visible('[data-testid=card-host-ego-check]'), 'card: Host action for live games')
    # detail
    m.click('[data-testid=card-ego-check] h2'); m.wait_for_selector('[data-testid=sample]')
    ok(m.is_visible('text=How it works') and m.is_visible('[data-testid=detail-host]'), 'detail: how it works, sample question, host action')
    ok(not overflow(m), 'detail: no sideways scrolling at 375 px'); m.screenshot(path=f'{SHOTS}/2a_detail_375.png', full_page=True)
    # lazy routes still work
    for path, sel in [('#/host/ego-check', '[data-testid=create]'), ('#/workspace', 'text=Sign in'), ('#/practice/would-you-rather', 'text=PRACTICE'), ('#/guide/ego-check', 'h1'), ('#/create', 'text=Create a game')]:
        m.goto(BASE + path); m.wait_for_selector(sel, timeout=10000); ok(True, f'on-demand page loads: {path}')
    # languages
    for l, headline in [('de', 'Weniger peinliche Meetings'), ('fr', 'Moins de réunions gênantes'), ('ar', 'اجتماعات أقل حرجًا')]:
        p = b.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True).new_page(); p.add_init_script(f"localStorage.setItem('pp_lang','{l}')")
        p.goto(BASE + '#/discover'); p.wait_for_selector(f'text={headline}')
        ok(p.evaluate('document.documentElement.dir') == ('rtl' if l == 'ar' else 'ltr') and not overflow(p), f'{l}: discover translated, right direction, no overflow')
        if l == 'ar': p.screenshot(path=f'{SHOTS}/2a_discover_ar.png')
        p.close()
    # desktop + accessibility
    d = b.new_context(viewport={'width': 1280, 'height': 800}).new_page(); d.goto(BASE + '#/discover'); d.wait_for_selector('text=Less awkward meetings')
    d.screenshot(path=f'{SHOTS}/2a_discover_1280.png'); ok(not d.is_visible('[data-testid=tabbar]'), 'desktop: top navigation, no bottom tab bar')
    for path in ['#/discover', '#/x/ego-check', '#/play', '#/j']:
        d.goto(BASE + path); d.wait_for_timeout(600); v = axe(d); ok(not v, f'axe (serious/critical) {path}: {v or "none"}')
    ok(not errors, f'no page errors {errors[:2]}')
    b.close()
print(f"{sum(c for c, _ in results)} passed, {sum(not c for c, _ in results)} failed")
