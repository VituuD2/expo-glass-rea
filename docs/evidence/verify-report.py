"""Check investigation integrity and report coverage without executing native code."""
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / 'docs/reverse-engineering-report.md'
OUTPUT = ROOT / 'docs/evidence/investigation-checks.json'
report = REPORT.read_text(encoding='utf-8-sig')
ids = [f'F{i:02}' for i in range(1, 21)]
walkthroughs = re.findall(r'^#### (F\d{2})\b', report, re.M)
assert walkthroughs == ids, walkthroughs
anchors = re.findall(r'<a id="([^"]+)"></a>', report)
assert len(anchors) == len(set(anchors)), 'Duplicate anchors'
assert not re.search(r'REPORT_TAIL|NATIVE_WALKTHROUGHS|em elaboração|TODO', report)
statuses = re.findall(r'^\| \[(F\d{2})\]\(#f\d{2}\) \| [^|]+ \| ([^|]+) \|', report, re.M)
assert [entry[0] for entry in statuses] == ids, statuses
counts = Counter(status.strip() for _, status in statuses)
assert counts == {'Verificado': 3, 'Parcialmente verificado': 16, 'Não verificado': 1}, counts
links = re.findall(r'\[[^\]]*\]\(([^)]+)\)', report)
local_links = 0
for link in links:
    if re.match(r'https?://', link):
        continue
    target, _, fragment = unquote(link).partition('#')
    if not target:
        assert fragment in anchors, f'Missing anchor: {fragment}'
        continue
    path = (REPORT.parent / target).resolve()
    assert path == OUTPUT or path.exists(), f'Missing file: {link}'
    if re.fullmatch(r'L\d+', fragment):
        assert int(fragment[1:]) <= len(path.read_text(encoding='utf-8-sig').splitlines()), link
    local_links += 1
archive_sha256 = hashlib.sha256((ROOT / 'artifacts/expo-glass-effect-58.0.5.tgz').read_bytes()).hexdigest()
assert archive_sha256 == 'c62fe880a26e761bc3fc6d259e6ab268e293f7344aaaa002389a804a5ec438ee'
published = ROOT / 'artifacts/package'
assert len([p for p in published.rglob('*') if p.is_file()]) == 55
comparison = json.loads((ROOT / 'docs/evidence/provenance-comparison.json').read_text(encoding='utf-8-sig'))
assert len(comparison) == 28
assert sum(row['published'] for row in comparison) == 21
assert sum(row['same_bytes'] is True for row in comparison) == 20
for row in comparison:
    source = ROOT / 'upstream/packages/expo-glass-effect' / row['path']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == row['repo_sha256'], source
    if row['published']:
        target = published / row['path']
        assert hashlib.sha256(target.read_bytes()).hexdigest() == row['package_sha256'], target
        assert (source.read_bytes() == target.read_bytes()) == row['same_bytes'], target
manifest = json.loads((ROOT / 'docs/evidence/acquisition-manifest.json').read_text(encoding='utf-8'))
for row in manifest['files']:
    data = (ROOT / 'upstream' / row['path']).read_bytes()
    assert hashlib.sha256(data).hexdigest() == row['sha256'], row['path']
bundle = json.loads((ROOT / 'docs/evidence/rea-evidence-bundle.json').read_text(encoding='utf-8-sig'))
record_ids = {record['evidence_id'] for record in bundle['records']}
assert set(re.findall(r'ev_[0-9a-f]{64}', report)) <= record_ids
result = {
    'target': 'expo-glass-effect@58.0.5', 'features': 20,
    'statuses': {**dict(counts), 'Inferido': 0}, 'walkthroughs': len(walkthroughs),
    'checked_local_file_links': local_links, 'checked_anchor_links': sum(link.startswith('#') for link in links),
    'published_files': 55, 'upstream_acquired_files': len(manifest['files']),
    'shared_files': 21, 'byte_identical_shared_files': 20,
    'rea_records': len(record_ids), 'archive_sha256': archive_sha256,
    'scope': 'Integrity, coverage and links only; no native runtime or external URL availability check',
    'passed': True,
}
OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
