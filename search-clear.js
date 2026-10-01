(() => {
  const STYLE_ID = "watchlist-search-clear-style";
  const WRAPPER_CLASS = "search-clear-wrapper";
  const BUTTON_CLASS = "search-clear-button";

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${WRAPPER_CLASS} {
        position: relative;
        flex: 1;
        min-width: 260px;
        max-width: 470px;
      }

      .${WRAPPER_CLASS} .search {
        width: 100%;
        max-width: none;
        padding-right: 38px;
      }

      .${BUTTON_CLASS} {
        position: absolute;
        top: 50%;
        right: 9px;
        width: 24px;
        height: 24px;
        transform: translateY(-50%);
        display: grid;
        place-items: center;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        opacity: 0;
        pointer-events: none;
        transition: opacity .15s ease, color .15s ease, background .15s ease;
      }

      .${BUTTON_CLASS}.visible {
        opacity: 1;
        pointer-events: auto;
      }

      .${BUTTON_CLASS} svg {
        display: block;
        width: 12px;
        height: 12px;
        overflow: visible;
      }

      .${BUTTON_CLASS} line {
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
      }

      .${BUTTON_CLASS}:hover,
      .${BUTTON_CLASS}:focus-visible {
        color: var(--text);
        background: var(--panel2);
        outline: none;
      }

      @media (max-width: 650px) {
        .${WRAPPER_CLASS} {
          min-width: 220px;
          max-width: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function enhanceSearch() {
    const search = document.querySelector("#search");
    if (!search) return;

    if (search.closest("." + WRAPPER_CLASS)) {
      syncClearButton(search);
      return;
    }

    addStyles();

    const wrapper = document.createElement("div");
    wrapper.className = WRAPPER_CLASS;
    search.parentNode.insertBefore(wrapper, search);
    wrapper.appendChild(search);

    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = BUTTON_CLASS;
    clear.setAttribute("aria-label", "Clear search");
    clear.setAttribute("title", "Clear search");
    clear.innerHTML = `
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <line x1="2.5" y1="2.5" x2="9.5" y2="9.5"></line>
        <line x1="9.5" y1="2.5" x2="2.5" y2="9.5"></line>
      </svg>
    `;
    wrapper.appendChild(clear);

    clear.addEventListener("click", () => {
      search.value = "";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      requestAnimationFrame(() => search.focus());
    });

    search.addEventListener("input", () => syncClearButton(search));
    syncClearButton(search);
  }

  function syncClearButton(search) {
    const clear = search.closest("." + WRAPPER_CLASS)?.querySelector("." + BUTTON_CLASS);
    if (clear) clear.classList.toggle("visible", search.value.length > 0);
  }

  function start() {
    addStyles();

    let focusedSearch = false;
    let selectionStart = null;
    let selectionEnd = null;

    const rememberSearchFocus = () => {
      const search = document.querySelector("#search");
      if (search && document.activeElement === search) {
        focusedSearch = true;
        selectionStart = search.selectionStart;
        selectionEnd = search.selectionEnd;
      }
    };

    const restoreSearchFocus = () => {
      if (!focusedSearch) return;
      const search = document.querySelector("#search");
      if (!search) return;

      requestAnimationFrame(() => {
        search.focus({ preventScroll: true });
        if (selectionStart !== null && selectionEnd !== null) {
          const end = search.value.length;
          search.setSelectionRange(
            Math.min(selectionStart, end),
            Math.min(selectionEnd, end)
          );
        }
        focusedSearch = false;
        selectionStart = null;
        selectionEnd = null;
      });
    };

    enhanceSearch();

    const observer = new MutationObserver(() => {
      rememberSearchFocus();
      enhanceSearch();
      restoreSearchFocus();
    });

    observer.observe(document.getElementById("app") || document.body, {
      childList: true,
      subtree: true
    });

    document.addEventListener("input", rememberSearchFocus, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();