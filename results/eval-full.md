# Results

1200 attempts, 40 tasks, 6 model(s), run on 2026-11-16, 2026-11-17, 2026-11-19. 54 attempt(s) ended in a provider error and are not counted.

144 attempt(s) were made again and are counted in place of 144 earlier one(s), which stay in the file: 44 for `code:arkui-only-ui-syntax`, 100 for `cut-off`. `cut-off`: the answer was cut off at a lower output limit. `code:<code>`: an earlier judge reported that checker code, and a fix to the judge changed when it does.

42 attempt(s) were cut off at the output limit. They count as failures, in their own column below.

Output limit per call, in tokens: 40960 (54 attempt(s)), 48000 (93 attempt(s)), not recorded (1053 attempt(s)).

Each cell: pass rate (passed/attempts, 95 % interval in %).

## Pass rate by model and condition

| Model | bare | rules | docs | loop | full |
| --- | --- | --- | --- | --- | --- |
| z-ai/glm-5.1 | 78% (31/40, 62-88) | 83% (33/40, 68-91) | 83% (33/40, 68-91) | 100% (40/40, 91-100) | 98% (39/40, 87-100) |
| deepseek/deepseek-v4.1-flash-1017 | 85% (34/40, 71-93) | 95% (38/40, 83-99) | 90% (36/40, 77-96) | 95% (38/40, 83-99) | 100% (40/40, 91-100) |
| qwen/qwen3-coder-next | 20% (8/40, 10-35) | 25% (10/40, 14-40) | 18% (7/40, 9-32) | 48% (19/40, 33-63) | 43% (17/40, 29-58) |
| qwen/qwen3-coder-30b-a3b-instruct | 18% (7/40, 9-32) | 23% (9/40, 12-38) | 20% (8/40, 10-35) | 38% (15/40, 24-53) | 30% (12/40, 18-45) |
| qwen/qwen3.5-9b | 18% (7/40, 9-32) | 18% (7/40, 9-32) | 13% (5/40, 5-26) | 23% (9/40, 12-38) | 28% (11/40, 16-43) |
| z-ai/glm-5.3-flash | 78% (31/40, 62-88) | 78% (31/40, 62-88) | 85% (34/40, 71-93) | 95% (38/40, 83-99) | 88% (35/40, 74-95) |

## Pass rate by kind of task

| Kind | bare | rules | docs | loop | full |
| --- | --- | --- | --- | --- | --- |
| logic | 57% (69/120, 49-66) | 61% (73/120, 52-69) | 59% (71/120, 50-68) | 71% (85/120, 62-78) | 64% (77/120, 55-72) |
| ui | 41% (49/120, 32-50) | 46% (55/120, 37-55) | 43% (52/120, 35-52) | 62% (74/120, 53-70) | 64% (77/120, 55-72) |

## Pass rate by task set

| Set | bare | rules | docs | loop | full |
| --- | --- | --- | --- | --- | --- |
| H (harder, added later) | 23% (14/60, 14-35) | 30% (18/60, 20-43) | 33% (20/60, 23-46) | 47% (28/60, 35-59) | 47% (28/60, 35-59) |
| L (core logic) | 68% (61/90, 58-77) | 69% (62/90, 59-78) | 68% (61/90, 58-77) | 81% (73/90, 72-88) | 71% (64/90, 61-79) |
| U (core ArkUI) | 48% (43/90, 38-58) | 53% (48/90, 43-63) | 47% (42/90, 37-57) | 64% (58/90, 54-74) | 69% (62/90, 59-78) |

## What the verification loop does

| Model | Condition | Clean on first answer | Clean after repairs | Passed | Mean answers |
| --- | --- | --- | --- | --- | --- |
| z-ai/glm-5.1 | loop | 30/40 | 40/40 | 100% (40/40, 91-100) | 1.30 |
| z-ai/glm-5.1 | full | 34/40 | 40/40 | 98% (39/40, 87-100) | 1.23 |
| deepseek/deepseek-v4.1-flash-1017 | loop | 36/40 | 38/40 | 95% (38/40, 83-99) | 1.05 |
| deepseek/deepseek-v4.1-flash-1017 | full | 39/40 | 40/40 | 100% (40/40, 91-100) | 1.02 |
| qwen/qwen3-coder-next | loop | 8/40 | 23/40 | 48% (19/40, 33-63) | 2.83 |
| qwen/qwen3-coder-next | full | 14/40 | 29/40 | 43% (17/40, 29-58) | 2.45 |
| qwen/qwen3-coder-30b-a3b-instruct | loop | 12/40 | 24/40 | 38% (15/40, 24-53) | 2.77 |
| qwen/qwen3-coder-30b-a3b-instruct | full | 13/40 | 25/40 | 30% (12/40, 18-45) | 2.65 |
| qwen/qwen3.5-9b | loop | 9/40 | 15/40 | 23% (9/40, 12-38) | 2.92 |
| qwen/qwen3.5-9b | full | 13/40 | 17/40 | 28% (11/40, 16-43) | 2.80 |
| z-ai/glm-5.3-flash | loop | 32/40 | 40/40 | 95% (38/40, 83-99) | 1.23 |
| z-ai/glm-5.3-flash | full | 37/40 | 38/40 | 88% (35/40, 74-95) | 1.02 |

## Against bare, task by task

A task is fixed when it passes more often than under `bare`, and broken when it passes less often.

| Model | Condition | Tasks compared | Fixed | Broken | Same |
| --- | --- | --- | --- | --- | --- |
| z-ai/glm-5.1 | rules | 40 | 5 | 3 | 32 |
| z-ai/glm-5.1 | docs | 40 | 7 | 5 | 28 |
| z-ai/glm-5.1 | loop | 40 | 9 | 0 | 31 |
| z-ai/glm-5.1 | full | 40 | 8 | 0 | 32 |
| deepseek/deepseek-v4.1-flash-1017 | rules | 40 | 5 | 1 | 34 |
| deepseek/deepseek-v4.1-flash-1017 | docs | 40 | 4 | 2 | 34 |
| deepseek/deepseek-v4.1-flash-1017 | loop | 40 | 6 | 2 | 32 |
| deepseek/deepseek-v4.1-flash-1017 | full | 40 | 6 | 0 | 34 |
| qwen/qwen3-coder-next | rules | 40 | 6 | 4 | 30 |
| qwen/qwen3-coder-next | docs | 40 | 3 | 4 | 33 |
| qwen/qwen3-coder-next | loop | 40 | 12 | 1 | 27 |
| qwen/qwen3-coder-next | full | 40 | 13 | 4 | 23 |
| qwen/qwen3-coder-30b-a3b-instruct | rules | 40 | 4 | 2 | 34 |
| qwen/qwen3-coder-30b-a3b-instruct | docs | 40 | 2 | 1 | 37 |
| qwen/qwen3-coder-30b-a3b-instruct | loop | 40 | 8 | 0 | 32 |
| qwen/qwen3-coder-30b-a3b-instruct | full | 40 | 8 | 3 | 29 |
| qwen/qwen3.5-9b | rules | 40 | 3 | 3 | 34 |
| qwen/qwen3.5-9b | docs | 40 | 0 | 2 | 38 |
| qwen/qwen3.5-9b | loop | 40 | 3 | 1 | 36 |
| qwen/qwen3.5-9b | full | 40 | 5 | 1 | 34 |
| z-ai/glm-5.3-flash | rules | 40 | 4 | 4 | 32 |
| z-ai/glm-5.3-flash | docs | 40 | 6 | 3 | 31 |
| z-ai/glm-5.3-flash | loop | 40 | 8 | 1 | 31 |
| z-ai/glm-5.3-flash | full | 40 | 6 | 2 | 32 |

## Where failures stop

| Condition | static (checker errors) | behaviour (hidden tests) | structure (UI blocks) | cut off (output limit) |
| --- | --- | --- | --- | --- |
| bare | 102 | 9 | 1 | 10 |
| rules | 90 | 12 | 1 | 9 |
| docs | 91 | 11 | 1 | 14 |
| loop | 55 | 17 | 4 | 5 |
| full | 47 | 28 | 7 | 4 |

## Most common checker errors on the first answer

| Code | Attempts with this error |
| --- | --- |
| TS2304 | 143 |
| TS2339 | 137 |
| arkts-no-any-unknown | 127 |
| arkts-no-obj-literals-as-types | 94 |
| arkts-no-untyped-obj-literals | 91 |
| TS2345 | 68 |
| TS2305 | 51 |
| TS2307 | 39 |
| TS1128 | 37 |
| TS2552 | 36 |
| TS1005 | 35 |
| TS2564 | 33 |

## Cost

Calls, tokens and USD include the attempts that ended in a provider error or were made again later: they are not in the pass rates, but what they spent was spent.

| Model | Condition | Calls | Input tokens | Output tokens | USD | USD per passed task |
| --- | --- | --- | --- | --- | --- | --- |
| z-ai/glm-5.1 | bare | 45 | 14779 | 106917 | 0.4760 | 0.0154 |
| z-ai/glm-5.1 | rules | 44 | 82984 | 130405 | 0.6238 | 0.0189 |
| z-ai/glm-5.1 | docs | 90 | 82164 | 182346 | 0.8688 | 0.0263 |
| z-ai/glm-5.1 | loop | 57 | 31818 | 122633 | 0.5682 | 0.0142 |
| z-ai/glm-5.1 | full | 108 | 267882 | 380095 | 1.7345 | 0.0445 |
| deepseek/deepseek-v4.1-flash-1017 | bare | 46 | 17557 | 284929 | 0.1639 | 0.0048 |
| deepseek/deepseek-v4.1-flash-1017 | rules | 43 | 93511 | 264444 | 0.1677 | 0.0044 |
| deepseek/deepseek-v4.1-flash-1017 | docs | 98 | 96233 | 543093 | 0.2637 | 0.0073 |
| deepseek/deepseek-v4.1-flash-1017 | loop | 47 | 21385 | 308281 | 0.1460 | 0.0038 |
| deepseek/deepseek-v4.1-flash-1017 | full | 90 | 244796 | 354385 | 0.2000 | 0.0050 |
| qwen/qwen3-coder-next | bare | 41 | 14497 | 26330 | 0.0228 | 0.0029 |
| qwen/qwen3-coder-next | rules | 41 | 82904 | 24119 | 0.0263 | 0.0026 |
| qwen/qwen3-coder-next | docs | 80 | 75429 | 53589 | 0.0517 | 0.0074 |
| qwen/qwen3-coder-next | loop | 117 | 190818 | 82451 | 0.0852 | 0.0045 |
| qwen/qwen3-coder-next | full | 153 | 620655 | 93995 | 0.1307 | 0.0077 |
| qwen/qwen3-coder-30b-a3b-instruct | bare | 41 | 14469 | 17924 | 0.0129 | 0.0018 |
| qwen/qwen3-coder-30b-a3b-instruct | rules | 44 | 88878 | 19816 | 0.0252 | 0.0028 |
| qwen/qwen3-coder-30b-a3b-instruct | docs | 86 | 79902 | 36815 | 0.0341 | 0.0043 |
| qwen/qwen3-coder-30b-a3b-instruct | loop | 127 | 163780 | 62418 | 0.0620 | 0.0041 |
| qwen/qwen3-coder-30b-a3b-instruct | full | 166 | 645058 | 361245 | 0.3135 | 0.0261 |
| qwen/qwen3.5-9b | bare | 52 | 19154 | 338999 | 0.0865 | 0.0124 |
| qwen/qwen3.5-9b | rules | 48 | 100113 | 257205 | 0.0804 | 0.0115 |
| qwen/qwen3.5-9b | docs | 108 | 54708 | 1126144 | 0.2866 | 0.0573 |
| qwen/qwen3.5-9b | loop | 132 | 599490 | 522048 | 0.1862 | 0.0207 |
| qwen/qwen3.5-9b | full | 199 | 1409704 | 1186594 | 0.4640 | 0.0422 |
| z-ai/glm-5.3-flash | bare | 47 | 17771 | 507392 | 0.1921 | 0.0062 |
| z-ai/glm-5.3-flash | rules | 49 | 100018 | 470808 | 0.1914 | 0.0062 |
| z-ai/glm-5.3-flash | docs | 102 | 94946 | 959499 | 0.3528 | 0.0104 |
| z-ai/glm-5.3-flash | loop | 53 | 31532 | 303624 | 0.1154 | 0.0030 |
| z-ai/glm-5.3-flash | full | 97 | 253345 | 748359 | 0.3104 | 0.0089 |
