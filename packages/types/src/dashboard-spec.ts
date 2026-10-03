import { z } from "zod";
import { ThemeSelectionSchema } from "./theme-spec.js";

export const InteractionSchema = z.object({
  on: z.enum(["click", "brush"]),
  set: z.record(z.string(), z.string()),
});
export type Interaction = z.infer<typeof InteractionSchema>;

export const FlintSpecSchema = z.object({
  chartType: z.string(),
  encodings: z.record(
    z.string(),
    z.union([
      z.string(),
      z.object({
        field: z.string(),
        type: z.string().optional(),
        aggregate: z.string().optional(),
      }),
    ]),
  ),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  baseSize: z
    .object({
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  chartProperties: z.record(z.string(), z.unknown()).optional(),
  theme_spec: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
});
export type FlintSpec = z.infer<typeof FlintSpecSchema>;

export const ChartSchema = z.object({
  kind: z.enum(["line", "bar", "pie", "scatter", "heatmap", "funnel", "sankey", "area", "custom"]),
  encode: z.object({
    x: z.union([z.string(), z.array(z.string())]).optional(),
    y: z.union([z.string(), z.array(z.string())]).optional(),
    series: z.union([z.string(), z.array(z.string())]).optional(),
    value: z.union([z.string(), z.array(z.string())]).optional(),
  }),
  optionOverrides: z.record(z.string(), z.unknown()).optional(),
});
export type Chart = z.infer<typeof ChartSchema>;

export const DataSourceSchema = z.object({
  source: z.literal("superset"),
  datasetId: z.number().nullable().optional(),
  sql: z.string().nullable().optional(),
  params: z.array(z.string()).optional(),
});
export type DataSource = z.infer<typeof DataSourceSchema>;

const WidgetBaseSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["chart", "kpi", "table", "text", "filter"]),
  data: DataSourceSchema.optional(),
  flint: FlintSpecSchema.optional(),
  chart: ChartSchema.optional(),
  interactions: z.array(InteractionSchema).optional(),
});

export const WidgetSchema = WidgetBaseSchema.refine(
  (data) => {
    if (data.type === "chart") {
      const hasFlint = data.flint !== undefined;
      const hasChart = data.chart !== undefined;
      return (hasFlint && !hasChart) || (!hasFlint && hasChart);
    }
    return true;
  },
  {
    message: "Chart widgets must have exactly one of 'flint' or 'chart' defined.",
  },
);
export type Widget = z.infer<typeof WidgetSchema>;

export const LayoutItemSchema = z.object({
  id: z.string().min(1),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1),
});
export type LayoutItem = z.infer<typeof LayoutItemSchema>;

export const ParamSchema = z.object({
  name: z.string(),
  type: z.enum(["string", "number", "date", "daterange", "select"]),
  default: z.unknown().optional(),
  datasetId: z.number().optional(),
  column: z.string().optional(),
});
export type Param = z.infer<typeof ParamSchema>;

export const DashboardSpecSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().min(0),
  title: z.string().min(1).max(255),
  params: z.array(ParamSchema),
  layout: z.array(LayoutItemSchema),
  widgets: z.record(z.string(), WidgetSchema),
  /**
   * The default visual theme for every widget on this dashboard.
   *
   * PRECEDENCE: a per-widget `flint.theme_spec` (see `FlintSpecSchema` above)
   * WINS over this field. That one is a per-widget override authored alongside
   * the chart spec, so it is the more specific statement; this field is the
   * house the dashboard was built in, and applies to every widget that does not
   * override it. Resolve the effective pair through
   * `ctx.flint.resolveWidgetTheme(widget, dashboardSpec.theme)` rather than
   * reading either field directly.
   *
   * Omitting it means "no theme", which is a real renderable state: flint's own
   * defaults apply.
   */
  theme: ThemeSelectionSchema.optional(),
});
export type DashboardSpec = z.infer<typeof DashboardSpecSchema>;
