(() => {
  const $ = (id) => document.getElementById(id);
  const q = { vars: [], ones: [], dcs: [], round: 0, rounds: [], selected: [], used: new Set(), primes: [], chosen: new Set(), history: [], optimal: null, revealOptimal: false };
  let nextId = 0;
  const termBits = (n) => n.toString(2).padStart(q.vars.length, '0');
  const termName = (bits) => [...bits].map((b, i) => b === '-' ? '' : b === '1' ? q.vars[i] : `${q.vars[i]}'`).filter(Boolean).join('') || '1';
  const makeTerm = (bits, covers) => ({ id: nextId++, bits, covers: [...covers].sort((a, b) => a - b) });
  const comboPattern = (a, b) => {
    let diff = -1;
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) continue;
      if (a[i] === '-' || b[i] === '-' || diff !== -1) return null;
      diff = i;
    }
    return diff < 0 ? null : a.slice(0, diff) + '-' + a.slice(diff + 1);
  };
  const canCombine = (term, terms) => terms.some((other) => other.id !== term.id && !!comboPattern(term.bits, other.bits));
  const parse = (input, max) => {
    if (!input.trim()) return [];
    const parts = input.split(/[\s,;]+/).filter(Boolean);
    if (parts.some((part) => !/^\d+$/.test(part))) throw new Error('Use whole minterm numbers separated by commas.');
    const nums = parts.map(Number);
    if (nums.some((n) => n < 0 || n >= max)) throw new Error(`With ${q.vars.length} variables, use values from 0 to ${max - 1}.`);
    if (new Set(nums).size !== nums.length) throw new Error('Enter each number only once.');
    return nums.sort((a, b) => a - b);
  };
  const say = (message, good = false) => { $('quineActionMessage').textContent = message; $('quineActionMessage').className = `input-message${good ? ' quine-good' : ''}`; };
  const groupedTerms = (terms) => {
    const groups = new Map();
    terms.forEach((term) => {
      const ones = [...term.bits].filter((bit) => bit === '1').length;
      if (!groups.has(ones)) groups.set(ones, []);
      groups.get(ones).push(term);
    });
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  };
  const renderRound = () => {
    const terms = q.rounds[q.round] || [];
    const groups = groupedTerms(terms);
    $('quineRoundTitle').textContent = `Round ${q.round}`;
    $('quineRoundEyebrow').textContent = q.round === 0 ? '02 / GROUP BY NUMBER OF 1s' : '03 / COMBINE THE NEW TERMS';
    $('quineInstruction').textContent = q.round === 0 ? 'Select two terms that differ in exactly one bit.' : 'Compare neighboring groups. Combine pairs with one differing bit.';
    $('quineRoundMeta').textContent = `${terms.length} ${terms.length === 1 ? 'term' : 'terms'}`;
    const table = document.createElement('table'); table.className = 'quine-table';
    const thead = document.createElement('thead'), hr = document.createElement('tr');
    ['Group', 'Minterm(s)', ...q.vars, 'Term', 'Round status'].forEach((label) => { const th = document.createElement('th'); th.textContent = label; hr.append(th); });
    thead.append(hr); table.append(thead);
    const body = document.createElement('tbody');
    groups.forEach(([group, rows]) => {
      rows.forEach((term, rowIndex) => {
        const tr = document.createElement('tr');
        if (rowIndex === 0) { const groupCell = document.createElement('th'); groupCell.className = 'quine-group'; groupCell.rowSpan = rows.length; groupCell.textContent = `Group ${group}`; tr.append(groupCell); }
        const minterms = document.createElement('td'); minterms.className = 'quine-minterms'; minterms.textContent = term.covers.join(', '); tr.append(minterms);
        [...term.bits].forEach((bit) => { const td = document.createElement('td'); td.className = `quine-bit${bit === '-' ? ' dash' : ''}`; td.textContent = bit; tr.append(td); });
        const code = document.createElement('td'); code.className = 'quine-code'; code.textContent = term.bits; tr.append(code);
        const status = document.createElement('td');
        if (q.used.has(term.id)) { status.textContent = 'Combined'; status.className = 'status-used'; }
        else if (q.primes.some((p) => p.id === term.id)) { status.textContent = 'Prime implicant'; status.className = 'status-prime'; }
        else status.textContent = 'Not combined';
        tr.append(status);
        const pick = document.createElement('button'); pick.type = 'button'; pick.className = `quine-row-pick${q.selected.includes(term.id) ? ' selected' : ''}`;
        pick.setAttribute('aria-label', `Select ${term.covers.length > 1 ? 'terms ' : 'minterm '}${term.covers.join(', ')}`);
      pick.addEventListener('click', () => { q.selected = q.selected.includes(term.id) ? q.selected.filter((id) => id !== term.id) : [...q.selected.slice(-1), term.id]; const pair = q.selected.map((id) => terms.find((row) => row.id === id)).filter(Boolean); say(pair.length === 0 ? 'Select two terms to combine, or choose an unpaired term to mark as prime.' : pair.length === 1 ? 'Select another term to combine, or mark this term as prime if it has no pair.' : comboPattern(pair[0].bits, pair[1].bits) ? 'These terms differ in one bit. Check your combination.' : 'These terms cannot combine: they need one differing bit and matching dashes.'); renderRound(); });
        tr.querySelector('.quine-minterms').prepend(pick);
        body.append(tr);
      });
      const separator = document.createElement('tr'); separator.className = 'quine-group-end'; const td = document.createElement('td'); td.colSpan = q.vars.length + 4; separator.append(td); body.append(separator);
    });
    table.append(body); $('quineRoundTable').replaceChildren(table);
    const chosen = q.selected.map((id) => terms.find((term) => term.id === id)).filter(Boolean);
    const validPair = chosen.length === 2 && !!comboPattern(chosen[0].bits, chosen[1].bits);
    $('quineCombineButton').disabled = !validPair;
    $('quinePrimeButton').disabled = chosen.length !== 1 || q.used.has(chosen[0]?.id) || q.primes.some((p) => p.id === chosen[0]?.id) || canCombine(chosen[0] || {}, terms);
    const settled = terms.every((term) => q.used.has(term.id) || q.primes.some((p) => p.id === term.id));
    $('quineNextButton').hidden = !settled;
    $('quineUndoButton').hidden = !q.history.some((entry) => entry.round === q.round);
    $('quineCombineButton').title = chosen.length === 2 && !validPair ? 'A pair must differ in exactly one bit and have dashes in the same positions.' : '';
    $('quineStep1').classList.toggle('current', q.round === 0);
    $('quineStep2').classList.toggle('current', q.round > 0);
  };
  const findMinimumCover = () => {
    const candidates = q.primes.map((prime) => ({
      prime,
      literals: [...prime.bits].filter((bit) => bit !== '-').length,
      mask: q.ones.reduce((mask, minterm, index) => prime.covers.includes(minterm) ? mask | (1n << BigInt(index)) : mask, 0n)
    })).filter((candidate) => candidate.mask !== 0n);
    const full = (1n << BigInt(q.ones.length)) - 1n;
    let best = null;
    const greedy = [];
    let greedyMask = 0n;
    while (greedyMask !== full) {
      const next = candidates.filter((candidate) => !greedy.includes(candidate)).sort((a, b) => {
        const aGain = bitCount(a.mask & ~greedyMask), bGain = bitCount(b.mask & ~greedyMask);
        return bGain - aGain || a.literals - b.literals;
      })[0];
      if (!next || (next.mask & ~greedyMask) === 0n) break;
      greedy.push(next); greedyMask |= next.mask;
    }
    if (greedyMask === full) best = { candidates: greedy, literals: greedy.reduce((sum, item) => sum + item.literals, 0) };
    const memo = new Map();
    const search = (covered, picked, literals) => {
      if (covered === full) {
        if (!best || picked.length < best.candidates.length || (picked.length === best.candidates.length && literals < best.literals)) best = { candidates: [...picked], literals };
        return;
      }
      if (best && picked.length >= best.candidates.length) return;
      const previous = memo.get(covered);
      if (previous && (previous.count < picked.length || (previous.count === picked.length && previous.literals <= literals))) return;
      memo.set(covered, { count: picked.length, literals });
      const missing = full & ~covered;
      let fewest = null;
      for (let i = 0; i < q.ones.length; i++) {
        const bit = 1n << BigInt(i);
        if ((missing & bit) === 0n) continue;
        const options = candidates.filter((candidate) => (candidate.mask & bit) !== 0n && (candidate.mask & missing) !== 0n);
        if (fewest === null || options.length < fewest.length) fewest = options;
        if (fewest?.length === 1) break;
      }
      if (!fewest?.length) return;
      fewest.sort((a, b) => bitCount(b.mask & missing) - bitCount(a.mask & missing) || a.literals - b.literals);
      for (const candidate of fewest) search(covered | candidate.mask, [...picked, candidate], literals + candidate.literals);
    };
    search(0n, [], 0);
    return best ? { ids: new Set(best.candidates.map((candidate) => candidate.prime.id)), literals: best.literals } : { ids: new Set(), literals: 0 };
  };
  const bitCount = (value) => { let count = 0; while (value) { value &= value - 1n; count++; } return count; };
  const renderCover = () => {
    const primes = q.primes;
    const selected = primes.filter((prime) => q.chosen.has(prime.id));
    const selectedCovered = new Set(selected.flatMap((prime) => prime.covers).filter((minterm) => q.ones.includes(minterm)));
    const minimumCovered = new Set(primes.filter((prime) => q.optimal?.ids.has(prime.id)).flatMap((prime) => prime.covers).filter((minterm) => q.ones.includes(minterm)));
    const isComplete = q.ones.every((minterm) => selectedCovered.has(minterm));
    const selectedLiterals = selected.reduce((sum, prime) => sum + [...prime.bits].filter((bit) => bit !== '-').length, 0);
    const isOptimal = isComplete && q.chosen.size === q.optimal?.ids.size && selectedLiterals === q.optimal?.literals;
    const table = document.createElement('table'); table.className = 'quine-table quine-cover-table';
    const head = document.createElement('thead'), hr = document.createElement('tr');
    ['Prime implicant', 'Binary', ...q.ones.map((n) => String(n))].forEach((label, index) => { const th = document.createElement('th'); th.textContent = label; if (index > 1) { const minterm = q.ones[index - 2]; if (selectedCovered.has(minterm)) th.classList.add('cover-column-selected'); if (q.revealOptimal && minimumCovered.has(minterm)) th.classList.add('cover-column-optimal'); } hr.append(th); });
    head.append(hr); table.append(head);
    const body = document.createElement('tbody');
    primes.forEach((prime) => {
      const inMinimum = q.optimal?.ids.has(prime.id);
      const tr = document.createElement('tr'); tr.className = [q.chosen.has(prime.id) ? 'chosen' : '', q.revealOptimal && inMinimum ? 'minimum-row' : ''].filter(Boolean).join(' ');
      const name = document.createElement('td'); const button = document.createElement('button'); button.type = 'button'; button.className = 'cover-pick'; button.setAttribute('aria-pressed', String(q.chosen.has(prime.id))); button.textContent = termName(prime.bits); button.addEventListener('click', () => { q.chosen.has(prime.id) ? q.chosen.delete(prime.id) : q.chosen.add(prime.id); renderCover(); }); name.append(button); if (q.revealOptimal && inMinimum) { const badge = document.createElement('span'); badge.className = 'minimum-badge'; badge.textContent = 'Minimum'; name.append(badge); } tr.append(name);
      const binary = document.createElement('td'); binary.className = 'quine-code'; binary.textContent = prime.bits; tr.append(binary);
      q.ones.forEach((n) => { const td = document.createElement('td'); td.className = [prime.covers.includes(n) ? 'cover-hit' : 'cover-miss', selectedCovered.has(n) ? 'cover-column-selected' : '', q.revealOptimal && inMinimum && prime.covers.includes(n) ? 'cover-column-optimal' : ''].filter(Boolean).join(' '); td.textContent = prime.covers.includes(n) ? '●' : '·'; td.setAttribute('aria-label', prime.covers.includes(n) ? `covers minterm ${n}` : `does not cover minterm ${n}`); tr.append(td); });
      body.append(tr);
    });
    table.append(body); $('quineCoverTable').replaceChildren(table);
    $('quineCoverMeta').textContent = `${primes.length} ${primes.length === 1 ? 'prime implicant' : 'prime implicants'}`;
    $('quineCoverProgress').textContent = `Covered: ${selectedCovered.size} / ${q.ones.length} minterms`;
    $('quineSelectedLegend').hidden = !q.chosen.size;
    $('quineOptimalLegend').hidden = !q.revealOptimal;
    const optimalButton = $('quineRevealOptimalButton');
    optimalButton.textContent = isOptimal ? 'No need' : q.revealOptimal ? 'Hide minimum cover' : 'Show most efficient cover';
    optimalButton.disabled = isOptimal;
    optimalButton.title = isOptimal ? 'Your cover already uses the fewest implicants and literals.' : '';
    $('quineOptimalSummary').hidden = !q.revealOptimal;
    $('quineOptimalSummary').textContent = q.revealOptimal ? `One minimum cover uses ${q.optimal.ids.size} prime implicant${q.optimal.ids.size === 1 ? '' : 's'} and ${q.optimal.literals} literal${q.optimal.literals === 1 ? '' : 's'}. Your selection is unchanged.` : '';
    $('quineStep3').classList.add('current');
  };
  const startCover = () => {
    $('quineRoundPanel').hidden = true; $('quineCoverPanel').hidden = false;
    q.chosen.clear(); q.optimal = findMinimumCover(); q.revealOptimal = false; $('quineResult').hidden = true; $('quineCoverMessage').textContent = 'Choose rows to cover every minterm.';
    renderCover(); $('quineCoverPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const finishRound = () => {
    const current = q.rounds[q.round];
    current.forEach((term) => { if (!q.used.has(term.id) && !q.primes.some((p) => p.id === term.id)) q.primes.push(term); });
    const combined = q.history.filter((entry) => entry.round === q.round).map((entry) => entry.term);
    const unique = new Map(); combined.forEach((term) => { if (!unique.has(term.bits)) unique.set(term.bits, makeTerm(term.bits, term.covers)); else unique.get(term.bits).covers = [...new Set([...unique.get(term.bits).covers, ...term.covers])].sort((a, b) => a - b); });
    if (!unique.size) { startCover(); return; }
    q.round++; q.rounds[q.round] = [...unique.values()]; q.used = new Set(); q.selected = []; $('quineNextButton').hidden = true; say('Round complete. Now group the combined terms by their number of 1s.', true); renderRound();
    $('quineRoundPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const build = () => {
    try {
      const vars = $('quineVariables').value.split(/[\s,]+/).filter(Boolean);
      if (vars.length < 2 || vars.length > 6) throw new Error('Use 2 to 6 variables for the study table.');
      if (vars.some((v) => !/^[A-Za-z][A-Za-z0-9_]*$/.test(v)) || new Set(vars.map((v) => v.toLowerCase())).size !== vars.length) throw new Error('Use distinct variable names, such as a, b, c, d.');
      q.vars = vars; const max = 2 ** vars.length; const ones = parse($('quineMinterms').value, max), dcs = parse($('quineDontcares').value, max);
      if (!ones.length) throw new Error('Add at least one minterm where F = 1.');
      if (ones.some((n) => dcs.includes(n))) throw new Error('A minterm cannot also be a don’t-care.');
      q.ones = ones; q.dcs = dcs; q.round = 0; q.rounds = [[]]; q.used = new Set(); q.primes = []; q.selected = []; q.chosen = new Set(); q.history = []; q.optimal = null; q.revealOptimal = false; nextId = 0;
      [...ones, ...dcs].sort((a, b) => a - b).forEach((n) => q.rounds[0].push(makeTerm(termBits(n), [n])));
      $('quineSetupMessage').className = 'input-message'; $('quineSetupMessage').textContent = `${vars.length} variables · ${max} possible minterms · ${ones.length} minterms${dcs.length ? ` · ${dcs.length} don’t-care${dcs.length === 1 ? '' : 's'}` : ''}`;
      $('quineRoundPanel').hidden = false; $('quineCoverPanel').hidden = true; $('quineStep1').classList.add('current'); $('quineStep2').classList.remove('current'); $('quineStep3').classList.remove('current'); say('Select a term to combine with a matching row, or mark an unpaired term as prime.'); renderRound();
    } catch (error) { $('quineSetupMessage').className = 'input-message error'; $('quineSetupMessage').textContent = error.message; }
  };
  $('quineBuildButton').addEventListener('click', build);
  $('quineCombineButton').addEventListener('click', () => {
    const terms = q.rounds[q.round], [a, b] = q.selected.map((id) => terms.find((term) => term.id === id)); if (!a || !b) return;
    const bits = comboPattern(a.bits, b.bits); if (!bits) { say('These terms must differ in exactly one bit, with dashes in the same places.'); return; }
    const covers = [...new Set([...a.covers, ...b.covers])].sort((x, y) => x - y);
    const parentIds = [a.id, b.id].sort((x, y) => x - y);
    const samePair = q.history.some((entry) => entry.round === q.round && entry.parents.slice().sort((x, y) => x - y).every((id, index) => id === parentIds[index]));
    if (samePair) { say('You already combined these two terms. Their rows are marked Combined.'); return; }
    const duplicate = q.history.some((entry) => entry.round === q.round && entry.term.bits === bits);
    q.used.add(a.id); q.used.add(b.id); const term = { bits, covers }; q.history.push({ round: q.round, term, parents: [a.id, b.id] }); q.selected = [];
    say(duplicate ? `These terms also combine to ${bits}, which is already listed. Both rows are marked Combined.` : `${a.bits} + ${b.bits} → ${bits}. The differing bit becomes a dash.`, true); renderRound();
  });
  $('quinePrimeButton').addEventListener('click', () => { const term = q.rounds[q.round].find((row) => row.id === q.selected[0]); if (!term || canCombine(term, q.rounds[q.round])) return; q.primes.push(term); q.selected = []; say(`${term.bits} has no pair in this round. Marked as a prime implicant.`, true); renderRound(); });
  $('quineNextButton').addEventListener('click', finishRound);
  $('quineUndoButton').addEventListener('click', () => { const index = q.history.findLastIndex((entry) => entry.round === q.round); if (index < 0) return; q.history.splice(index, 1); q.used = new Set(); q.history.filter((h) => h.round === q.round).forEach((h) => h.parents.forEach((id) => q.used.add(id))); q.selected = []; say('Last combination removed.'); renderRound(); });
  $('quineRevealOptimalButton').addEventListener('click', () => {
    const covered = new Set(q.primes.filter((prime) => q.chosen.has(prime.id)).flatMap((prime) => prime.covers).filter((minterm) => q.ones.includes(minterm)));
    const complete = q.ones.every((minterm) => covered.has(minterm));
    const literals = q.primes.filter((prime) => q.chosen.has(prime.id)).reduce((sum, prime) => sum + [...prime.bits].filter((bit) => bit !== '-').length, 0);
    if (complete && q.chosen.size === q.optimal.ids.size && literals === q.optimal.literals) return;
    q.revealOptimal = !q.revealOptimal;
    $('quineCoverMessage').className = 'input-message quine-good';
    $('quineCoverMessage').textContent = q.revealOptimal ? 'Minimum cover highlighted. Your selection is unchanged.' : 'Minimum cover hidden. Continue comparing your selection.';
    renderCover();
  });
  $('quineCheckCoverButton').addEventListener('click', () => {
    const covered = new Set(q.primes.filter((p) => q.chosen.has(p.id)).flatMap((p) => p.covers).filter((n) => q.ones.includes(n)));
    const missing = q.ones.filter((n) => !covered.has(n)); const result = $('quineResult'); result.hidden = false;
    if (missing.length) { $('quineCoverMessage').className = 'input-message error'; $('quineCoverMessage').textContent = `Still uncovered: ${missing.join(', ')}. Add a prime implicant that covers each one.`; result.textContent = 'Keep going: every minterm needs to be covered at least once.'; result.className = 'quine-result'; return; }
    const expression = [...q.primes].filter((p) => q.chosen.has(p.id)).map((p) => termName(p.bits)).join(' + ');
    const literals = q.primes.filter((prime) => q.chosen.has(prime.id)).reduce((sum, prime) => sum + [...prime.bits].filter((bit) => bit !== '-').length, 0);
    const optimal = q.chosen.size === q.optimal.ids.size && literals === q.optimal.literals;
    $('quineCoverMessage').className = 'input-message quine-good'; $('quineCoverMessage').textContent = optimal ? 'Your cover is already most efficient.' : 'All minterms are covered. Compare with a minimum cover if you want to reduce it.';
    result.className = 'quine-result complete'; result.replaceChildren(); const label = document.createElement('span'); label.className = 'tiny-label'; label.textContent = 'YOUR COVER'; const output = document.createElement('strong'); output.textContent = `F = ${expression}`; const note = document.createElement('p'); note.textContent = optimal ? `Minimum cover: ${q.chosen.size} prime implicant${q.chosen.size === 1 ? '' : 's'} and ${literals} literal${literals === 1 ? '' : 's'}.` : `${q.chosen.size} prime implicants and ${literals} literals. A minimum uses ${q.optimal.ids.size} implicant${q.optimal.ids.size === 1 ? '' : 's'} and ${q.optimal.literals} literal${q.optimal.literals === 1 ? '' : 's'}.`; result.append(label, output, note); renderCover();
  });
  $('quineResetButton').addEventListener('click', build);
  $('quineExampleButton').addEventListener('click', () => { $('quineVariables').value = 'a, b, c, d, e'; $('quineMinterms').value = '1, 3, 7, 9, 14, 15, 19, 20, 21, 25, 26, 27, 28, 29'; $('quineDontcares').value = '0, 11, 30, 31'; build(); });
  ['quineVariables', 'quineMinterms', 'quineDontcares'].forEach((id) => $(id).addEventListener('keydown', (event) => { if (event.key === 'Enter') build(); }));
  build();
})();
