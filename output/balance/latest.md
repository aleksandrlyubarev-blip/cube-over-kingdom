# Balance Snapshot

Generated: 2026-07-09T01:35:36.032Z

## Theoretical 4-Slot Pressure

| Layer | HP | Best L3 weapon | 4-slot DPS | Clear time |
| --- | ---: | --- | ---: | ---: |
| Внешняя каменная кора | 15000 | Баллиста | 842.24 | 18s |
| Плотная кладка | 25000 | Требушет | 1278.87 | 20s |
| Астральный гранит | 45000 | Бомбарда | 2239.99 | 20s |
| Внутреннее ядро | 120000 | Пушка | 7187.54 | 17s |
| Сердце куба | 200000 | Осадная пушка | 12527.25 | 16s |

## Budget Partition

| Metric | Value |
| --- | ---: |
| Total target | 3h 47m |
| Combat share | 70% |
| Combat target | 2h 39m |
| Acquisition share | 30% |
| Acquisition target | 1h 8m |
| Hard-gate acquisition target | 5m 0s |
| Soft acquisition target | 1h 3m |
| Projected combat + acquisition | 2h 39m + 1h 8m = 3h 47m |
| Budget guard OK | yes |

## Guardrails

| Metric | Value |
| --- | ---: |
| Completed profiles | 3 |
| Total spread | 3.97x |
| Combat spread | 2.06x |
| Optimizer total time | 1h 0m |
| Optimizer combat time | 20m 17s |
| Total spread OK | yes |
| Combat spread OK | yes |
| Total optimizer OK | yes |
| Combat optimizer OK | no |
| Total guardrails OK | yes |
| Combat guardrails OK | no |

## Partitioned HP Suggestion

Total HP: 405000 current -> 1681724 suggested at 70% combat budget.

| Layer | Current HP | Total | Acq | Combat | Target | Source | DPS_eff | Suggested HP | Delta |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| Внешняя каменная кора | 15000 | 7m 43s | 16s | 7m 27s | 21m 0s | combat | 33.56 | 42282 | +27282 |
| Плотная кладка | 25000 | 17m 4s | 11m 45s | 5m 19s | 29m 45s | combat | 78.37 | 139890 | +114890 |
| Астральный гранит | 45000 | 9m 48s | 0s | 9m 48s | 40m 15s | combat | 76.53 | 184821 | +139821 |
| Внутреннее ядро | 120000 | 29m 5s | 14m 21s | 14m 44s | 47m 15s | combat | 135.75 | 384842 | +264842 |
| Сердце куба | 200000 | 2h 40m | 2h 35m | 4m 31s | 21m 0s | combat | 738.01 | 929889 | +729889 |

## Hard-Gate Acquisition Economy

| Layer | Observed wait | Target wait | Limiting resource | Suggested cost cap | OK |
| --- | ---: | ---: | --- | ---: | --- |
| Сердце куба | 2h 35m | 5m 0s | orders | 1.5K orders / 3.8K shards | no |

### Suggested-HP Preview

| Profile | Result | Total | Acq | Combat | Remaining HP |
| --- | --- | ---: | ---: | ---: | ---: |
| Пассивный | win | 4h 43m | 2h 46m | 1h 57m | 0 |
| Средний | not finished | 5h 0m | 7m 22s | 1h 2m | 929889 |
| Оптимизатор | win | 3h 8m | 2h 20m | 48m 7s | 0 |

Suggested preview total spread: 1.51x; optimizer: 3h 8m; ok: no.
Suggested preview combat spread: 2.44x; optimizer combat: 48m 7s; ok: no.

## Profiles

### Пассивный

Result: win in 3h 43m; combat: 41m 49s; acquisition: 3h 1m; remaining HP: 0.

| Metric | Value |
| --- | ---: |
| Damage | 405000 |
| Shots | 759 |
| Spawned blocks | 4222 |
| Collected blocks | 4134 |
| Shards collected | 13262 |
| Manual weak hits | 0 |

| Layer | Total | Acq | Combat | Ended at |
| --- | ---: | ---: | ---: | ---: |
| Внешняя каменная кора | 7m 43s | 16s | 7m 27s | 7m 43s |
| Плотная кладка | 17m 4s | 11m 45s | 5m 19s | 24m 47s |
| Астральный гранит | 9m 48s | 0s | 9m 48s | 34m 35s |
| Внутреннее ядро | 29m 5s | 14m 21s | 14m 44s | 1h 3m |
| Сердце куба | 2h 40m | 2h 35m | 4m 31s | 3h 43m |

### Средний

Result: win in 3h 59m; combat: 30m 11s; acquisition: 3h 29m; remaining HP: 0.

| Metric | Value |
| --- | ---: |
| Damage | 405000 |
| Shots | 536 |
| Spawned blocks | 3528 |
| Collected blocks | 3478 |
| Shards collected | 25624 |
| Manual weak hits | 0 |

| Layer | Total | Acq | Combat | Ended at |
| --- | ---: | ---: | ---: | ---: |
| Внешняя каменная кора | 3m 44s | 9s | 3m 35s | 3m 44s |
| Плотная кладка | 9m 43s | 4m 19s | 5m 24s | 13m 27s |
| Астральный гранит | 5m 53s | 0s | 5m 53s | 19m 20s |
| Внутреннее ядро | 18m 18s | 5m 22s | 12m 56s | 37m 38s |
| Сердце куба | 3h 22m | 3h 19m | 2m 23s | 3h 59m |

### Оптимизатор

Result: win in 1h 0m; combat: 20m 17s; acquisition: 40m 12s; remaining HP: 0.

| Metric | Value |
| --- | ---: |
| Damage | 405000 |
| Shots | 418 |
| Spawned blocks | 3202 |
| Collected blocks | 3202 |
| Shards collected | 20200 |
| Manual weak hits | 0 |

| Layer | Total | Acq | Combat | Ended at |
| --- | ---: | ---: | ---: | ---: |
| Внешняя каменная кора | 2m 16s | 3s | 2m 13s | 2m 16s |
| Плотная кладка | 4m 34s | 1m 29s | 3m 5s | 6m 50s |
| Астральный гранит | 2m 42s | 0s | 2m 42s | 9m 32s |
| Внутреннее ядро | 9m 38s | 1m 3s | 8m 35s | 19m 10s |
| Сердце куба | 41m 19s | 37m 37s | 3m 42s | 1h 0m |

