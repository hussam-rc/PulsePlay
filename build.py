# Usage: python3 build.py <SUPABASE_URL> <PUBLISHABLE_KEY>  -> writes index.html
import sys
url, key = sys.argv[1], sys.argv[2]
s = open('game-src.html').read().replace('/*QRLIB*/', open('qr.min.js').read())
s = s.replace('/*NET*/false', 'true').replace('/*SUPA_URL*/', url).replace('/*SUPA_KEY*/', key)
open('index.html', 'w').write(s); print('index.html written')
