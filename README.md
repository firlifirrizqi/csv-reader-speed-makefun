# csv-reader-speed-makefun

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/firlifirrizqi/csv-reader-speed-makefun/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/firlifirrizqi/csv-reader-speed-makefun/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast drop-in for make.fun's csv-reader 1.0.0: reads broken CSV files exactly
as csv-reader does — same `{columns, rows, errors}` for every input, including
stray CRs, unterminated quotes, junk after closing quotes, and short/long
rows — in about 7× less CPU time than the house baseline on the practice set
(~99 ms vs ~731 ms per 6-case set on this machine).

`main.ts` is the house driver: it reads every case from
`$MAKEFUN_INPUT_DIR/cases.json`, answers each with `run()` from `solve.js`,
and writes `$MAKEFUN_OUTPUT_DIR/answers.json`. `solve.js` is a
dependency-free ES module that cuts fields out with `indexOf`/`slice`
instead of building them one character at a time, and only falls back to a
character loop for fields that actually need it (doubled quotes, line breaks
inside quotes, stray CRs, junk after a closing quote, a quote that never
closes).

## Run it

```sh
node main.ts
```

Node 22 or later, nothing to install. Set `MAKEFUN_INPUT_DIR` and
`MAKEFUN_OUTPUT_DIR` to run outside the grader's container.

---

<sub>Entered on [make.fun](https://make.fun/?ref=v8vnayfm&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
