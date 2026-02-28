"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ECharts, EChartsOption } from "echarts";

const MAP_NAME = "china-city-level";
const MAP_DATA_PATH = "/maps/china-city-level.geojson";

type TravelMark = {
  adcode: number;
  name: string;
};

type TravelMapProps = {
  marks: TravelMark[];
  editable?: boolean;
  onToggle?: (adcode: number, name: string) => void;
  onCityCountChange?: (count: number) => void;
};

type GeoFeature = {
  properties?: {
    name?: string;
    displayName?: string;
    adcode?: number;
  };
};

type GeoJson = {
  features?: GeoFeature[];
};

function detectDarkTheme() {
  if (typeof window === "undefined") return false;
  const mode = document.documentElement.getAttribute("data-theme");
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readPalette(isDark: boolean) {
  if (typeof window === "undefined") {
    return {
      mapBackground: "transparent",
      cityDefault: isDark ? "#243243" : "#edf2f8",
      cityVisited: isDark ? "#7fa6df" : "#5c84bf",
      cityHover: isDark ? "#9abce8" : "#6f96cc",
      cityBorder: isDark ? "#4a627f" : "#9ab0c8"
    };
  }

  const styles = window.getComputedStyle(document.documentElement);
  const getColor = (name: string, fallback: string) => {
    const value = styles.getPropertyValue(name).trim();
    return value || fallback;
  };

  return {
    mapBackground: "transparent",
    cityDefault: getColor("--travel-city-bg", isDark ? "#243243" : "#edf2f8"),
    cityVisited: getColor("--travel-city-visited", isDark ? "#7fa6df" : "#5c84bf"),
    cityHover: getColor("--travel-city-hover", isDark ? "#9abce8" : "#6f96cc"),
    cityBorder: getColor("--travel-city-border", isDark ? "#4a627f" : "#9ab0c8")
  };
}

export function TravelMap({ marks, editable = false, onToggle, onCityCountChange }: TravelMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const cityNameMapRef = useRef<Record<string, string>>({});

  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [isDark, setIsDark] = useState(false);

  const visitedSet = useMemo(() => {
    const set = new Set<string>();
    for (const mark of marks) {
      set.add(String(mark.adcode));
    }
    return set;
  }, [marks]);

  useEffect(() => {
    setIsDark(detectDarkTheme());

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMediaChange = () => setIsDark(detectDarkTheme());
    const observer = new MutationObserver(() => setIsDark(detectDarkTheme()));

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });
    media.addEventListener("change", onMediaChange);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", onMediaChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let clickHandler: ((params: { name?: string }) => void) | null = null;
    let resizeHandler: (() => void) | null = null;

    (async () => {
      try {
        const [echartsModule, mapResponse] = await Promise.all([
          import("echarts"),
          fetch(MAP_DATA_PATH, { cache: "force-cache" })
        ]);

        if (!mapResponse.ok) {
          throw new Error(`failed to load map: ${mapResponse.status}`);
        }

        const mapJson = (await mapResponse.json()) as GeoJson;
        const nameMap: Record<string, string> = {};
        const features = Array.isArray(mapJson.features) ? mapJson.features : [];
        for (const feature of features) {
          const props = feature.properties || {};
          const code = String(props.name || props.adcode || "");
          const displayName = String(props.displayName || code);
          if (code) nameMap[code] = displayName;
        }

        if (cancelled) return;

        cityNameMapRef.current = nameMap;
        onCityCountChange?.(Object.keys(nameMap).length);

        echartsModule.registerMap(MAP_NAME, mapJson as never);

        if (!containerRef.current) return;

        const chart = echartsModule.init(containerRef.current);
        chartRef.current = chart;

        clickHandler = (params) => {
          if (!editable) return;
          const code = String(params.name || "");
          const adcode = Number(code);
          if (!Number.isInteger(adcode)) return;
          const name = cityNameMapRef.current[code] || code;
          onToggle?.(adcode, name);
        };

        chart.on("click", clickHandler);

        resizeHandler = () => chart.resize();
        window.addEventListener("resize", resizeHandler);

        setReady(true);
        setError("");
      } catch {
        if (cancelled) return;
        setError("地图加载失败，请稍后刷新重试。");
      }
    })();

    return () => {
      cancelled = true;
      const chart = chartRef.current;
      if (chart && clickHandler) {
        chart.off("click", clickHandler);
      }
      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
      }
      if (chart) {
        chart.dispose();
      }
      chartRef.current = null;
      setReady(false);
    };
  }, [editable, onToggle, onCityCountChange]);

  useEffect(() => {
    if (!ready) return;
    const chart = chartRef.current;
    if (!chart) return;

    const palette = readPalette(isDark);
    const cityNameMap = cityNameMapRef.current;
    const data = Object.entries(cityNameMap).map(([code, displayName]) => ({
      name: code,
      displayName,
      value: visitedSet.has(code) ? 1 : 0,
      itemStyle: {
        areaColor: visitedSet.has(code) ? palette.cityVisited : palette.cityDefault
      }
    }));

    const option: EChartsOption = {
      backgroundColor: palette.mapBackground,
      tooltip: {
        trigger: "item",
        formatter: (params: unknown) => {
          const payload = params as {
            data?: { displayName?: string; value?: number | string };
            name?: string | number;
          };
          const name = payload.data?.displayName || cityNameMap[String(payload.name || "")] || "未知区域";
          const visited = Number(payload.data?.value || 0) > 0;
          return `${name}<br/>${visited ? "已去过" : "没去过"}`;
        }
      },
      series: [
        {
          name: "travel",
          type: "map",
          map: MAP_NAME,
          roam: true,
          selectedMode: false,
          zoom: 1,
          scaleLimit: {
            min: 1,
            max: 8
          },
          label: {
            show: false
          },
          itemStyle: {
            borderColor: palette.cityBorder,
            borderWidth: 0.8
          },
          emphasis: {
            label: {
              show: false
            },
            itemStyle: {
              areaColor: palette.cityHover
            }
          },
          data
        }
      ]
    };

    chart.setOption(option, true);
  }, [isDark, ready, visitedSet]);

  return (
    <div className="travel-map-shell">
      {error ? (
        <div className="notice">{error}</div>
      ) : (
        <div ref={containerRef} className="travel-map-canvas" aria-label="中国旅行地图" />
      )}
    </div>
  );
}
