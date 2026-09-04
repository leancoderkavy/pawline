// One request at a time; hidden/offline pages do not consume feed requests.
export function startFeedRefresh({ load, onSuccess, onError, onLoading, interval = 60000, page = document, network = window }) {
  let stopped = false;
  let controller;
  let lastAttempt = 0;
  const refresh = async () => {
    if (stopped || controller || page.hidden || network.navigator.onLine === false) return;
    lastAttempt = Date.now();
    controller = new AbortController();
    onLoading?.();
    try {
      const value = await load(controller.signal);
      if (!stopped) onSuccess(value);
    } catch (error) {
      if (!stopped && error.name !== "AbortError") onError(error);
    } finally {
      controller = undefined;
    }
  };
  const resume = () => {
    if (Date.now() - lastAttempt >= 15000) void refresh();
  };
  const timer = setInterval(refresh, interval);
  page.addEventListener("visibilitychange", resume);
  network.addEventListener("online", resume);
  void refresh();
  return { refresh, stop() {
    stopped = true;
    controller?.abort();
    clearInterval(timer);
    page.removeEventListener("visibilitychange", resume);
    network.removeEventListener("online", resume);
  } };
}
