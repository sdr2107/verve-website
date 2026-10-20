# verve-app.health — working rules for Claude

The site's memory (the My health architecture, the 31 science anchors, the
reviewer rule: sign in only on localhost) lives in Claude's memory directory
and is loaded each session. This file holds the one rule that is not a fact
about the code.

## Before a new page, a new read, or anything that touches a figure

Ask for the deeper version of the task, not the bigger one. Before writing
code, state in a few lines:

1. what a top professional in this field would do here that was not asked
   for;
2. the rawest material to start from — the document, the lab file, the
   paper — rather than a number already digested for us;
3. the specific methods and tools: which module in src/my-health, which
   derive function, which test, which ruler mark;
4. what, other than Claude or the founder, will show the result is right:
   `npm run check`, `npm test`, the ruler, the live page.

Then do exactly that. Not for a copy fix or a one-line change: the rule is
for work that could ship a wrong number.

(Founder's prompt, kept 2026-10-20.)
