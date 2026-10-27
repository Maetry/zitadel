import { APPEARANCE_STYLES, SPACING_STYLES, getComponentRoundness, getThemeConfig } from "@/lib/theme";
import { clsx } from "clsx";
import { HTMLAttributes, ReactNode, forwardRef } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  roundness?: string; // Allow override via props
  padding?: string; // Allow override via props
}

// Helper function to get default card roundness from theme
function getDefaultCardRoundness(): string {
  return getComponentRoundness("card");
}

// Helper function to get default padding from centralized theme system
function getDefaultCardPadding(): string {
  const themeConfig = getThemeConfig();
  return SPACING_STYLES[themeConfig.spacing].padding;
}

// Helper function to get default background from centralized theme system
function getDefaultCardBackground(): string {
  const themeConfig = getThemeConfig();
  // MAETRY: Apple sign-in card: white on the gray page, #1c1c1e on the black one.
  if (themeConfig.appearance === "glass") {
    return "bg-white dark:bg-[#1c1c1e]";
  }
  const appearance = APPEARANCE_STYLES[themeConfig.appearance];

  // Use appearance-specific background if defined, otherwise fallback to material design (current system)
  return appearance?.background || "bg-background-light-400 dark:bg-background-dark-500";
}

// Helper function to get default card styling from centralized theme system
function getDefaultCardStyling(): string {
  const themeConfig = getThemeConfig();
  // MAETRY: Apple's soft two-layer shadow instead of the translucent glass fill; a shadow is
  // invisible on black, so dark mode gets a faint border instead.
  if (themeConfig.appearance === "glass") {
    return "border border-transparent dark:border-white/10 shadow-[0_2px_4px_rgba(0,0,0,0.12),0_2px_12px_rgba(0,0,0,0.08)] dark:shadow-none";
  }
  const appearance = APPEARANCE_STYLES[themeConfig.appearance];
  return appearance?.card || "shadow-sm border-0"; // Fallback to material design
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      className = "",
      roundness, // Will use theme default if not provided
      padding, // Will use theme default if not provided
      ...props
    },
    ref,
  ) => {
    // Use theme-based values if not explicitly provided
    const actualRoundness = roundness || getDefaultCardRoundness();
    const actualPadding = padding || getDefaultCardPadding();
    const actualBackground = getDefaultCardBackground();
    const actualCardStyling = getDefaultCardStyling();

    return (
      <div
        ref={ref}
        className={clsx(
          actualBackground,
          actualCardStyling,
          actualPadding,
          actualRoundness, // Apply the full roundness classes directly
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
