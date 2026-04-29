// Token grammar:
//   digit:  '0'..'9'
//   ops:    '-', '*', '/', '^', '√'   (NO '+', no parens)
// Precedence (lowest → highest): -   |   * /   |   ^ (right-assoc)   |   √ (prefix-unary)

const DIGITS = ['0','1','2','3','4','5','6','7','8','9'];
const OPS = ['-', '*', '/', '^', '√'];

function isDigit(t) { return /^\d$/.test(t); }
function isUnary(t) { return t === '√'; }

// Recursive-descent evaluator. Returns number or null on parse error.
export function evaluateTokens(tokens) {
  if (!tokens || tokens.length === 0) return null;
  let i = 0;

  function peek() { return tokens[i]; }
  function eat() { return tokens[i++]; }

  function primary() {
    const t = peek();
    if (t === undefined) return null;
    if (isUnary(t)) {
      eat();
      const v = primary();
      if (v === null || v < 0) return null;
      return Math.sqrt(v);
    }
    if (isDigit(t)) {
      eat();
      return Number(t);
    }
    return null;
  }

  function power() {
    const left = primary();
    if (left === null) return null;
    if (peek() === '^') {
      eat();
      const right = power();
      if (right === null) return null;
      return Math.pow(left, right);
    }
    return left;
  }

  function muldiv() {
    let left = power();
    if (left === null) return null;
    while (peek() === '*' || peek() === '/') {
      const op = eat();
      const right = power();
      if (right === null) return null;
      if (op === '*') left = left * right;
      else {
        if (right === 0) return null;
        left = left / right;
      }
    }
    return left;
  }

  function expr() {
    let left = muldiv();
    if (left === null) return null;
    while (peek() === '-') {
      eat();
      const right = muldiv();
      if (right === null) return null;
      left = left - right;
    }
    return left;
  }

  const v = expr();
  if (v === null || i !== tokens.length) return null;
  return v;
}

// Pretty printer (for HUD/Firebase)
export function prettyEquation(tokens) {
  return tokens.map(t => {
    if (t === '*') return '×';
    if (t === '/') return '÷';
    return t;
  }).join(' ');
}

// ---- 10-token puzzle generator ----
// Each template uses EXACTLY 10 tokens and evaluates to 7.
// The player's win condition: open all 10 doors in an order whose token-sequence = 7.
// We assign template tokens to door positions via a random permutation; the player
// must discover the right order by trying.
const SOLUTION_TEMPLATES_10 = [
  ['√','4','^','3','-','1','*','1','*','1'],     // (√4)^3 - 1*1*1 = 8 - 1 = 7
  ['9','-','√','4','*','1','*','1','*','1'],     // 9 - √4 * 1*1*1 = 9 - 2 = 7
  ['9','*','1','-','√','4','*','1','*','1'],     // 9*1 - √4*1*1 = 9 - 2 = 7
  ['5','*','2','-','√','9','^','1','^','1'],     // 5*2 - √9^(1^1) = 10 - 3 = 7
  ['√','9','*','5','-','8','^','1','/','1'],     // 3*5 - 8^1/1 = 15 - 8 = 7
  ['√','4','*','4','-','1','*','1','*','1'],     // 2*4 - 1 = 7
  ['√','9','^','2','-','1','-','1','*','1'],     // (√9)^2 - 1 - 1*1 = 9 - 1 - 1 = 7
  ['3','^','2','-','1','-','1','*','1','*','1'], // 9 - 1 - 1*1*1 = 9 - 1 - 1 = 7
  ['8','/','1','-','√','1','*','1','*','1'],     // 8/1 - 1 = 7
  ['9','/','1','-','√','4','*','1','*','1'],     // 9/1 - 2*1*1 = 7
  ['√','4','^','3','-','√','1','/','1','*','1'], // 11 tokens - skip
];

function randInt(n) { return Math.floor(Math.random() * n); }

// Validate at module-load: every template must be 10 tokens & = 7.
const VALID_TEMPLATES = SOLUTION_TEMPLATES_10.filter((t) => {
  if (t.length !== 10) return false;
  const v = evaluateTokens(t);
  return v !== null && Math.abs(v - 7) < 1e-9;
});

if (VALID_TEMPLATES.length === 0) {
  throw new Error('No valid 10-token templates found');
}

export function generatePuzzle() {
  const tpl = VALID_TEMPLATES[randInt(VALID_TEMPLATES.length)];
  // π: door index → template position. doorTokens[i] = tpl[π(i)].
  // The intended solution = open doors in order π⁻¹(0), π⁻¹(1), ..., π⁻¹(9).
  const order = Array.from({ length: 10 }, (_, i) => i);
  // Fisher-Yates shuffle
  for (let i = 9; i > 0; i--) {
    const j = randInt(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  // order[i] = π(i) = template position for door i
  const doorTokens = order.map((pos) => tpl[pos]);
  // solutionDoorOrder = list of door indices, opened in this order, to win
  const solutionDoorOrder = new Array(10);
  for (let doorIdx = 0; doorIdx < 10; doorIdx++) {
    solutionDoorOrder[order[doorIdx]] = doorIdx;
  }
  // Verify: opening doors in solutionDoorOrder yields tpl
  const reproduced = solutionDoorOrder.map((di) => doorTokens[di]);
  if (JSON.stringify(reproduced) !== JSON.stringify(tpl)) {
    throw new Error('Puzzle inversion mismatch');
  }
  return {
    doorTokens,
    solutionTokens: tpl,
    solutionDoorOrder // door indices to open, in order
  };
}

export const TOKEN_OPS = OPS;
export const TOKEN_DIGITS = DIGITS;
