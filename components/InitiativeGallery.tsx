import { Fragment, useState, type ReactElement } from "react";

const rowSizes = [2, 3, 4];

export function InitiativeGallery({ cards }: { cards: ReactElement[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const activeIndex = focusedIndex ?? hoveredIndex;

  return (
    <div className="initiative-gallery" onPointerLeave={() => setHoveredIndex(null)}>
      {cards.map((card, index) => {
        const rowBreaks = rowSizes.filter((size) => index % size === 0);
        const peers =
          activeIndex === null || index === activeIndex
            ? []
            : rowSizes.filter(
                (size) => Math.floor(index / size) === Math.floor(activeIndex / size),
              );

        return (
          <Fragment key={card.key ?? index}>
            {index > 0 && rowBreaks.length > 0 && (
              <span className="initiative-row-break" data-break={rowBreaks.join(" ")} aria-hidden="true" />
            )}
            <div
              className="initiative-slot"
              data-active={activeIndex === index ? "" : undefined}
              data-row-peer={peers.length ? peers.join(" ") : undefined}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse" || event.pointerType === "pen") {
                  setHoveredIndex(index);
                }
              }}
              onFocus={(event) => {
                if (event.target.matches(":focus-visible")) setFocusedIndex(index);
              }}
              onBlur={() => setFocusedIndex(null)}
            >
              {card}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
