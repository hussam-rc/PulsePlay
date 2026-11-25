from playwright.sync_api import sync_playwright
import os; U=os.environ.get('BASE','http://localhost:8788/PulsePlay/app/'); import os; out=os.environ.get('SHOTS','/tmp')
def ok(c, m): print(('PASS ' if c else 'FAIL ')+m, flush=True)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox'])
    errs=[]; pg=b.new_page(viewport={'width':1440,'height':900}); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(U); pg.wait_for_selector('text=Less awkward meetings'); pg.screenshot(path=out+'/01_discover.png', full_page=True)
    ok(pg.locator('article').count()==3, 'discover shows 3 playable experiences')
    pg.fill('#search','myth'); ok(pg.locator('article').count()==1, 'search filters'); pg.fill('#search','')
    # practice: Ego Check
    pg.goto(U+'#/practice/ego-check'); pg.wait_for_selector('[data-testid=joined]')
    pg.fill('[data-testid=phone] [data-testid=nickname]','Hussam'); pg.check('[data-testid=phone] [data-testid=consent]'); pg.click('[data-testid=phone] [data-testid=join]')
    pg.wait_for_selector('text=You\'re in, Hussam!'); ok(pg.inner_text('[data-testid=joined]')=='7', 'lobby shows 7 (6 simulated + you)')
    pg.screenshot(path=out+'/02_lobby.png')
    pg.click('[data-testid=next]'); pg.click('[data-testid=next]')
    picks=[]
    for q in range(10):
        pg.wait_for_selector('[data-testid=prompt]')
        pg.click('[data-testid=next]')  # skip reading
        pg.wait_for_selector('[data-testid=phone] button[data-option]:not([disabled])', timeout=8000)
        if q==0: pg.screenshot(path=out+'/03_answer.png')
        opt = 'a' if q%2 else 'c'
        pg.click(f'[data-testid=phone] button[data-option="{opt}"]'); picks.append(opt)
        pg.wait_for_selector('[data-testid=next]:not([disabled]):has-text("Next question"), [data-testid=next]:not([disabled]):has-text("Show results")', timeout=30000)
        if q==0: ok('locked in' in pg.inner_text('[data-testid=phone]').lower(), 'phone shows locked in'); pg.screenshot(path=out+'/04_reveal.png')
        pg.click('[data-testid=next]')
    pg.wait_for_selector('[data-testid=reveal]'); pg.click('[data-testid=reveal]')
    sc = pg.inner_text('[data-testid=phone] [data-testid=score]')
    exp = pg.evaluate("""(p)=>{ /* recompute with the same rubric */ const pts=[[3,2,0,0],[2,3,0,0],[0,2,3,0],[2,0,0,3],[0,0,3,2],[2,0,3,0],[2,0,3,0],[2,0,3,0],[0,3,0,2],[3,0,1,0]];
        let s=0; p.forEach((o,q)=>s+=pts[q]['abcd'.indexOf(o)]); return Math.round(100*s/30) }""", picks)
    ok(sc.split()[0]==str(exp), f'personal score {sc.split()[0]} matches rubric {exp}')
    pg.screenshot(path=out+'/05_result.png')
    pg.click('[data-testid=next]'); pg.wait_for_selector('[data-testid=group]')
    g = pg.inner_text('[data-testid=group]'); ok('Our group result' in g and 'Hussam' not in g, 'group result shown without names')
    pg.screenshot(path=out+'/06_group.png')
    # practice: Would You Rather distribution
    pg.goto(U+'#/practice/would-you-rather'); pg.wait_for_selector('[data-testid=joined]')
    pg.click('[data-testid=next]'); pg.click('[data-testid=next]'); pg.click('[data-testid=next]')
    pg.wait_for_selector('[data-testid=distribution]', timeout=15000); ok(True, 'poll distribution revealed'); pg.screenshot(path=out+'/07_poll.png')
    # solo: Myth or Fact all correct
    pg.goto(U+'#/play/myth-or-fact'); pg.click('text=Start')
    ans = ['myth','myth','myth','myth','fact','myth','myth','fact','fact','myth']
    for a in ans:
        pg.click(f'button[data-option="{a}"]'); pg.click('button.btn-primary:has-text("Next"), button.btn-primary:has-text("See my result")')
    ok(pg.inner_text('[data-testid=score]').startswith('10/10'), 'solo trivia 10/10'); pg.screenshot(path=out+'/08_solo.png', full_page=True)
    # checker
    pg.goto(U+'#/create'); pg.wait_for_selector('[data-testid=open-builder]'); ok('no code' in pg.inner_text('main').lower() and pg.locator('[data-testid^=tpl-]').count() == 5, 'create page: starter templates and a way into the no-code builder')
    # mobile
    m=b.new_page(viewport={'width':375,'height':800}, is_mobile=True)
    for path in ['', '#/practice/ego-check', '#/play', '#/x/ego-check', '#/play/ego-check', '#/j/123456', '#/host/myth-or-fact', '#/host']:
        m.goto(U+path); m.wait_for_timeout(500)
        ok(not m.evaluate('document.documentElement.scrollWidth>window.innerWidth'), f'no horizontal overflow at 375px: /{path}')
    m.goto(U); m.screenshot(path=out+'/09_mobile.png', full_page=True)
    m.goto(U+'#/play'); m.fill('input[inputmode=numeric]','482913'); 
    m.click('text=Join 🚗'); m.wait_for_timeout(800)
    ok(m.url.endswith('#/j/482913'), 'join code opens the live join page: '+m.url)
    print('page errors:', errs); b.close()
