# Usage: python3 build.py <SUPABASE_URL> <PUBLISHABLE_KEY>  -> writes classic.html (archived single-file version; the site root redirects to the app)
import sys
url, key = sys.argv[1], sys.argv[2]
s = open('game-src.html').read().replace('/*QRLIB*/', open('qr.min.js').read())
s = s.replace('/*NET*/false', 'true').replace('/*SUPA_URL*/', url).replace('/*SUPA_KEY*/', key)
open('classic.html', 'w').write(s); print('classic.html written')
