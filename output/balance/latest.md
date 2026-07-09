# Balance Snapshot

Generated: 2026-07-09T03:23:55.534Z

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
| Budget guard OK | yes |

## Guardrails

| Metric | Value |
| --- | ---: |
| Completed profiles | 3 |
| Total spread | 1.9x |
| Combat spread | 1.89x |
| Optimizer total time | 1h 47m |
| Optimizer combat time | 1h 46m |
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

| Layer | Observed wait | Target wait | Limiting resource | Suggested cost cap | OK |
| --- | ---: | ---: | --- | ---: | --- |
| Сердце куба | 6s | 5m 0s | orders | 23.5K orders / 3.8K shards | yes |

### Suggested-HP Preview

| Profile | Result | Total | Acq | Combat | Remaining HP |
| --- | --- | ---: | ---: | ---: | ---: |
| Пассивный | win | 3h 25m | 2m 1s | 3h 23m | 0 |
| Средний | win | 2h 21m | 1m 9s | 2h 19m | 0 |
| Оптимизатор | win | 1h 48m | 26s | 1h 47m | 0 |

Suggested preview total spread: 1.9x; optimizer: 1h 48m; ok: yes.
Suggested preview combat spread: 1.89x; optimizer combat: 1h 47m; ok: yes.

## Profiles

### Пассивный

Result: win in 3h 23m; combat: 3h 22m; acquisition: 1m 49s; remaining HP: 0.

| Metric | Value |
| --- | ---: |
| Damage | 9693000 |
| Shots | 5907 |
| Spawned blocks | 47498 |
| Collected blocks | 47383 |
| Shards collected | 321821 |
| Manual weak hits | 0 |

| Layer | Total | Acq | Combat | Ended at |
| --- | ---: | ---: | ---: | ---: |
| Внешняя каменная кора | 27m 15s | 16s | 26m 59s | 27m 15s |
| Плотная кладка | 39m 5s | 1m 25s | 37m 40s | 1h 6m |
| Астральный гранит | 50m 50s | 0s | 50m 50s | 1h 57m |
| Внутреннее ядро | 1h 0m | 2s | 1h 0m | 2h 57m |
| Сердце куба | 26m 30s | 6s | 26m 24s | 3h 23m |

### Средний

Result: win in 2h 19m; combat: 2h 18m; acquisition: 1m 8s; remaining HP: 0.

| Metric | Value |
| --- | ---: |
| Damage | 9693000 |
| Shots | 4437 |
| Spawned blocks | 39280 |
| Collected blocks | 39215 |
| Shards collected | 532278 |
| Manual weak hits | 0 |

| Layer | Total | Acq | Combat | Ended at |
| --- | ---: | ---: | ---: | ---: |
| Внешняя каменная кора | 12m 53s | 9s | 12m 44s | 12m 53s |
| Плотная кладка | 35m 7s | 58s | 34m 9s | 48m 0s |
| Астральный гранит | 51m 15s | 0s | 51m 15s | 1h 39m |
| Внутреннее ядро | 12m 17s | 0s | 12m 17s | 1h 51m |
| Сердце куба | 27m 39s | 1s | 27m 38s | 2h 19m |

### Оптимизатор

Result: win in 1h 47m; combat: 1h 46m; acquisition: 26s; remaining HP: 0.

| Metric | Value |
| --- | ---: |
| Damage | 9693000 |
| Shots | 2919 |
| Spawned blocks | 29890 |
| Collected blocks | 29890 |
| Shards collected | 556944 |
| Manual weak hits | 0 |

| Layer | Total | Acq | Combat | Ended at |
| --- | ---: | ---: | ---: | ---: |
| Внешняя каменная кора | 5m 19s | 3s | 5m 16s | 5m 19s |
| Плотная кладка | 29m 55s | 22s | 29m 33s | 35m 14s |
| Астральный гранит | 29m 13s | 0s | 29m 13s | 1h 4m |
| Внутреннее ядро | 13m 58s | 0s | 13m 58s | 1h 18m |
| Сердце куба | 28m 43s | 1s | 28m 42s | 1h 47m |

