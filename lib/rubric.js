// Rubric v1. Dimensions and LLM checks, based on Google's helpful content questions + QRG.
export const RUBRIC_VERSION = 'v1';

export const DIMENSIONS = [
  { key: 'originality', label: 'Originality', inOverall: true },
  { key: 'effort', label: 'Content effort', inOverall: true },
  { key: 'helpfulness', label: 'Helpfulness', inOverall: true },
  { key: 'skill', label: 'Talent or skill', inOverall: true },
  { key: 'accuracy', label: 'Accuracy', inOverall: true },
  { key: 'trust', label: 'Trust', inOverall: true },
  { key: 'people_first', label: 'People-first', inOverall: false },
  { key: 'spam', label: 'Spam', inOverall: true },
];

// types: which page types the check applies to. weight 2 = critical.
export const LLM_CHECKS = [
  { dim: 'originality', key: 'unique_info', weight: 2, q: 'Does the page include original information, data, testing or first-hand experience that goes beyond common knowledge about the game/product?' },
  { dim: 'originality', key: 'own_analysis', q: 'Does it give its own opinion, ranking or analysis with reasons, rather than only restating facts?' },
  { dim: 'originality', key: 'not_generic_rewrite', weight: 2, q: 'Is it clearly more than a generic rewrite of what any top search result would say?' },
  { dim: 'originality', key: 'specific_examples', q: 'Does it use specific examples, numbers, builds, scenarios or comparisons?' },

  { dim: 'effort', key: 'depth', q: 'Does it go beyond the obvious answer and cover edge cases, alternatives or follow-up questions?' },
  { dim: 'effort', key: 'task_structure', q: 'Is the structure built around what the reader needs to do (steps, tables, comparisons, clear sections)?' },
  { dim: 'effort', key: 'no_filler', weight: 2, q: 'Is the page free of padding, repetition and fluff that adds length but no value?' },

  { dim: 'helpfulness', key: 'answers_early', weight: 2, q: 'Is the main promise of the title/H1 answered or delivered early (roughly the first 150 words or first section)?' },
  { dim: 'helpfulness', key: 'complete', q: 'Would a typical reader leave without needing to search again for the same thing?' },
  { dim: 'helpfulness', key: 'actionable', q: 'Does it give clear takeaways, next steps or decisions the reader can act on?' },
  { dim: 'helpfulness', key: 'matches_intent', q: 'Does the content match the search intent implied by the title?' },

  { dim: 'skill', key: 'expert_knowledge', weight: 2, q: 'Does it show knowledge only a real, experienced player of this game would have (mechanics, meta, pitfalls)?' },
  { dim: 'skill', key: 'correct_terminology', q: "Does it use the game's terminology correctly and naturally?" },
  { dim: 'skill', key: 'clear_writing', q: 'Is the writing clear, well organised and easy to follow?' },

  { dim: 'accuracy', key: 'no_contradictions', weight: 2, q: 'Is the page free of internal contradictions (e.g. different numbers or claims for the same thing)?' },
  { dim: 'accuracy', key: 'specific_claims', q: 'Are the claims specific enough to be checked (exact values, names, dates) rather than vague?' },
  { dim: 'accuracy', key: 'no_obvious_errors', q: 'Is it free of claims that are clearly wrong given widely known facts about the game? Answer unclear if you are not sure.' },
  { dim: 'accuracy', key: 'time_sensitive_flagged', types: ['blog', 'review'], q: 'Is time-sensitive info (patch, season, meta, prices) tied to a version or date so the reader knows when it applies?' },

  { dim: 'trust', key: 'transparent', q: 'Is it transparent about what is being sold or promoted and any commercial intent (for product pages: what you get, delivery, guarantees, risks)?' },
  { dim: 'trust', key: 'no_exaggeration', q: 'Is it free of exaggerated, shocking or clickbait claims?' },
  { dim: 'trust', key: 'safety_honest', types: ['product'], q: 'Does it honestly address risks for the buyer (account safety, ToS, refunds) instead of hiding them?' },

  { dim: 'people_first', key: 'for_players', weight: 2, q: 'Is it written mainly for players, not mainly to rank in search engines?' },
  { dim: 'people_first', key: 'title_matches', q: 'Does the content deliver what the title and headings promise?' },
  { dim: 'people_first', key: 'no_ai_padding', q: 'Is it free of generic AI-style phrasing ("in today\'s fast-paced world", "in conclusion", "whether you are a beginner or a pro")?' },
  { dim: 'people_first', key: 'satisfying', q: 'Would a reader feel they had a satisfying experience and learned enough?' },

  { dim: 'spam', key: 'no_scaled_template', weight: 2, q: 'Does it NOT read like a templated page where the game name could be swapped and the text would still fit?' },
  { dim: 'spam', key: 'no_doorway', q: 'Does it give real value on its own instead of only funnelling the reader to another page or product?' },
];

export function scoreLabel(s, dim) {
  if (s == null) return 'Not enough evidence';
  if (dim === 'spam') return s >= 4.5 ? 'Clean' : s >= 3 ? 'Some risk' : 'High risk';
  if (dim === 'people_first') return s >= 4 ? 'Human-first' : s >= 3 ? 'Mixed' : 'Search-first';
  return s >= 4.5 ? 'Excellent' : s >= 3.5 ? 'Strong' : s >= 2.5 ? 'Fair' : s >= 1.5 ? 'Weak' : 'Poor';
}
