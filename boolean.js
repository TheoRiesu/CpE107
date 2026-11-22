(() => {
  const $ = (id) => document.getElementById(id);
  const vars = ['A', 'B', 'C'];
  const names = new Map(vars.map((name, index) => [name.toLowerCase(), index]));
  let problem = null;

  function tokenize(text) {
    const tokens = [];
    let i = 0;
    while (i < text.length) {
      if (/\s/.test(text[i])) { i++; continue; }
      const rest = text.slice(i);
      const name = rest.match(/^[A-Za-z][A-Za-z0-9_]*/);
      if (name) { tokens.push({ type: 'name', value: name[0] }); i += name[0].length; continue; }
      if (text[i] === '0' || text[i] === '1') { tokens.push({ type: 'constant', value: Number(text[i]) }); i++; continue; }
      const symbols = { '+': 'or', '|': 'or', '·': 'and', '.': 'and', '*': 'and', '&': 'and', '(': 'left', ')': 'right', "'": 'not', '!': 'prefixNot', '~': 'prefixNot' };
      if (symbols[text[i]]) { tokens.push({ type: symbols[text[i]] }); i++; continue; }
      throw new Error(`I can’t read “${text[i]}”. Use variables, +, ·, parentheses, and '.`);
    }
    return tokens;
  }

  function parse(text) {
    const tokens = tokenize(text);
    let at = 0;
    const startsTerm = (token) => token && ['name', 'constant', 'left', 'prefixNot'].includes(token.type);
    function orExpression() {
      let left = andExpression();
      while (tokens[at]?.type === 'or') { at++; left = { type: 'or', left, right: andExpression() }; }
      return left;
    }
    function andExpression() {
      let left = unaryExpression();
      while (tokens[at]?.type === 'and' || startsTerm(tokens[at])) {
        if (tokens[at]?.type === 'and') at++;
        left = { type: 'and', left, right: unaryExpression() };
      }
      return left;
    }
    function unaryExpression() {
      if (tokens[at]?.type === 'prefixNot') { at++; return { type: 'not', value: unaryExpression() }; }
      let node;
      const token = tokens[at++];
      if (!token) throw new Error('The expression ends too early. Add a variable or closing parenthesis.');
      if (token.type === 'name') {
        const index = names.get(token.value.toLowerCase());
        if (index === undefined) throw new Error(`Use only the variables ${vars.join(', ')}.`);
        node = { type: 'variable', index };
      } else if (token.type === 'constant') node = { type: 'constant', value: token.value };
      else if (token.type === 'left') {
        node = orExpression();
        if (tokens[at]?.type !== 'right') throw new Error('Add a closing parenthesis.');
        at++;
      } else throw new Error('Add a variable or an opening parenthesis.');
      while (tokens[at]?.type === 'not') { at++; node = { type: 'not', value: node }; }
      return node;
    }
    if (!tokens.length) throw new Error('Enter an expression first.');
    const tree = orExpression();
    if (at !== tokens.length) throw new Error('Check the operator or parentheses in your expression.');
    return tree;
  }

  function evaluate(node, bits) {
    if (node.type === 'constant') return Boolean(node.value);
    if (node.type === 'variable') return Boolean(bits[node.index]);
    if (node.type === 'not') return !evaluate(node.value, bits);
    if (node.type === 'and') return evaluate(node.left, bits) && evaluate(node.right, bits);
    return evaluate(node.left, bits) || evaluate(node.right, bits);
  }

  function mergeCubes(left, right) {
    const result = [...left];
    for (let i = 0; i < result.length; i++) {
      if (right[i] === -1) continue;
      if (result[i] !== -1 && result[i] !== right[i]) return null;
      result[i] = right[i];
    }
    return result;
  }

  function dnf(node, negated = false) {
    if (node.type === 'constant') return Boolean(node.value) !== negated ? [[[-1, -1, -1]]] : [];
    if (node.type === 'variable') {
      const cube = [-1, -1, -1]; cube[node.index] = negated ? 0 : 1; return [[cube]];
    }
    if (node.type === 'not') return dnf(node.value, !negated);
    const isOr = (node.type === 'or') !== negated;
    const left = dnf(node.left, negated), right = dnf(node.right, negated);
    if (isOr) return [...left, ...right];
    const product = [];
    left.forEach((a) => right.forEach((b) => { const cube = mergeCubes(a[0], b[0]); if (cube) product.push([cube]); }));
    return product;
  }

  function expressionCost(tree) {
    const terms = dnf(tree).map((entry) => entry[0]);
    const distinct = new Map(terms.map((term) => [term.join(''), term]));
    const cubes = [...distinct.values()];
    return { terms: cubes.length, literals: cubes.reduce((total, cube) => total + cube.filter((value) => value !== -1).length, 0) };
  }

  function minimumCover(ones) {
    if (!ones.length) return [];
    const candidates = [];
    function enumerate(prefix) {
      if (prefix.length === vars.length) {
        const covers = Array.from({ length: 8 }, (_, value) => value).filter((value) => [...prefix].every((bit, index) => bit === -1 || bit === ((value >> (2 - index)) & 1)));
        if (covers.length && covers.every((value) => ones.includes(value))) candidates.push({ cube: prefix, covers, literals: prefix.filter((value) => value !== -1).length });
        return;
      }
      [-1, 0, 1].forEach((value) => enumerate([...prefix, value]));
    }
    enumerate([]);
    let best = null;
    const coversFor = new Map(ones.map((value) => [value, candidates.filter((candidate) => candidate.covers.includes(value))]));
    function search(covered, chosen) {
      if (covered.size === ones.length) {
        const score = [chosen.length, chosen.reduce((sum, item) => sum + item.literals, 0)];
        if (!best || score[0] < best.score[0] || (score[0] === best.score[0] && score[1] < best.score[1])) best = { score, chosen: [...chosen] };
        return;
      }
      if (best && chosen.length >= best.score[0]) return;
      const target = ones.filter((value) => !covered.has(value)).map((value) => coversFor.get(value)).sort((a, b) => a.length - b.length)[0] || [];
      target.forEach((candidate) => {
        const next = new Set(covered); candidate.covers.forEach((value) => next.add(value)); search(next, [...chosen, candidate]);
      });
    }
    search(new Set(), []);
    return best?.chosen || [];
  }

  function cubeText(cube) {
    const literals = cube.map((bit, index) => bit === -1 ? '' : bit ? vars[index] : `${vars[index]}'`).filter(Boolean);
    return literals.join('') || '1';
  }
  const costText = (cost) => `${cost.terms} product term${cost.terms === 1 ? '' : 's'} and ${cost.literals} literal${cost.literals === 1 ? '' : 's'}`;

  function nextProblem() {
    let ones, optimum, sourceCost;
    for (let attempt = 0; attempt < 80; attempt++) {
      const size = 3 + Math.floor(Math.random() * 4);
      ones = [...Array(8).keys()].sort(() => Math.random() - 0.5).slice(0, size).sort((a, b) => a - b);
      optimum = minimumCover(ones);
      sourceCost = { terms: ones.length, literals: ones.length * vars.length };
      if (sourceCost.terms > optimum.length || (sourceCost.terms === optimum.length && sourceCost.literals > optimum.reduce((sum, item) => sum + item.literals, 0))) break;
    }
    problem = { ones, optimum, sourceCost };
    $('booleanPrompt').textContent = ones.map((value) => cubeText([...value.toString(2).padStart(3, '0')].map(Number))).join(' + ');
    $('booleanAnswer').value = '';
    $('booleanFeedback').className = 'input-message';
    $('booleanFeedback').textContent = 'Simplify the expression, then check your answer.';
    $('booleanResult').hidden = true;
    $('booleanAnswer').focus();
  }

  function checkAnswer() {
    if (!problem) return;
    try {
      const tree = parse($('booleanAnswer').value);
      const mismatches = [];
      for (let value = 0; value < 8; value++) {
        const bits = [...value.toString(2).padStart(3, '0')].map(Number);
        const expected = problem.ones.includes(value);
        const actual = evaluate(tree, bits);
        if (expected !== actual) mismatches.push({ bits, expected, actual });
      }
      const feedback = $('booleanFeedback'), result = $('booleanResult');
      result.hidden = false;
      if (mismatches.length) {
        const example = mismatches[0];
        feedback.className = 'input-message error';
        feedback.textContent = 'Not equivalent yet. Check the example below.';
        result.className = 'boolean-result is-hint';
        result.textContent = `For ${vars.map((name, index) => `${name}=${example.bits[index]}`).join(', ')}, the given expression is ${Number(example.expected)} but your answer is ${Number(example.actual)}.`;
        return;
      }
      const enteredCost = expressionCost(tree);
      const bestCost = { terms: problem.optimum.length, literals: problem.optimum.reduce((sum, item) => sum + item.literals, 0) };
      const optimal = enteredCost.terms === bestCost.terms && enteredCost.literals === bestCost.literals;
      feedback.className = `input-message ${optimal ? 'boolean-good' : 'error'}`;
      feedback.textContent = optimal ? 'Equivalent and most efficient — nice work.' : 'Equivalent, but it can be simplified more.';
      result.className = `boolean-result${optimal ? ' is-good' : ' is-hint'}`;
      result.textContent = optimal ? `Minimum: ${costText(bestCost)}.` : `Your answer uses ${costText(enteredCost)}. A minimum SOP is ${problem.optimum.map((item) => cubeText(item.cube)).join(' + ')} (${costText(bestCost)}).`;
    } catch (error) {
      $('booleanFeedback').className = 'input-message error';
      $('booleanFeedback').textContent = error.message;
      $('booleanResult').hidden = true;
    }
  }

  $('newBooleanProblem').addEventListener('click', nextProblem);
  $('checkBooleanAnswer').addEventListener('click', checkAnswer);
  $('booleanAnswer').addEventListener('keydown', (event) => { if (event.key === 'Enter') checkAnswer(); });
  nextProblem();
})();
