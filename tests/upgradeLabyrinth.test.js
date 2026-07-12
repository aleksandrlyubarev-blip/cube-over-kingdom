import assert from "node:assert/strict";
import test from "node:test";
import {
  LABYRINTH_BRANCHES,
  LABYRINTH_NODES,
  getLabyrinthNode,
  getLabyrinthNodeVisibility,
  getVisibleLabyrinthNodes
} from "../src/upgradeLabyrinth.js";

const VALID_BRANCHES = new Set([
  "root",
  "manual",
  "automation",
  "collection",
  "maintenance",
  "quality"
]);

const EXPECTED_NODES = [
  {
    id: "labyrinth01",
    number: 1,
    branch: "root",
    name: "Королевский приказ",
    prerequisites: [],
    cost: { orders: 0, shards: 0 },
    effectText: "+1 приказ за тап"
  },
  {
    id: "labyrinth02",
    number: 2,
    branch: "manual",
    name: "Быстрые распоряжения",
    prerequisites: ["labyrinth01"],
    cost: { orders: 0, shards: 25 },
    effectText: "+2 приказа за тап"
  },
  {
    id: "labyrinth03",
    number: 3,
    branch: "manual",
    name: "Инженерные чертежи",
    prerequisites: ["labyrinth02"],
    cost: { orders: 0, shards: 80 },
    effectText: "+5 приказов за тап"
  },
  {
    id: "labyrinth04",
    number: 4,
    branch: "manual",
    name: "Рабочие артели",
    prerequisites: ["labyrinth03"],
    cost: { orders: 0, shards: 200 },
    effectText: "тап дополнительно даёт 1% пассивного дохода/сек"
  },
  {
    id: "labyrinth05",
    number: 5,
    branch: "manual",
    name: "Военная мобилизация",
    prerequisites: ["labyrinth04"],
    cost: { orders: 0, shards: 500 },
    effectText: "+25% ручного дохода"
  },
  {
    id: "labyrinth06",
    number: 6,
    branch: "manual",
    name: "Приказ короля",
    prerequisites: ["labyrinth05"],
    cost: { orders: 0, shards: 1200 },
    effectText: "раз в 60 секунд следующий тап x25"
  },
  {
    id: "labyrinth07",
    number: 7,
    branch: "automation",
    name: "Писцы гильдии",
    prerequisites: ["labyrinth01"],
    cost: { orders: 150, shards: 0 },
    effectText: "+2 приказа/сек"
  },
  {
    id: "labyrinth08",
    number: 8,
    branch: "automation",
    name: "Складские журналы",
    prerequisites: ["labyrinth07"],
    cost: { orders: 400, shards: 0 },
    effectText: "автоматическая добыча +100%"
  },
  {
    id: "labyrinth09",
    number: 9,
    branch: "automation",
    name: "Ночные смены",
    prerequisites: ["labyrinth08"],
    cost: { orders: 1200, shards: 0 },
    effectText: "+5 приказов/сек, включая offline"
  },
  {
    id: "labyrinth10",
    number: 10,
    branch: "automation",
    name: "Мастерские снабжения",
    prerequisites: ["labyrinth09"],
    cost: { orders: 2500, shards: 0 },
    effectText: "строительство орудий -10%"
  },
  {
    id: "labyrinth11",
    number: 11,
    branch: "automation",
    name: "Королевская логистика",
    prerequisites: ["labyrinth10"],
    cost: { orders: 0, shards: 1500 },
    effectText: "строительство орудий ещё -20%"
  },
  {
    id: "labyrinth12",
    number: 12,
    branch: "automation",
    name: "Автоматический набор рабочих",
    prerequisites: ["labyrinth11"],
    cost: { orders: 0, shards: 3500 },
    effectText: "каждые 30 секунд импульс 10 секунд пассивной добычи"
  },
  {
    id: "labyrinth13",
    number: 13,
    branch: "collection",
    name: "Носильщики",
    prerequisites: ["labyrinth01"],
    cost: { orders: 0, shards: 100 },
    effectText: "автосбор 10% блоков"
  },
  {
    id: "labyrinth14",
    number: 14,
    branch: "collection",
    name: "Тележки для обломков",
    prerequisites: ["labyrinth13"],
    cost: { orders: 0, shards: 300 },
    effectText: "автосбор 25% блоков"
  },
  {
    id: "labyrinth15",
    number: 15,
    branch: "collection",
    name: "Сортировщики камня",
    prerequisites: ["labyrinth14"],
    cost: { orders: 0, shards: 750 },
    effectText: "+25% осколков с блока"
  },
  {
    id: "labyrinth16",
    number: 16,
    branch: "collection",
    name: "Магнитные крюки",
    prerequisites: ["labyrinth15"],
    cost: { orders: 0, shards: 1500 },
    effectText: "автосбор 50% блоков"
  },
  {
    id: "labyrinth17",
    number: 17,
    branch: "collection",
    name: "Камнедробильная площадка",
    prerequisites: ["labyrinth16"],
    cost: { orders: 0, shards: 3000 },
    effectText: "ещё +75% осколков с блока"
  },
  {
    id: "labyrinth18",
    number: 18,
    branch: "collection",
    name: "Автоматический сбор обломков",
    prerequisites: ["labyrinth17"],
    cost: { orders: 0, shards: 6000 },
    effectText: "автосбор 100% блоков"
  },
  {
    id: "labyrinth19",
    number: 19,
    branch: "maintenance",
    name: "Полевые плотники",
    prerequisites: ["labyrinth13"],
    cost: { orders: 0, shards: 150 },
    effectText: "ручной ремонт -25%"
  },
  {
    id: "labyrinth20",
    number: 20,
    branch: "maintenance",
    name: "Запасные детали",
    prerequisites: ["labyrinth19"],
    cost: { orders: 0, shards: 400 },
    effectText: "износ -15%"
  },
  {
    id: "labyrinth21",
    number: 21,
    branch: "maintenance",
    name: "Дежурные механики",
    prerequisites: ["labyrinth20"],
    cost: { orders: 0, shards: 1000 },
    effectText: "аварийное восстановление до состояния Повреждено"
  },
  {
    id: "labyrinth22",
    number: 22,
    branch: "maintenance",
    name: "Регламент обслуживания",
    prerequisites: ["labyrinth21"],
    cost: { orders: 0, shards: 2200 },
    effectText: "износ ещё -30%"
  },
  {
    id: "labyrinth23",
    number: 23,
    branch: "maintenance",
    name: "Автоматический ремонт",
    prerequisites: ["labyrinth22"],
    cost: { orders: 0, shards: 5000 },
    effectText: "авторемонт при наличии ресурса"
  },
  {
    id: "labyrinth24",
    number: 24,
    branch: "maintenance",
    name: "Гильдия механиков",
    prerequisites: ["labyrinth23"],
    cost: { orders: 0, shards: 9000 },
    effectText: "состояние не ниже Изношено"
  },
  {
    id: "labyrinth25",
    number: 25,
    branch: "quality",
    name: "Опытные расчёты",
    prerequisites: ["labyrinth07"],
    cost: { orders: 0, shards: 200 },
    effectText: "-5 п.п. плохого, +5 п.п. хорошего выстрела"
  },
  {
    id: "labyrinth26",
    number: 26,
    branch: "quality",
    name: "Пристрелка",
    prerequisites: ["labyrinth25"],
    cost: { orders: 0, shards: 600 },
    effectText: "+2 п.п. критического выстрела"
  },
  {
    id: "labyrinth27",
    number: 27,
    branch: "quality",
    name: "Дополнительный осадный слот I",
    prerequisites: ["labyrinth26"],
    cost: { orders: 0, shards: 800 },
    effectText: "+1 слот орудия"
  },
  {
    id: "labyrinth28",
    number: 28,
    branch: "quality",
    name: "Золотой стандарт гильдии",
    prerequisites: ["labyrinth27"],
    cost: { orders: 0, shards: 1800 },
    effectText: "+25% критического урона"
  },
  {
    id: "labyrinth29",
    number: 29,
    branch: "quality",
    name: "Дополнительный осадный слот II",
    prerequisites: ["labyrinth28"],
    cost: { orders: 0, shards: 3500 },
    effectText: "+1 слот орудия"
  },
  {
    id: "labyrinth30",
    number: 30,
    branch: "quality",
    name: "Совершенный залп",
    prerequisites: ["labyrinth29"],
    cost: { orders: 0, shards: 8000 },
    effectText: "после 10 выстрелов выбранному орудию гарантирован great/critical"
  }
];

test("labyrinth exports exactly 30 unique nodes with valid branches and graph edges", () => {
  assert.deepEqual(
    [...LABYRINTH_BRANCHES],
    ["root", "manual", "automation", "collection", "maintenance", "quality"]
  );
  assert.equal(LABYRINTH_NODES.length, 30);

  const ids = LABYRINTH_NODES.map((node) => node.id);
  const numbers = LABYRINTH_NODES.map((node) => node.number);
  assert.equal(new Set(ids).size, 30);
  assert.equal(new Set(numbers).size, 30);
  assert.deepEqual(
    numbers,
    Array.from({ length: 30 }, (_, index) => index + 1)
  );
  assert.deepEqual(
    ids,
    Array.from({ length: 30 }, (_, index) => `labyrinth${String(index + 1).padStart(2, "0")}`)
  );

  for (const expected of EXPECTED_NODES) {
    const actual = getLabyrinthNode(expected.id);
    assert.ok(actual, `missing node ${expected.id}`);
    assert.equal(actual.id, expected.id);
    assert.equal(actual.number, expected.number);
    assert.equal(actual.branch, expected.branch);
    assert.ok(VALID_BRANCHES.has(actual.branch));
    assert.equal(actual.name, expected.name);
    assert.deepEqual(actual.prerequisites, expected.prerequisites);
    assert.deepEqual(actual.cost, expected.cost);
    assert.equal(actual.effectText, expected.effectText);
    assert.deepEqual(Object.keys(actual).sort(), [
      "branch",
      "cost",
      "effectText",
      "id",
      "name",
      "number",
      "prerequisites"
    ]);
  }

  assert.deepEqual(getLabyrinthNode("labyrinth01").cost, { orders: 0, shards: 0 });
  assert.deepEqual(getLabyrinthNode("labyrinth02").cost, { orders: 0, shards: 25 });
  assert.deepEqual(getLabyrinthNode("labyrinth07").cost, { orders: 150, shards: 0 });
  assert.deepEqual(getLabyrinthNode("labyrinth11").cost, { orders: 0, shards: 1500 });
});

test("visibility with no purchases: root available, first branch nodes preview", () => {
  const purchased = [];
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth01"), "available");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth02"), "preview");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth07"), "preview");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth13"), "preview");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth03"), "hidden");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth19"), "hidden");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth25"), "hidden");

  const visible = getVisibleLabyrinthNodes(purchased);
  assert.deepEqual(
    visible.map((entry) => [entry.node.id, entry.status]),
    [
      ["labyrinth01", "available"],
      ["labyrinth02", "preview"],
      ["labyrinth07", "preview"],
      ["labyrinth13", "preview"]
    ]
  );
  assert.equal(purchased.length, 0);
});

test("visibility after purchasing root: branch heads available, next ring preview", () => {
  const purchased = ["labyrinth01"];
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth01"), "purchased");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth02"), "available");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth07"), "available");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth13"), "available");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth03"), "preview");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth08"), "preview");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth14"), "preview");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth19"), "preview");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth25"), "preview");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth04"), "hidden");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth09"), "hidden");

  const visible = getVisibleLabyrinthNodes(purchased);
  assert.deepEqual(
    visible.map((entry) => [entry.node.id, entry.status]),
    [
      ["labyrinth01", "purchased"],
      ["labyrinth02", "available"],
      ["labyrinth03", "preview"],
      ["labyrinth07", "available"],
      ["labyrinth08", "preview"],
      ["labyrinth13", "available"],
      ["labyrinth14", "preview"],
      ["labyrinth19", "preview"],
      ["labyrinth25", "preview"]
    ]
  );
  assert.deepEqual(purchased, ["labyrinth01"]);
});

test("deeper manual chain transitions purchased, available, preview, and hidden", () => {
  const purchased = ["labyrinth01", "labyrinth02", "labyrinth03"];
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth01"), "purchased");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth02"), "purchased");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth03"), "purchased");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth04"), "available");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth05"), "preview");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth06"), "hidden");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth07"), "available");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth08"), "preview");

  assert.deepEqual(
    getVisibleLabyrinthNodes(purchased).map((entry) => [entry.node.id, entry.status]),
    [
      ["labyrinth01", "purchased"],
      ["labyrinth02", "purchased"],
      ["labyrinth03", "purchased"],
      ["labyrinth04", "available"],
      ["labyrinth05", "preview"],
      ["labyrinth07", "available"],
      ["labyrinth08", "preview"],
      ["labyrinth13", "available"],
      ["labyrinth14", "preview"],
      ["labyrinth19", "preview"],
      ["labyrinth25", "preview"]
    ]
  );
});

test("unknown purchased and requested IDs are safe", () => {
  const purchased = ["labyrinth01", "not-a-node", "labyrinth99", "ghost"];
  assert.equal(getLabyrinthNode("labyrinth99"), null);
  assert.equal(getLabyrinthNode("missing"), null);
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth02"), "available");
  assert.equal(getLabyrinthNodeVisibility(purchased, "missing"), "hidden");
  assert.equal(getLabyrinthNodeVisibility(purchased, "labyrinth99"), "hidden");
  assert.doesNotThrow(() => getVisibleLabyrinthNodes(purchased));
  assert.deepEqual(purchased, ["labyrinth01", "not-a-node", "labyrinth99", "ghost"]);
});

test("exported public node data cannot be mutated by callers", () => {
  const node = getLabyrinthNode("labyrinth01");
  assert.throws(() => {
    node.name = "mutated";
  }, TypeError);
  assert.throws(() => {
    node.cost.orders = 999;
  }, TypeError);
  assert.throws(() => {
    node.prerequisites.push("labyrinth02");
  }, TypeError);
  assert.throws(() => {
    LABYRINTH_NODES.push(node);
  }, TypeError);
  assert.throws(() => {
    LABYRINTH_BRANCHES.push("extra");
  }, TypeError);

  assert.equal(getLabyrinthNode("labyrinth01").name, "Королевский приказ");
  assert.equal(getLabyrinthNode("labyrinth01").cost.orders, 0);
  assert.deepEqual(getLabyrinthNode("labyrinth01").prerequisites, []);
  assert.equal(LABYRINTH_NODES.length, 30);
  assert.equal(LABYRINTH_BRANCHES.length, 6);
});
