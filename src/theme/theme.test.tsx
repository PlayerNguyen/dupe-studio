import {
  ActionIcon,
  Button,
  MantineProvider,
  type MantineTheme,
} from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { cssVariablesResolver } from "./cssVariablesResolver";
import {
  BOUNCE_TIMING_FUNCTION,
  POPOVER_TRANSITION_DURATION,
  PRESS_FEEDBACK_CLASS,
  PRESS_FEEDBACK_DURATION,
  SMOOTH_TIMING_FUNCTION,
  SMOOTH_TRANSITION_DURATION,
  smoothTransition,
  TOOLTIP_TRANSITION_DURATION,
  theme,
} from "./theme";

describe("theme motion tokens", () => {
  it("exposes the shared curve and duration through theme.other", () => {
    expect(theme.other?.smoothTiming).toBe(SMOOTH_TIMING_FUNCTION);
    expect(theme.other?.transitionDuration).toBe(SMOOTH_TRANSITION_DURATION);
  });

  it("uses the sheet curve for every configured surface", () => {
    const transitionProps = [
      theme.components?.Modal?.defaultProps?.transitionProps,
      theme.components?.Drawer?.defaultProps?.transitionProps,
      theme.components?.Menu?.defaultProps?.transitionProps,
      theme.components?.Tooltip?.defaultProps?.transitionProps,
    ];

    expect(transitionProps).toHaveLength(4);
    for (const props of transitionProps) {
      expect(props.timingFunction).toBe(SMOOTH_TIMING_FUNCTION);
    }
  });
});

describe("theme component defaults", () => {
  it("fades modals down over the longest duration", () => {
    expect(theme.components?.Modal?.defaultProps?.transitionProps).toEqual({
      transition: "fade-down",
      duration: SMOOTH_TRANSITION_DURATION,
      timingFunction: SMOOTH_TIMING_FUNCTION,
    });
  });

  it("keeps the drawer's directional slide and only overrides the timing", () => {
    const transitionProps =
      theme.components?.Drawer?.defaultProps?.transitionProps;

    expect(transitionProps.duration).toBe(SMOOTH_TRANSITION_DURATION);
    expect(transitionProps.transition).toBeUndefined();
  });

  it("pops menus in faster than a modal", () => {
    expect(theme.components?.Menu?.defaultProps?.transitionProps).toEqual({
      transition: "pop-top-right",
      duration: POPOVER_TRANSITION_DURATION,
      timingFunction: SMOOTH_TIMING_FUNCTION,
    });
  });

  it("fades tooltips in fastest", () => {
    expect(theme.components?.Tooltip?.defaultProps?.transitionProps).toEqual({
      transition: "fade",
      duration: TOOLTIP_TRANSITION_DURATION,
      timingFunction: SMOOTH_TIMING_FUNCTION,
    });
  });

  it("shortens the duration as the surface gets closer to its trigger", () => {
    expect(SMOOTH_TRANSITION_DURATION).toBeGreaterThan(
      POPOVER_TRANSITION_DURATION,
    );
    expect(POPOVER_TRANSITION_DURATION).toBeGreaterThan(
      TOOLTIP_TRANSITION_DURATION,
    );
  });
});

describe("theme press feedback", () => {
  it("gives buttons the class the stylesheet animates", () => {
    expect(theme.components?.Button?.classNames?.root).toBe(
      PRESS_FEEDBACK_CLASS,
    );
    expect(theme.components?.ActionIcon?.classNames?.root).toBe(
      PRESS_FEEDBACK_CLASS,
    );
  });

  it("lands the class on the rendered elements", () => {
    render(
      <MantineProvider theme={theme}>
        <Button>Save</Button>
        <ActionIcon aria-label="Refresh" />
      </MantineProvider>,
    );

    expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
      PRESS_FEEDBACK_CLASS,
    );
    expect(screen.getByRole("button", { name: "Refresh" })).toHaveClass(
      PRESS_FEEDBACK_CLASS,
    );
  });

  it("springs back with an overshooting curve, faster than a modal", () => {
    expect(BOUNCE_TIMING_FUNCTION).not.toBe(SMOOTH_TIMING_FUNCTION);

    // cubic-bezier(x1, y1, x2, y2): y1 above 1 is what makes it overshoot.
    const controlPoints = BOUNCE_TIMING_FUNCTION.match(/-?\d*\.?\d+/g) ?? [];
    expect(Number(controlPoints[1])).toBeGreaterThan(1);

    // Pressing must feel immediate, so the squish is much shorter.
    expect(PRESS_FEEDBACK_DURATION).toBeLessThan(SMOOTH_TRANSITION_DURATION);
  });
});

describe("smoothTransition", () => {
  it("applies the shared duration and curve by default", () => {
    expect(smoothTransition()).toEqual({
      duration: SMOOTH_TRANSITION_DURATION,
      timingFunction: SMOOTH_TIMING_FUNCTION,
    });
  });

  it("lets a surface override the transition and duration", () => {
    expect(
      smoothTransition({
        transition: "fade",
        duration: TOOLTIP_TRANSITION_DURATION,
      }),
    ).toEqual({
      transition: "fade",
      duration: TOOLTIP_TRANSITION_DURATION,
      timingFunction: SMOOTH_TIMING_FUNCTION,
    });
  });
});

describe("cssVariablesResolver", () => {
  it("exposes the motion tokens as CSS custom properties", () => {
    const { variables } = cssVariablesResolver({} as MantineTheme);

    expect(variables?.["--dupe-smooth-timing"]).toBe(SMOOTH_TIMING_FUNCTION);
    expect(variables?.["--dupe-smooth-duration"]).toBe(
      `${SMOOTH_TRANSITION_DURATION}ms`,
    );
    expect(variables?.["--dupe-bounce-timing"]).toBe(BOUNCE_TIMING_FUNCTION);
    expect(variables?.["--dupe-press-duration"]).toBe(
      `${PRESS_FEEDBACK_DURATION}ms`,
    );
  });
});

describe("globals.css press feedback", () => {
  it("keeps the class name a plain identifier the stylesheet can target", () => {
    // The rules live in `src/globals.css` (they need `:active`); the constant's
    // doc comment and the stylesheet point at each other, and this asserts the
    // name is the one the stylesheet spells.
    expect(PRESS_FEEDBACK_CLASS).toBe("dupe-press-feedback");
  });
});
