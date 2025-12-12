(function () {
  // Minimal allowlist-sanitizer för Quill HTML:
  // Tillåter vanliga text-taggar + länkar. Tar bort script/style/event-handlers.
  const ALLOWED = new Set([
    "P","BR","STRONG","B","EM","I","U",
    "UL","OL","LI",
    "A",
    "BLOCKQUOTE",
    "H1","H2","H3",
    "SPAN","DIV"
  ]);

  const ALLOWED_ATTR = {
    "A": new Set(["href","target","rel"]),
    "SPAN": new Set(["class"]),
    "DIV": new Set(["class"]),
    "*": new Set([])
  };

  function sanitizeHtml(input) {
    if (!input || typeof input !== "string") return "";
    const tpl = document.createElement("template");
    tpl.innerHTML = input;

    const walk = (node) => {
      const children = Array.from(node.childNodes);
      for (const child of children) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName.toUpperCase();

          // Drop forbidden tags
          if (!ALLOWED.has(tag)) {
            // Replace element with its text content (preserve readable content)
            const text = document.createTextNode(child.textContent || "");
            child.replaceWith(text);
            continue;
          }

          // Remove event handlers + disallowed attrs
          const allowedForTag = ALLOWED_ATTR[tag] || ALLOWED_ATTR["*"];
          for (const attr of Array.from(child.attributes)) {
            const name = attr.name.toLowerCase();
            const isEvent = name.startsWith("on");
            if (isEvent) { child.removeAttribute(attr.name); continue; }

            if (!(allowedForTag.has(attr.name) || (ALLOWED_ATTR["*"] && ALLOWED_ATTR["*"].has(attr.name)))) {
              // keep href/target/rel etc only on allowed tags
              child.removeAttribute(attr.name);
            }
          }

          // Special-case links
          if (tag === "A") {
            const href = child.getAttribute("href") || "";
            if (!href || href.trim().startsWith("javascript:")) {
              child.removeAttribute("href");
            } else {
              child.setAttribute("target", "_blank");
              child.setAttribute("rel", "noopener noreferrer");
            }
          }

          walk(child);
        } else if (child.nodeType === Node.COMMENT_NODE) {
          child.remove();
        } else if (child.nodeType === Node.TEXT_NODE) {
          // ok
        } else {
          // drop others
          child.remove();
        }
      }
    };

    walk(tpl.content);
    return tpl.innerHTML;
  }

  window.RR_SANITIZE = { sanitizeHtml };
})();
