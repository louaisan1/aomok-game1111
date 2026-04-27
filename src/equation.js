// Token generator that guarantees a subset evaluating to 7.
//
// Each of the 10 doors hosts one token. A token is either a digit string ("1".."9")
// or an operator ("+", "-", "*", "/"). The 10 tokens are shuffled across doors,
// but at least one ordered subset of them evaluates to exactly 7.

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const OPS = ['+', '-', '*', '/'];

function randInt(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr[randInt(arr.length)]; }

// Build a random simple expression that evaluates to 7. Returns array of tokens.
function buildSolutionTokens() {
  // Choose between several patterns of varying length.
  const pattern = randInt(4);
  let tokens;
  switch (pattern) {
    case 0: {
      // a + b = 7 (a in 1..6, b = 7 - a)
      const a = 1 + randInt(6);
      tokens = [String(a), '+', String(7 - a)];
      break;
    }
    case 1: {
      // a - b = 7 (a in 8..9, b = a - 7)
      const a = 8 + randInt(2);
      tokens = [String(a), '-', String(a - 7)];
      break;
    }
    case 2: {
      // a + b - c = 7
      const a = 2 + randInt(6); // 2..7
      const c = 1 + randInt(3); // 1..3
      const b = 7 - a + c;       // ensure 1..9
      if (b >= 1 && b <= 9) {
        tokens = [String(a), '+', String(b), '-', String(c)];
      } else {
        tokens = ['3', '+', '4'];
      }
      break;
    }
    case 3:
    default: {
      // a * b - c = 7 with small numbers
      // try a*b in {8,9,10,12,14,16}
      const candidates = [
        [2, 4, 1], [3, 3, 2], [2, 5, 3], [3, 4, 5], [4, 2, 1], [5, 2, 3], [3, 3, 2]
      ];
      const c = candidates[randInt(candidates.length)];
      tokens = [String(c[0]), '*', String(c[1]), '-', String(c[2])];
      break;
    }
  }
  return tokens;
}

// Safe evaluator for tokens like [num, op, num, op, ...]. No `eval`.
export function evaluateTokens(tokens) {
  if (!tokens || tokens.length === 0) return null;
  // Validate alternation: digit, op, digit, op, ..., digit
  if (tokens.length % 2 === 0) return null;
  const nums = [];
  const ops = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (i % 2 === 0) {
      if (!/^\d+$/.test(t)) return null;
      nums.push(Number(t));
    } else {
      if (!OPS.includes(t)) return null;
      ops.push(t);
    }
  }
  // First pass: * and /
  let i = 0;
  while (i < ops.length) {
    if (ops[i] === '*' || ops[i] === '/') {
      const a = nums[i], b = nums[i + 1];
      let r;
      if (ops[i] === '*') r = a * b;
      else {
        if (b === 0) return null;
        r = a / b;
      }
      nums.splice(i, 2, r);
      ops.splice(i, 1);
    } else {
      i++;
    }
  }
  // Second pass: + and -
  let acc = nums[0];
  for (let j = 0; j < ops.length; j++) {
    if (ops[j] === '+') acc += nums[j + 1];
    else if (ops[j] === '-') acc -= nums[j + 1];
  }
  return acc;
}

export function generateTokens() {
  const solution = buildSolutionTokens();
  // Verify
  const v = evaluateTokens(solution);
  if (Math.abs(v - 7) > 1e-9) {
    // Fallback safe solution
    return shuffleAndPad(['3', '+', '4']);
  }
  return shuffleAndPad(solution);
}

function shuffleAndPad(solutionTokens) {
  // Place solution tokens (in order? no — we just need them to exist among the 10).
  // We allow any subset/ordering at solve time, so just include them.
  const pool = [...solutionTokens];
  while (pool.length < 10) {
    // Roughly 60% digits, 40% operators
    if (Math.random() < 0.6) pool.push(pick(DIGITS));
    else pool.push(pick(OPS));
  }
  // Shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 10);
}

export const TOKEN_OPS = OPS;
