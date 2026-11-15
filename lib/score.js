// Turn checks into dimension scores and an overall score.
import { DIMENSIONS, scoreLabel } from './rubric';

export function scoreDimensions(checks) {
  return DIMENSIONS.map(d => {
    const cs = checks.filter(c => c.dim === d.key);
    let pw = 0, fw = 0, passed = 0, failed = 0, unclear = 0;
    for (const c of cs) {
      if (c.verdict === 'pass') { pw += c.weight; passed++; }
      else if (c.verdict === 'fail') { fw += c.weight; failed++; }
      else unclear++;
    }
    const decided = pw + fw;
    const score = decided >= 1 ? Math.round((1 + 4 * pw / decided) * 10) / 10 : null;
    const unclearShare = cs.length ? unclear / cs.length : 1;
    const confidence = score == null ? 'low' : unclearShare < 0.2 ? 'high' : unclearShare < 0.5 ? 'medium' : 'low';
    return { dim: d.key, label: d.label, inOverall: d.inOverall, score, passed, failed, unclear, confidence, verdict: scoreLabel(score, d.key) };
  });
}

export function overallScore(dims, isYmyl) {
  let sum = 0, w = 0;
  for (const d of dims) {
    if (!d.inOverall || d.score == null) continue;
    const weight = isYmyl && d.dim === 'trust' ? 2 : 1;
    sum += d.score * weight; w += weight;
  }
  const overall = w ? Math.round((sum / w) * 10) / 10 : null;
  return { overall, verdict: scoreLabel(overall, 'overall') };
}
