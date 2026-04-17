const fs = require('fs');
const path = require('path');
function removeRanges(file, ranges) {
  const p = path.resolve(file);
  let lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  ranges.sort((a, b) => b.start - a.start).forEach(range => {
    lines.splice(range.start - 1, range.end - range.start + 1);
  });
  fs.writeFileSync(p, lines.join('\n'), 'utf8');
}

removeRanges('routes/auth-fixed.js', [
  { start: 8, end: 8 },
  { start: 46, end: 49 },
  { start: 453, end: 453 },
  { start: 490, end: 490 },
  { start: 493, end: 581 }
]);
console.log('auth-fixed.js patched');

removeRanges('routes/auth.js', [
  { start: 8, end: 8 },
  { start: 49, end: 52 },
  { start: 306, end: 310 },
  { start: 403, end: 425 },
  { start: 493, end: 545 }
]);
console.log('auth.js patched');
