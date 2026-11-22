// solve.js — a fast drop-in for csv-reader 1.0.0 (make.fun's own reference
// program of csv-reader-speed-01). run(input) returns, for {text, header},
// exactly csv-reader 1.0.0's answer {columns, rows, errors}.
//
// The reference reads one character at a time and builds every field a
// character at a time. This reader keeps the reference's policy byte for
// byte — BOM drop, blank lines are no records, stray CRs dropped with an
// error, quoted fields with "" escapes and CR/LF read as LF, junk after a
// closing quote, a quote that never closes read again as unquoted, short
// and long rows padded or cut to the first record's width — but it cuts
// fields out with indexOf/slice instead of building them character by
// character. The slow character loop runs only for fields that actually
// need it: doubled quotes, line breaks inside quotes, stray CRs, junk
// after a closing quote, and a quote that never closes.
//
// Pure: no clock, no randomness, no locale, nothing kept from one call to
// the next. Dependency-free ES module.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it
  // takes (null: the header). Errors report these, never the live line.
  let recordLine = 1;
  let recordRow = null;

  // Drops every CR in `seg`, reporting one stray_cr each, in order.
  function dropCRs(seg) {
    let v = '';
    let from = 0;
    for (let i = 0; i < seg.length; i++) {
      if (seg.charCodeAt(i) === 13) {
        v += seg.slice(from, i);
        from = i + 1;
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      }
    }
    return v + seg.slice(from);
  }

  // Reads an unquoted field starting at `start`, onto `prefix` ('' normally,
  // '"' after a quote that never closes, the quoted value before junk).
  // Returns [value, ended, added]: added counts the characters kept here.
  // Only used off the hot path (junk after a closing quote, a quote that
  // never closes); the main loop inlines the same scan.
  function scanUnquoted(start, prefix) {
    const iComma = text.indexOf(',', start);
    const iLF = text.indexOf('\n', start);
    let d;
    let term;
    if (iComma === -1 && iLF === -1) {
      d = n;
      term = END;
    } else if (iLF === -1 || (iComma !== -1 && iComma < iLF)) {
      d = iComma;
      term = COMMA;
    } else {
      d = iLF;
      term = LINE_BREAK;
    }
    let seg = text.slice(start, d);
    // A CR right before a LF is the CRLF line ending, not a stray CR.
    if (term === LINE_BREAK && seg.charCodeAt(seg.length - 1) === 13) seg = seg.slice(0, -1);
    let added = seg.length;
    if (seg.indexOf('\r') !== -1) {
      seg = dropCRs(seg);
      added = seg.length;
    }
    if (term === COMMA) {
      pos = d + 1;
      return [prefix + seg, COMMA, added];
    }
    if (term === LINE_BREAK) {
      pos = d + 1;
      line += 1;
      return [prefix + seg, LINE_BREAK, added];
    }
    pos = n;
    return [prefix + seg, END, added];
  }

  // Reads a quoted field whose opening quote is at `open` and whose first
  // closing-quote candidate is `q`, when the span holds a doubled quote or
  // a line break: the general loop, mirroring the reference. Returns
  // [value, ended]. A quote that never closes falls back to the reference's
  // rule: the quote is a literal character and the text after it is read
  // again as unquoted.
  function readQuotedSlow(open, openLine) {
    const parts = [];
    let i = open + 1;
    let segStart = i;
    let closed = false;
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 34) {
        if (text.charCodeAt(i + 1) === 34) {
          parts.push(text.slice(segStart, i), '"');
          i += 2;
          segStart = i;
          continue;
        }
        parts.push(text.slice(segStart, i));
        closed = true;
        break;
      }
      if (c === 13) {
        // CRLF and a lone CR inside quotes are each one LF.
        parts.push(text.slice(segStart, i), '\n');
        line += 1;
        i += text.charCodeAt(i + 1) === 10 ? 2 : 1;
        segStart = i;
        continue;
      }
      if (c === 10) line += 1;
      i += 1;
    }
    if (!closed) {
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      line = openLine;
      return scanUnquoted(open + 1, '"');
    }
    const value = parts.join('');
    pos = i + 1;
    if (pos >= n) return [value, END];
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      return [value, COMMA];
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      return [value, LINE_BREAK];
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      return [value, LINE_BREAK];
    }
    // What follows the closing quote is appended as it stands, up to the
    // next comma or line break.
    const junk = scanUnquoted(pos, value);
    if (junk[2] > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
    return junk;
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let ended;
    let lastQuoted = false;
    do {
      let value;
      if (text.charCodeAt(pos) === 34) {
        lastQuoted = true;
        const open = pos;
        const openLine = line;
        const q = text.indexOf('"', open + 1);
        if (q === -1) {
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          line = openLine;
          const r = scanUnquoted(open + 1, '"');
          value = r[0];
          ended = r[1];
        } else {
          const span = text.slice(open + 1, q);
          if (text.charCodeAt(q + 1) === 34 || span.indexOf('\n') !== -1 || span.indexOf('\r') !== -1) {
            const r = readQuotedSlow(open, openLine);
            value = r[0];
            ended = r[1];
          } else {
            value = span;
            pos = q + 1;
            if (pos >= n) {
              ended = END;
            } else {
              const c = text.charCodeAt(pos);
              if (c === 44) {
                pos += 1;
                ended = COMMA;
              } else if (c === 10) {
                pos += 1;
                line += 1;
                ended = LINE_BREAK;
              } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
                pos += 2;
                line += 1;
                ended = LINE_BREAK;
              } else {
                // What follows the closing quote is appended as it stands.
                const junk = scanUnquoted(pos, value);
                value = junk[0];
                ended = junk[1];
                if (junk[2] > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
              }
            }
          }
        }
      } else {
        lastQuoted = false;
        const iComma = text.indexOf(',', pos);
        const iLF = text.indexOf('\n', pos);
        let d;
        let term;
        if (iComma === -1 && iLF === -1) {
          d = n;
          term = END;
        } else if (iLF === -1 || (iComma !== -1 && iComma < iLF)) {
          d = iComma;
          term = COMMA;
        } else {
          d = iLF;
          term = LINE_BREAK;
        }
        value = text.slice(pos, d);
        // A CR right before a LF is the CRLF line ending, not a stray CR.
        if (term === LINE_BREAK && value.charCodeAt(value.length - 1) === 13) value = value.slice(0, -1);
        if (value.indexOf('\r') !== -1) value = dropCRs(value);
        if (term === COMMA) {
          pos = d + 1;
          ended = COMMA;
        } else if (term === LINE_BREAK) {
          pos = d + 1;
          line += 1;
          ended = LINE_BREAK;
        } else {
          pos = n;
          ended = END;
        }
      }
      fields.push(value);
    } while (ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
