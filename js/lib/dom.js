// Small element factory. Text always goes in as text nodes or textContent,
// never as HTML.
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'style') {
      for (const [property, styleValue] of Object.entries(value)) el.style.setProperty(property, styleValue);
    } else if (key === 'dataset') Object.assign(el.dataset, value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }

  el.append(...children.flat(Infinity).filter((child) => child != null && child !== false));
  return el;
}
