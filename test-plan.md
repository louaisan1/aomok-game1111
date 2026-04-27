# Test Plan — aomok-game

**What changed**: New 3D web escape-room game built from scratch with Three.js + Firebase. Player registers → enters a room with 10 colored doors and matching keys → solves an equation = 7 from door tokens.

**Primary flow tested**: Registration → walk in 3D room → pick up keys → open doors → use opened tokens to build a `= 7` equation → submit and verify "win" result.

**Key assertions**:
1. Registration overlay accepts name + room number, then disappears.
2. 3D room renders: walls, floor, ceiling, ≥5 colored doors, ≥5 colored keys, central trapdoor with cyan glow, visible player body parts (legs/arms).
3. Pointer-lock activates on canvas click; WASD moves the camera.
4. Walking onto a colored key shows pickup prompt and adds it to the inventory chip row (chip becomes vivid, not dim).
5. Looking at a door without a matching key shows "تحتاج مفتاح ..." prompt; with a matching key shows "اضغط E لفتح…".
6. Pressing E opens the door (panel rotates ~100°), reveals its token (digit or operator), and adds a colored chip to the equation bar.
7. Clicking opened-door chips appends them to the expression; live evaluation result updates; submit button enables when expression is parseable.
8. Submitting an expression equal to 7 → "فزت!" overlay with the equation displayed; a non-7 submission shows "المعادلة لا تساوي 7" prompt and does NOT end the game.
9. Descending the trapdoor (E on it) starts the 5-minute timer (`05:00` countdown visible top-right) and switches to the underwater room with the floating "= 7" card and bubbles.
10. The equation generator guarantees a valid =7 subset exists among the 10 tokens (verified via console: tokens array can produce 7).

**Adversarial check**: Would these steps look identical if broken? No — a broken equation generator would not yield 7; a broken pointer lock would prevent movement; a broken door would never reveal a token chip. Each assertion has a specific UI signal.

**Out of scope / not tested**: 5-minute timeout (would require waiting 5 minutes); Firebase data verification (no read access to the DB rules).
