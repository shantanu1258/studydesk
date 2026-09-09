import type { CSSProperties } from "react";
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
} from "../config/constants";
import type { LibrarySettings } from "../types/domain";

const colorPattern = /^#[0-9a-f]{6}$/i;

export const normalizeColor = (value: string | undefined, fallback: string) =>
  colorPattern.test(value || "") ? value!.toUpperCase() : fallback;

const readableText = (color: string) => {
  const value = normalizeColor(color, DEFAULT_PRIMARY_COLOR).slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 >= 150
    ? "#17202A"
    : "#FFFFFF";
};

export function libraryTheme(settings: Partial<LibrarySettings>) {
  const primary = normalizeColor(settings.primaryColor, DEFAULT_PRIMARY_COLOR);
  const secondary = normalizeColor(
    settings.secondaryColor,
    DEFAULT_SECONDARY_COLOR,
  );
  return {
    "--brand": primary,
    "--accent": secondary,
    "--button-text": readableText(primary),
    "--accent-text": readableText(secondary),
  } as CSSProperties;
}
