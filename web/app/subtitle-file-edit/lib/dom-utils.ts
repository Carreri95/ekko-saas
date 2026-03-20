/** Scroll apenas dentro do painel da lista — não move o documento (window). */
export function scrollCueIntoListPanel(cueEl: HTMLElement, container: HTMLElement) {
  const elRect = cueEl.getBoundingClientRect();
  const cRect = container.getBoundingClientRect();
  const elTopWithinContent = elRect.top - cRect.top + container.scrollTop;
  const targetTop = elTopWithinContent - container.clientHeight / 2 + elRect.height / 2;
  container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
}

export function isCueVisibleInListPanel(
  cueEl: HTMLElement,
  container: HTMLElement,
  margin = 8,
): boolean {
  const elRect = cueEl.getBoundingClientRect();
  const cRect = container.getBoundingClientRect();
  return elRect.top >= cRect.top + margin && elRect.bottom <= cRect.bottom - margin;
}
