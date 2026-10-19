"""Compact observable failures for repair, or build a blind local comparison."""
import argparse
from collections import Counter
import hashlib
import html
import json
from pathlib import Path
import random
import shutil

def compact(report):
    return {'htmlSha256': report['htmlSha256'], 'briefSha256': report['briefSha256'],
            'pass': report['pass'], 'blockedRequests': report['blockedRequests'],
            'formats': [{'id': f['id'], 'nondeterministic': f['nondeterministic'], 'errors': f['errors'],
                         'reads': [{'id': r['id'], 'arrival': r['arrival'], 'holdSamples': r['holdSamples'],
                                    'failureCounts': dict(Counter(x['kind'] for x in r['failures'])),
                                    'examples': list({(x['kind'], tuple(x.get('reasons', []))): x for x in reversed(r['failures'])}.values())[:8]}
                                   for r in f['reads']]} for f in report['formats']],
            'limitations': report['limitations']}

def gallery(manifest, output):
    entries = json.loads(Path(manifest).read_text(encoding='utf-8'))
    output = Path(output)
    output.mkdir(parents=True, exist_ok=False)
    rng = random.Random(1947)  # Reproducible assignment, not cryptographic blinding.
    mapping = []
    cards = []
    by_brief = {}
    for e in entries:
        by_brief.setdefault(e['brief'], []).append(e)
    for brief, group in by_brief.items():
        rng.shuffle(group)
        for n, e in enumerate(group):
            label = brief+'-'+chr(65+n)
            evaluation = Path(e['evaluation']).resolve()
            report = json.loads((evaluation/'report.json').read_text(encoding='utf-8'))
            videos = []
            for f in report['formats']:
                if not f['video']:
                    raise ValueError('Render candidates before building the blind gallery')
                name = label+'-'+f['id']+'.mp4'
                source = evaluation/f['video']
                shutil.copyfile(source, output/name)
                videos.append('<video controls muted loop preload="metadata" src="'+html.escape(name)+'"></video>')
            mapping.append({**e, 'label': label, 'htmlSha256': report['htmlSha256']})
            cards.append('<article><h2>'+html.escape(label)+'</h2>'+''.join(videos)+'<p>Rate clarity, pacing, visual quality, and preservation of meaning, 1–5. Record preferred candidate and why.</p><textarea placeholder="Your assessment; no ratings are prefilled"></textarea></article>')
    page = '<!doctype html><meta charset="utf-8"><title>Blind motion comparison</title><style>body{font:18px system-ui;margin:40px;background:#fafafa;color:#222}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:28px}article{padding:20px;border:1px solid #bbb}video{max-width:100%;max-height:540px;display:block;margin:12px auto}textarea{width:95%;height:100px}</style><h1>Motion pilot: blind comparison</h1><p>Original synthetic examples. These are silent motion inserts, not finished episode clips. Model identities and machine results are withheld here. Inspect both formats. Notes stay in this page only and are not saved automatically.</p><main>'+''.join(cards)+'</main>'
    (output/'index.html').write_text(page, encoding='utf-8')
    # The mapping is a separate file, never embedded in the gallery page.
    (output/'reveal.json').write_text(json.dumps(mapping, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({'gallery': str(output/'index.html'), 'candidates': len(entries), 'human_ratings': 'not_collected'}))

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest='mode', required=True)
    c = sub.add_parser('compact'); c.add_argument('report'); c.add_argument('output')
    g = sub.add_parser('gallery'); g.add_argument('manifest'); g.add_argument('output')
    args = p.parse_args()
    if args.mode == 'compact':
        Path(args.output).write_text(json.dumps(compact(json.loads(Path(args.report).read_text(encoding='utf-8'))), indent=2)+'\n', encoding='utf-8')
    else:
        gallery(args.manifest, args.output)
