import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import { cn } from "@loams-plugins/core/ui";
import { Widget, previewWidget } from "../api";
import { composeChartOption, paramFilterFor } from "./chartOption";
import {
  LineChartIcon,
  BarChartIcon,
  PieChartIcon,
  SparklesIcon,
  EditIcon,
  TrashIcon,
} from "./Icons";

/* ------------------------------------------------------------- fragments */

/*
 * The visual tile.
 *
 * `group` on the root is what reveals the action row on hover; the previous
 * `.widget-card:hover .widget-actions.hover-visible` selector and the
 * `group-hover:` utility express the same rule.
 */
const CARD =
  "group flex h-full flex-col overflow-hidden rounded border border-line bg-card shadow-card";

const CARD_HEADER =
  "flex items-start justify-between gap-3 border-b border-line-subtle bg-card px-[1.15rem] pt-[0.95rem] pb-[0.65rem]";

const TITLE_AREA = "flex min-w-0 flex-1 flex-col gap-[0.2rem]";

const CARD_ICON =
  "inline-flex size-[26px] shrink-0 items-center justify-center rounded bg-primary-subtle text-primary [&_svg]:size-4";

const CARD_TITLE =
  "m-0 truncate font-['-apple-system','BlinkMacSystemFont','Segoe_UI',Roboto,sans-serif] text-[1.125rem] leading-[1.25] font-bold tracking-[-0.015em] text-ink";

/** Indented to sit under the title, level with the icon's baseline. */
const SUBTITLE_ROW = "flex items-center gap-[0.35rem] pl-[calc(26px+0.55rem)]";

const CARD_SUBTITLE = "truncate text-[0.8rem] leading-[1.3] font-medium text-ink-body";

const ACTION_BTN =
  "inline-flex cursor-pointer items-center gap-[0.25rem] rounded-[3px] border border-line bg-transparent px-[0.45rem] py-[0.2rem] text-[0.72rem] font-medium text-ink-body transition-all duration-150 hover:border-ink-muted hover:bg-page hover:text-ink";

/* The two washes are written out rather than interpolated: Tailwind scans
   source text for complete class names, so `bg-[${tint}]` would compile to
   nothing. See the same note in `ConsolePage`. */
const ACTION_BTN_DANGER =
  "border-[color-mix(in_srgb,var(--danger)_28%,var(--bg-card))] text-danger hover:border-danger hover:bg-[color-mix(in_srgb,var(--danger)_6%,var(--bg-card))]";

const CARD_BODY = "relative flex w-full flex-1 flex-col min-h-40 bg-plot";

/*
 * The chart's own canvas is painted from the theme's plot ink, and this overlay
 * sits on top of it while the option is still compiling.
 */
const STATE_OVERLAY =
  "absolute inset-0 z-5 flex flex-col items-center justify-center gap-3 bg-[color-mix(in_srgb,var(--bg-card)_90%,transparent)]";

const SPINNER =
  "size-6 rounded-full border-[2.5px] border-line-subtle border-t-primary animate-spin-slow";

interface WidgetCardProps {
  widget: Widget;
  editMode: boolean;
  isSelected: boolean;
  params?: Record<string, unknown>;
  onSelect: (widget: Widget) => void;
  onDelete: (widgetId: string) => void;
  onParamChange?: (name: string, value: unknown) => void;
  /**
   * True when a theme applies to this widget.
   *
   * The Power BI Light chrome below is the dashboard's own default styling. When
   * a theme is in play the server maps ThemeInk onto the ECharts option, and
   * overwriting its axis, grid, legend and tooltip colours here would undo
   * that mapping — so the colour-bearing blocks stand down. Structural tidying
   * (title suppression, grid padding, label formatters) stays either way: that
   * is chrome layout, not ink.
   */
  hasTheme?: boolean;
  /**
   * The dashboard-level theme selection, sent with the preview request so the
   * compiled option matches what the dashboard will actually render. A widget
   * with its own `flint.theme_spec` overrides this server-side.
   */
  dashboardTheme?: unknown;
}

export const WidgetCard: React.FC<WidgetCardProps> = ({
  widget,
  editMode,
  isSelected,
  params,
  onSelect,
  onDelete,
  onParamChange,
  hasTheme = false,
  dashboardTheme,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load preview data & compile option
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    previewWidget(widget, params, dashboardTheme)
      .then((res) => {
        if (!active) return;
        setLoading(false);

        if (chartRef.current) {
          if (!instanceRef.current) {
            instanceRef.current = echarts.init(chartRef.current);
          }

          const option = composeChartOption(res.option as Record<string, unknown>, hasTheme);

          instanceRef.current.setOption(option, true);

          // Attach interaction listener for cross-widget filtering
          instanceRef.current.off("click");
          instanceRef.current.on(
            "click",
            (params: { data?: Record<string, unknown>; name?: unknown }) => {
              if (onParamChange) {
                const filter = paramFilterFor(widget, params);
                for (const [paramName, value] of Object.entries(filter)) {
                  onParamChange(paramName, value);
                }
              }
            },
          );
        }
      })
      .catch((err) => {
        if (!active) return;
        setLoading(false);
        setError(err.message || "Failed to render chart");
      });

    return () => {
      active = false;
    };
  }, [widget, JSON.stringify(params), hasTheme]);

  // Handle Resize
  useEffect(() => {
    if (!chartRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      instanceRef.current?.resize();
    });
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      if (instanceRef.current) {
        instanceRef.current.dispose();
        instanceRef.current = null;
      }
    };
  }, []);

  const overrides = (widget.chart?.optionOverrides as any) || {};
  const title =
    overrides?.title?.text ||
    widget.flint?.title ||
    (widget.chart?.kind ? `${widget.chart.kind.toUpperCase()} Chart` : "Chart Widget");

  const subtitle =
    overrides?.title?.subtext ||
    widget.flint?.subtitle ||
    (widget.data?.datasetId ? `Dataset #${widget.data.datasetId}` : "");

  const renderChartIcon = () => {
    if (widget.flint) return <SparklesIcon />;
    const kind = widget.chart?.kind;
    if (kind === "bar") return <BarChartIcon />;
    if (kind === "pie") return <PieChartIcon />;
    return <LineChartIcon />;
  };

  return (
    <div
      className={cn(
        CARD,
        "transition-[border-color,box-shadow] duration-150",
        "hover:border-line-subtle hover:shadow-hover",
        isSelected && "border-primary shadow-[0_0_0_2px_var(--primary-subtle)]",
      )}
      onClick={() => editMode && onSelect(widget)}
    >
      <div className={CARD_HEADER}>
        <div className={TITLE_AREA}>
          <div className="flex items-center gap-[0.55rem]">
            <span className={CARD_ICON}>{renderChartIcon()}</span>
            <h3 className={CARD_TITLE} title={title}>
              {title}
            </h3>
          </div>
          {subtitle && (
            <div className={SUBTITLE_ROW}>
              <span className={CARD_SUBTITLE} title={subtitle}>
                {subtitle}
              </span>
            </div>
          )}
        </div>

        {/*
         * Hover-revealed in read mode, always shown in edit mode -- `group` on
         * the card above is what reveals it, and the two variants differ only
         * in whether they start at zero.
         */}
        <div
          className={cn(
            "flex shrink-0 items-center gap-[0.35rem]",
            editMode
              ? "opacity-100"
              : "opacity-0 transition-opacity duration-150 group-hover:opacity-100",
          )}
        >
          <button
            type="button"
            className={ACTION_BTN}
            title="Edit Widget"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(widget);
            }}
          >
            <EditIcon />
            <span>Edit</span>
          </button>
          <button
            type="button"
            className={cn(ACTION_BTN, ACTION_BTN_DANGER)}
            title="Delete Widget"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(widget.id);
            }}
          >
            <TrashIcon />
            <span>Remove</span>
          </button>
        </div>
      </div>

      <div className={CARD_BODY}>
        {loading && (
          <div className={STATE_OVERLAY}>
            <div className={SPINNER} />
          </div>
        )}
        {error && (
          <div className={STATE_OVERLAY}>
            <span className="text-[0.85rem] text-danger">{error}</span>
          </div>
        )}

        <div
          ref={chartRef}
          className="h-full w-full flex-1"
          style={{ opacity: loading || error ? 0 : 1 }}
        />
      </div>
    </div>
  );
};
