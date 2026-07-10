# Balance Snapshot

Generated: 2026-07-10T16:01:09.430Z

## Theoretical 4-Slot Pressure

| Layer | HP | Best L3 weapon | 4-slot DPS | Clear time |
| --- | ---: | --- | ---: | ---: |
| Внешняя каменная кора | 43000 | Баллиста | 842.24 | 51s |
| Плотная кладка | 750000 | Требушет | 1278.87 | 9m 46s |
| Астральный гранит | 1400000 | Бомбарда | 2239.99 | 10m 25s |
| Внутреннее ядро | 2900000 | Пушка | 7187.54 | 6m 43s |
| Сердце куба | 4600000 | Осадная пушка | 12527.25 | 6m 7s |

## Budget Partition

| Metric | Value |
| --- | ---: |
| Total target | 3h 47m |
| Combat share | 90% |
| Combat target | 3h 24m |
| Acquisition share | 10% |
| Acquisition target | 22m 45s |
| Hard-gate acquisition target | 5m 0s |
| Soft acquisition target | 17m 45s |
| Projected combat + acquisition | 3h 24m + 22m 45s = 3h 47m |
| Budget construction guard OK | yes |
| Observed total | 3h 23m / 3h 47m (within) |
| Observed combat | 3h 22m / 3h 24m (within) |
| Observed acquisition | 1m 49s / 22m 45s (too-short) |
| Observed budget guard OK | no |

## Guardrails

| Metric | Value |
| --- | ---: |
| Completed profiles | 3 |
| Total spread | 2.11x |
| Combat spread | 2.1x |
| Optimizer total time | 1h 36m |
| Optimizer combat time | 1h 36m |
| Total spread OK | yes |
| Combat spread OK | yes |
| Total optimizer OK | yes |
| Combat optimizer OK | yes |
| Total guardrails OK | yes |
| Combat guardrails OK | yes |

## Partitioned HP Suggestion

Total HP: 9693000 current -> 9862549 suggested at 90% combat budget.

| Layer | Current HP | Total | Acq | Combat | Target | Source | DPS_eff | Suggested HP | Delta |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| Внешняя каменная кора | 43000 | 27m 15s | 16s | 26m 59s | 27m 0s | combat | 26.56 | 43027 | +27 |
| Плотная кладка | 750000 | 39m 5s | 1m 25s | 37m 40s | 38m 15s | combat | 331.86 | 761615 | +11615 |
| Астральный гранит | 1400000 | 50m 50s | 0s | 50m 50s | 51m 45s | combat | 459.02 | 1425246 | +25246 |
| Внутреннее ядро | 2900000 | 1h 0m | 2s | 1h 0m | 1h 0m | combat | 803.32 | 2928116 | +28116 |
| Сердце куба | 4600000 | 26m 30s | 6s | 26m 24s | 27m 0s | combat | 2904.04 | 4704545 | +104545 |

## Hard-Gate Acquisition Economy

| Layer | Observed wait | Target band | Funding | Limiting resource | Suggested cost cap | Status |
| --- | ---: | ---: | --- | --- | ---: | --- |
| Сердце куба | 6s | 4m 0s-6m 0s | prefunded | - | - | too-short |

### Suggested-HP Preview

| Profile | Result | Total | Acq | Combat | Remaining HP |
| --- | --- | ---: | ---: | ---: | ---: |
| Пассивный под присмотром | win | 3h 25m | 2m 1s | 3h 23m | 0 |
| Средний | win | 2h 14m | 1m 11s | 2h 13m | 0 |
| Оптимизатор | win | 1h 38m | 17s | 1h 37m | 0 |

Suggested preview total spread: 2.1x; optimizer: 1h 38m; ok: yes.
Suggested preview combat spread: 2.08x; optimizer combat: 1h 37m; ok: yes.

## Profiles

### Пассивный под присмотром

Result: win in 3h 23m; combat: 3h 22m; acquisition: 1m 49s; remaining HP: 0.

| Metric | Value |
| --- | ---: |
| Damage | 9693000 |
| Shots | 5907 |
| Spawned blocks | 47498 |
| Collected blocks | 47383 |
| Shards collected | 321731 |
| Manual weak hits | 0 |
| Manual scheduled | 0 |
| Manual not ready | 0 |
| Manual no eligible weapon | 0 |

| Layer | Total | Acq | Combat | Ended at |
| --- | ---: | ---: | ---: | ---: |
| Внешняя каменная кора | 27m 15s | 16s | 26m 59s | 27m 15s |
| Плотная кладка | 39m 5s | 1m 25s | 37m 40s | 1h 6m |
| Астральный гранит | 50m 50s | 0s | 50m 50s | 1h 57m |
| Внутреннее ядро | 1h 0m | 2s | 1h 0m | 2h 57m |
| Сердце куба | 26m 30s | 6s | 26m 24s | 3h 23m |

### Средний

Result: win in 2h 13m; combat: 2h 12m; acquisition: 1m 7s; remaining HP: 0.

| Metric | Value |
| --- | ---: |
| Damage | 9693000 |
| Shots | 4218 |
| Spawned blocks | 39469 |
| Collected blocks | 39454 |
| Shards collected | 721523 |
| Manual weak hits | 114 |
| Manual scheduled | 444 |
| Manual not ready | 175 |
| Manual no eligible weapon | 330 |

| Layer | Total | Acq | Combat | Ended at |
| --- | ---: | ---: | ---: | ---: |
| Внешняя каменная кора | 12m 53s | 9s | 12m 44s | 12m 53s |
| Плотная кладка | 35m 7s | 58s | 34m 9s | 48m 0s |
| Астральный гранит | 51m 15s | 0s | 51m 15s | 1h 39m |
| Внутреннее ядро | 10m 45s | 0s | 10m 45s | 1h 50m |
| Сердце куба | 23m 24s | 0s | 23m 24s | 2h 13m |

### Оптимизатор

Result: win in 1h 36m; combat: 1h 36m; acquisition: 41s; remaining HP: 0.

| Metric | Value |
| --- | ---: |
| Damage | 9693000 |
| Shots | 2591 |
| Spawned blocks | 30731 |
| Collected blocks | 30731 |
| Shards collected | 855381 |
| Manual weak hits | 212 |
| Manual scheduled | 580 |
| Manual not ready | 316 |
| Manual no eligible weapon | 368 |

| Layer | Total | Acq | Combat | Ended at |
| --- | ---: | ---: | ---: | ---: |
| Внешняя каменная кора | 4m 41s | 3s | 4m 38s | 4m 41s |
| Плотная кладка | 30m 6s | 4s | 30m 2s | 34m 47s |
| Астральный гранит | 29m 20s | 0s | 29m 20s | 1h 4m |
| Внутреннее ядро | 11m 21s | 0s | 11m 21s | 1h 15m |
| Сердце куба | 21m 16s | 34s | 20m 42s | 1h 36m |


## Diagnostics (Excluded From Solver Guardrails)

### Запущенный лагерь: 3x30 мин

Result: not finished after 1h 30m active time; remaining HP: 9109665; collected shards: 15599.

