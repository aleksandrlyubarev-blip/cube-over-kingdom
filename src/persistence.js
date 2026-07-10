export function readSave(getStorage, key) {
  try {
    const value = getStorage().getItem(key);

    if (value === null) {
      return { ok: false, reason: "not-found" };
    }

    return { ok: true, value };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export function writeSave(getStorage, key, serialized) {
  let storage;

  try {
    storage = getStorage();
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  try {
    storage.setItem(key, serialized);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: isQuotaExceededError(error) ? "quota" : "unavailable"
    };
  }
}

export function removeSave(getStorage, key) {
  try {
    getStorage().removeItem(key);
    return { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

function isQuotaExceededError(error) {
  let name;
  let code;

  try {
    name = error?.name;
  } catch {
    name = undefined;
  }

  try {
    code = error?.code;
  } catch {
    code = undefined;
  }

  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    code === 22 ||
    code === 1014 ||
    code === "22" ||
    code === "1014"
  );
}
