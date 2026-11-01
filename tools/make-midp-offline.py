"""Pack the MIDP Checker into ONE html file that works offline (no website, no internet).

    python3 tools/make-midp-offline.py  [output.html]

Puts the page, midp-plus.js, midp-issues.js, the shared theme script and the Excel libraries
(SheetJS, ExcelJS) inside the file. Fonts fall back to the system ones offline.
"""
import pathlib, re, sys, datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
MIDP = ROOT / 'skills' / 'midp'
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'MIDP_Checker_offline.html'

def js(path):
    # a "</script" inside a library would end the tag early
    return '<script>\n' + path.read_text(encoding='utf-8').replace('</script', '<\\/script') + '\n</script>'

html = (MIDP / 'midp.html').read_text(encoding='utf-8')
swaps = {
    '<script src="../../core/theme.js"></script>': js(ROOT / 'core' / 'theme.js'),
    '<script src="../../lib/xlsx.full.min.js"></script>': js(ROOT / 'lib' / 'xlsx.full.min.js'),
    '<script src="../../lib/exceljs.min.js"></script>': js(ROOT / 'lib' / 'exceljs.min.js'),
    '<script src="../../core/todo-link.js"></script>': js(ROOT / 'core' / 'todo-link.js'),
    '<script src="midp-plus.js"></script>': js(MIDP / 'midp-plus.js'),
    '<script src="midp-issues.js"></script>': js(MIDP / 'midp-issues.js'),
    '<script src="midp-folder.js"></script>': js(MIDP / 'midp-folder.js'),
}
for old, new in swaps.items():
    if old not in html:
        sys.exit('Could not find ' + old + ' in midp.html — update this script.')
    html = html.replace(old, new)
left = re.findall(r'<script[^>]+src="(?!https?:)[^"]+"', html)
if left:
    sys.exit('Still linked: ' + ', '.join(left))
stamp = datetime.date.today().isoformat()
html = re.sub(r'<title>([^<]*)</title>', lambda m: '<title>' + m.group(1) + ' (offline)</title>', html, count=1)
html = html.replace('<head>', '<head>\n<!-- MIDP Checker — offline copy made ' + stamp + ' with tools/make-midp-offline.py -->', 1)
out.write_text(html, encoding='utf-8')
print('Wrote', out, round(out.stat().st_size / 1e6, 1), 'MB')
