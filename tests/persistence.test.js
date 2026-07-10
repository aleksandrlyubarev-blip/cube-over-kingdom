import assert from "node:assert/strict";
import test from "node:test";
import { readSave, removeSave, writeSave } from "../src/persistence.js";

function createStorage(entries = []) {
  const values = new Map(entries);

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

test("save operations succeed with available storage", () => {
  const storage = createStorage([["slot", "old-save"]]);

  assert.deepEqual(readSave(() => storage, "slot"), {
    ok: true,
    value: "old-save"
  });
  assert.deepEqual(writeSave(() => storage, "slot", "new-save"), { ok: true });
  assert.deepEqual(readSave(() => storage, "slot"), {
    ok: true,
    value: "new-save"
  });
  assert.deepEqual(removeSave(() => storage, "slot"), { ok: true });
  assert.deepEqual(readSave(() => storage, "slot"), {
    ok: false,
    reason: "not-found"
  });
});

test("readSave reports a missing key", () => {
  const storage = createStorage();

  assert.deepEqual(readSave(() => storage, "missing"), {
    ok: false,
    reason: "not-found"
  });
});

test("storage getter failures are reported as unavailable", () => {
  const getStorage = () => {
    const error = new Error("storage access denied");
    error.name = "QuotaExceededError";
    throw error;
  };

  assert.deepEqual(readSave(getStorage, "slot"), {
    ok: false,
    reason: "unavailable"
  });
  assert.deepEqual(writeSave(getStorage, "slot", "save"), {
    ok: false,
    reason: "unavailable"
  });
  assert.deepEqual(removeSave(getStorage, "slot"), {
    ok: false,
    reason: "unavailable"
  });
});

test("storage method failures are reported as unavailable", () => {
  const unavailable = () => {
    throw new Error("storage unavailable");
  };

  assert.deepEqual(readSave(() => ({ getItem: unavailable }), "slot"), {
    ok: false,
    reason: "unavailable"
  });
  assert.deepEqual(
    writeSave(() => ({ setItem: unavailable }), "slot", "save"),
    { ok: false, reason: "unavailable" }
  );
  assert.deepEqual(removeSave(() => ({ removeItem: unavailable }), "slot"), {
    ok: false,
    reason: "unavailable"
  });
});

test("writeSave classifies quota errors by name or code", () => {
  const quotaErrors = [
    { name: "QuotaExceededError" },
    { code: 22 },
    { code: 1014 }
  ];

  for (const quotaError of quotaErrors) {
    const storage = {
      setItem() {
        throw quotaError;
      }
    };

    assert.deepEqual(writeSave(() => storage, "slot", "save"), {
      ok: false,
      reason: "quota"
    });
  }
});

test("serialized values pass through without parsing or modification", () => {
  const serialized = '  {"version":999,"future":true\n';
  let writtenValue;
  const storage = {
    getItem() {
      return serialized;
    },
    setItem(_key, value) {
      writtenValue = value;
    }
  };

  const readResult = readSave(() => storage, "slot");
  const writeResult = writeSave(() => storage, "slot", serialized);

  assert.equal(readResult.value, serialized);
  assert.equal(writtenValue, serialized);
  assert.deepEqual(writeResult, { ok: true });
});
