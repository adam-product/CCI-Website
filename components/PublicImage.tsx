import type { ComponentPropsWithoutRef } from "react";

type PublicImageProps = Omit<ComponentPropsWithoutRef<"img">, "draggable" | "onContextMenu">;

export function PublicImage(props: PublicImageProps) {
  return (
    <img
      {...props}
      draggable={false}
      onContextMenu={(event) => event.preventDefault()}
    />
  );
}
