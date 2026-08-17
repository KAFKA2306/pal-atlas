export function updateSearchState(search, state) {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(state)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return params.toString();
}

function replaceUrl(state) {
  const search = updateSearchState(window.location.search, state);
  const url = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", url);
}

if (typeof document !== "undefined") {
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;

    if (event.target.closest("#pair-search")) {
      replaceUrl({
        parentA: document.querySelector("#parent-a")?.value ?? "",
        parentB: document.querySelector("#parent-b")?.value ?? "",
        target: "",
      });
      return;
    }

    if (event.target.closest("#target-search")) {
      replaceUrl({
        parentA: "",
        parentB: "",
        target: document.querySelector("#target")?.value ?? "",
      });
    }
  });
}
