"use client";

import React, { useState, useEffect, useRef } from "react";
import SimulationChart from "@/components/SimulationChart";
import PeriodDistributionChart from "@/components/PeriodDistributionChart";
import { toPng, toJpeg } from "html-to-image";

interface TimePeriodMultipliers {
  Night: number;
  Morning: number;
  Afternoon: number;
  Evening: number;
}

interface SimulationConfig {
  UNPROMPTED_CHANCE_BUILD_AMOUNT: number;
  UNPROMPTED_ROLL_INTERVAL_SECONDS: number;
  UNPROMPTED_CHANCE_BUILD_INTERVAL_SECONDS: number;
  unpromptedTimePeriods_multipliers: TimePeriodMultipliers;
}

interface SimulationResultItem {
  time_bin: string;
  mean_messages: number;
  std_dev_messages: number;
  total_messages_in_bin: number;
  percentage_of_total: number;
  active_multiplier_period: string;
  active_multiplier_value: number;
}

interface BinomialDistributionPoint {
  messages: number;
  probability: number;
}

interface PeriodDistributionData {
  distribution: BinomialDistributionPoint[];
  expected_messages: number;
  std_dev: number;
  rel_variation: number;
  n_trials: number;
  p_success: number;
}

interface AllPeriodDistributions {
  Night: PeriodDistributionData;
  Morning: PeriodDistributionData;
  Afternoon: PeriodDistributionData;
  Evening: PeriodDistributionData;
  error?: string;
  type?: string;
}

const initialConfig: SimulationConfig = {
  UNPROMPTED_CHANCE_BUILD_AMOUNT: 0.2,
  UNPROMPTED_ROLL_INTERVAL_SECONDS: 300,
  UNPROMPTED_CHANCE_BUILD_INTERVAL_SECONDS: 300,
  unpromptedTimePeriods_multipliers: {
    Night: 1.0,
    Morning: 6.0,
    Afternoon: 8.4,
    Evening: 10.5,
  },
};

export interface ThemeColors {
  name: string;
  backgroundColor: string;
  textColor: string;
  gridColor: string;
  tooltipBg: string;
  tooltipColor: string;
  barColor: string;
  sdLineColor: string;
  inputBgColor: string;
  inputBorderColor: string;
  inputTextColor: string;
  buttonBgColor: string;
  buttonTextColor: string;
}

const offWhiteThemeValues = {
  textColor: "#333333",
  inputBgColor: "#ffffff",
  inputBorderColor: "#cccccc",
  inputTextColor: "#333333",
};

const defaultThemes: ThemeColors[] = [
  {
    name: "Dark",
    backgroundColor: "#1a1a1a",
    textColor: "#e0e0e0",
    gridColor: "#444444",
    tooltipBg: "#333333",
    tooltipColor: "#e0e0e0",
    barColor: "#3498db",
    sdLineColor: "#e74c3c",
    inputBgColor: offWhiteThemeValues.inputBgColor,
    inputBorderColor: offWhiteThemeValues.inputBorderColor,
    inputTextColor: offWhiteThemeValues.inputTextColor,
    buttonBgColor: "#3498db",
    buttonTextColor: "#ffffff",
  },
  {
    name: "Black",
    backgroundColor: "#000000",
    textColor: "#f0f0f0",
    gridColor: "#333333",
    tooltipBg: "#222222",
    tooltipColor: "#f0f0f0",
    barColor: "#58a6ff",
    sdLineColor: "#ff7b72",
    inputBgColor: offWhiteThemeValues.inputBgColor,
    inputBorderColor: offWhiteThemeValues.inputBorderColor,
    inputTextColor: offWhiteThemeValues.inputTextColor,
    buttonBgColor: "#58a6ff",
    buttonTextColor: "#ffffff",
  },
  {
    name: "Off-White",
    backgroundColor: "#f8f0e3",
    textColor: "#333333",
    gridColor: "#dddddd",
    tooltipBg: "#ffffff",
    tooltipColor: "#333333",
    barColor: "#2980b9",
    sdLineColor: "#c0392b",
    inputBgColor: "#ffffff",
    inputBorderColor: "#cccccc",
    inputTextColor: "#333333",
    buttonBgColor: "#2980b9",
    buttonTextColor: "#ffffff",
  },
  {
    name: "Pastel Blue",
    backgroundColor: "#e0f2f7",
    textColor: "#265073",
    gridColor: "#b3cde0",
    tooltipBg: "#ffffff",
    tooltipColor: "#265073",
    barColor: "#6497b1",
    sdLineColor: "#ff7878",
    inputBgColor: "#ffffff",
    inputBorderColor: "#b3cde0",
    inputTextColor: "#265073",
    buttonBgColor: "#6497b1",
    buttonTextColor: "#ffffff",
  },
  {
    name: "Pastel Pink",
    backgroundColor: "#fce4ec",
    textColor: "#8c2f4f",
    gridColor: "#f4bac0",
    tooltipBg: "#ffffff",
    tooltipColor: "#8c2f4f",
    barColor: "#f06292",
    sdLineColor: "#7e57c2",
    inputBgColor: "#ffffff",
    inputBorderColor: "#f4bac0",
    inputTextColor: "#8c2f4f",
    buttonBgColor: "#f06292",
    buttonTextColor: "#ffffff",
  },
  {
    name: "Pastel Green",
    backgroundColor: "#e8f5e9",
    textColor: "#2e7d32",
    gridColor: "#c8e6c9",
    tooltipBg: "#ffffff",
    tooltipColor: "#2e7d32",
    barColor: "#66bb6a",
    sdLineColor: "#ef5350",
    inputBgColor: "#ffffff",
    inputBorderColor: "#c8e6c9",
    inputTextColor: "#2e7d32",
    buttonBgColor: "#66bb6a",
    buttonTextColor: "#ffffff",
  },
];

const initialCustomTheme: ThemeColors = {
  name: "My Custom Theme",
  backgroundColor: "#eeeeee",
  textColor: "#111111",
  gridColor: "#cccccc",
  tooltipBg: "#fefefe",
  tooltipColor: "#111111",
  barColor: "#8884d8",
  sdLineColor: "#82ca9d",
  inputBgColor: "#ffffff",
  inputBorderColor: "#bbbbbb",
  inputTextColor: "#111111",
  buttonBgColor: "#777777",
  buttonTextColor: "#ffffff",
};

const HomePage = () => {
  const [config, setConfig] = useState<SimulationConfig>(initialConfig);
  const [numDays, setNumDays] = useState<number>(10);
  const [binsPer24h, setBinsPer24h] = useState<number>(24);
  const [simulationResults, setSimulationResults] = useState<SimulationResultItem[] | null>(null);
  const [periodDistributionResults, setPeriodDistributionResults] = useState<AllPeriodDistributions | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<"mainSimulation" | "periodDistribution">("mainSimulation");
  const [allThemes, setAllThemes] = useState<ThemeColors[]>(defaultThemes);
  const [activeTheme, setActiveTheme] = useState<ThemeColors>(defaultThemes[2]);
  const [customThemeEdit, setCustomThemeEdit] = useState<ThemeColors>(initialCustomTheme);
  const [showCustomThemeEditor, setShowCustomThemeEditor] = useState<boolean>(false);

  const chartRef = useRef<HTMLDivElement>(null);
  const periodChartsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const storedCustomThemes = localStorage.getItem("customThemes");
      if (storedCustomThemes) {
        const parsedCustomThemes: ThemeColors[] = JSON.parse(storedCustomThemes);
        const ensuredCustomThemes = parsedCustomThemes.map((theme) => ({
          ...initialCustomTheme,
          ...theme,
          name: theme.name || initialCustomTheme.name,
        }));
        setAllThemes([...defaultThemes, ...ensuredCustomThemes]);
      }
    } catch (e) {
      console.error("[HomePage DBG] Failed to load custom themes:", e);
    }
  }, []);

  useEffect(() => {
    document.body.style.backgroundColor = activeTheme.backgroundColor;
    document.body.style.color = activeTheme.textColor;
  }, [activeTheme]);

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const parsedValue = type === "number" ? parseFloat(value) : value;
    if (name.startsWith("multiplier_")) {
      const period = name.split("_")[1] as keyof TimePeriodMultipliers;
      setConfig((prev) => ({ ...prev, unpromptedTimePeriods_multipliers: { ...prev.unpromptedTimePeriods_multipliers, [period]: parsedValue as number } }));
    } else {
      setConfig((prev) => ({ ...prev, [name]: parsedValue }));
    }
  };

  const handleCustomThemeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCustomThemeEdit((prev) => ({ ...prev, [name]: value }));
  };

  const saveCustomTheme = () => {
    if (!customThemeEdit.name.trim()) {
      alert("Custom theme name cannot be empty.");
      return;
    }
    const themeToSave = { ...initialCustomTheme, ...customThemeEdit };
    let updatedCustomThemes: ThemeColors[];
    const existingThemeIndex = allThemes.findIndex((t) => t.name === themeToSave.name && !defaultThemes.some((dt) => dt.name === t.name));
    if (existingThemeIndex > -1) {
      updatedCustomThemes = allThemes.map((t) => (t.name === themeToSave.name ? themeToSave : t));
    } else {
      if (allThemes.some((theme) => theme.name === themeToSave.name)) {
        alert("A theme with this name already exists. Please choose a different name.");
        return;
      }
      updatedCustomThemes = [...allThemes, themeToSave];
    }
    const customThemesOnly = updatedCustomThemes.filter((theme) => !defaultThemes.some((dt) => dt.name === theme.name));
    localStorage.setItem("customThemes", JSON.stringify(customThemesOnly));
    setAllThemes([...defaultThemes, ...customThemesOnly]);
    setActiveTheme(themeToSave);
    setShowCustomThemeEditor(false);
    alert("Custom theme saved!");
  };

  const deleteCustomTheme = (themeName: string) => {
    if (defaultThemes.some((t) => t.name === themeName)) {
      alert("Cannot delete default themes.");
      return;
    }
    const updatedCustomThemes = allThemes.filter((t) => t.name !== themeName && !defaultThemes.some((dt) => dt.name === t.name));
    localStorage.setItem("customThemes", JSON.stringify(updatedCustomThemes));
    setAllThemes([...defaultThemes, ...updatedCustomThemes]);
    if (activeTheme.name === themeName) {
      setActiveTheme(defaultThemes[2]);
    }
    alert(`Theme "${themeName}" deleted.`);
  };

  const runCurrentSimulation = async () => {
    console.log("[HomePage DBG] runCurrentSimulation called. Current view:", currentView);
    setIsLoading(true);
    setError(null);
    setSimulationResults(null);
    setPeriodDistributionResults(null);

    let payload;
    if (currentView === "mainSimulation") {
      payload = {
        config: config,
        num_days_to_simulate: numDays,
        bins_per_24h: binsPer24h,
        calculation_type: "main_simulation",
      };
    } else {
      payload = {
        config: config,
        calculation_type: "period_distribution",
      };
    }
    console.log("[HomePage DBG] Payload to be sent to API:", JSON.stringify(payload, null, 2));

    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      // CRITICAL LOGGING FOR RAW RESPONSE:
      const rawResponseText = await response.text();
      console.log("[HomePage DBG] Raw response text from API:", rawResponseText);

      let data;
      try {
        data = JSON.parse(rawResponseText);
      } catch (parseError) {
        console.error("[HomePage DBG] Failed to parse API response as JSON:", parseError);
        console.error("[HomePage DBG] Raw text that failed to parse:", rawResponseText);
        throw new Error("Failed to parse API response. Check server logs for more details.");
      }

      console.log("[HomePage DBG] Parsed data from API (type:", typeof data, "):", JSON.stringify(data, null, 2));

      if (!response.ok) {
        console.error("[HomePage DBG] API Error Data (parsed from JSON):", data);
        throw new Error(data.error || data.details || "Simulation failed");
      }

      if (currentView === "mainSimulation") {
        console.log("[HomePage DBG] Setting simulationResults with:", data);
        setSimulationResults(data as SimulationResultItem[]);
      } else {
        console.log("[HomePage DBG] Setting periodDistributionResults with:", data);
        setPeriodDistributionResults(data as AllPeriodDistributions);
      }
    } catch (err: any) {
      console.error("[HomePage DBG] Error during simulation fetch/processing:", err);
      setError(err.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = (format: "png" | "jpeg") => {
    const targetRef = currentView === "mainSimulation" ? chartRef : periodChartsRef;
    if (targetRef.current) {
      const exportOptions =
        format === "jpeg"
          ? { quality: 0.9, backgroundColor: activeTheme.backgroundColor }
          : { backgroundColor: activeTheme.backgroundColor };
      const exporter = format === "jpeg" ? toJpeg : toPng;
      exporter(targetRef.current, exportOptions)
        .then((dataUrl) => {
          const link = document.createElement("a");
          link.download = `${currentView}-chart.${format}`;
          link.href = dataUrl;
          link.click();
        })
        .catch((err) => {
          console.error("[HomePage DBG] Export error:", err);
          setError("Failed to export chart.");
        });
    }
  };

  const inputStyle: React.CSSProperties = { marginBottom: "10px", padding: "8px", borderRadius: "4px", backgroundColor: activeTheme.inputBgColor, color: activeTheme.inputTextColor, border: `1px solid ${activeTheme.inputBorderColor}`, width: "calc(100% - 18px)", boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { marginRight: "10px", minWidth: "280px", display: "inline-block", marginBottom: "5px" };
  const buttonStyle: React.CSSProperties = { padding: "10px 20px", borderRadius: "4px", cursor: "pointer", border: "none", backgroundColor: activeTheme.buttonBgColor, color: activeTheme.buttonTextColor, marginRight: "10px", marginBottom: "10px" };
  const controlGroupStyle: React.CSSProperties = { marginBottom: "15px", padding: "10px", border: `1px solid ${activeTheme.gridColor}`, borderRadius: "5px" };
  const colorInputStyle: React.CSSProperties = { ...inputStyle, width: "100px", padding: "4px", marginLeft: "10px" };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ textAlign: "center", marginBottom: "30px" }}>
        <h1>Unprompted Message Visualizer</h1>
      </header>
      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
        <section style={{ flex: 1, minWidth: "300px" }}>
          <h2>Configuration</h2>
          <div style={controlGroupStyle}>
            <label style={labelStyle}>Chance Build Amount:</label>
            <input style={inputStyle} type="number" name="UNPROMPTED_CHANCE_BUILD_AMOUNT" value={config.UNPROMPTED_CHANCE_BUILD_AMOUNT} onChange={handleConfigChange} step="0.1" />
          </div>
          <div style={controlGroupStyle}>
            <label style={labelStyle}>Roll Interval (s):</label>
            <input style={inputStyle} type="number" name="UNPROMPTED_ROLL_INTERVAL_SECONDS" value={config.UNPROMPTED_ROLL_INTERVAL_SECONDS} onChange={handleConfigChange} />
          </div>
          <div style={controlGroupStyle}>
            <label style={labelStyle}>Build Interval (s):</label>
            <input style={inputStyle} type="number" name="UNPROMPTED_CHANCE_BUILD_INTERVAL_SECONDS" value={config.UNPROMPTED_CHANCE_BUILD_INTERVAL_SECONDS} onChange={handleConfigChange} />
          </div>
          <h3>Time Period Multipliers:</h3>
          {(Object.keys(config.unpromptedTimePeriods_multipliers) as Array<keyof TimePeriodMultipliers>).map((period) => (
            <div key={period} style={controlGroupStyle}>
              <label style={labelStyle}>{period}:</label>
              <input style={inputStyle} type="number" name={`multiplier_${period}`} value={config.unpromptedTimePeriods_multipliers[period]} onChange={handleConfigChange} step="0.1" />
            </div>
          ))}
          {currentView === "mainSimulation" && (
            <>
              <h3>Simulation Parameters:</h3>
              <div style={controlGroupStyle}>
                <label style={labelStyle}>Days to Simulate:</label>
                <input style={inputStyle} type="number" name="numDays" value={numDays} onChange={(e) => setNumDays(parseInt(e.target.value, 10))} min="1" />
              </div>
              <div style={controlGroupStyle}>
                <label style={labelStyle}>Granularity (Bins/24h):</label>
                <input style={inputStyle} type="number" name="binsPer24h" value={binsPer24h} onChange={(e) => setBinsPer24h(parseInt(e.target.value, 10))} min="1" max="1440" />
              </div>
            </>
          )}
        </section>
        <section style={{ flex: 2, minWidth: "400px" }}>
          <h2>Controls & Theme</h2>
          <div style={controlGroupStyle}>
            <button style={buttonStyle} onClick={() => setCurrentView("mainSimulation")} disabled={currentView === "mainSimulation"}>
              Main Simulation View
            </button>
            <button style={buttonStyle} onClick={() => setCurrentView("periodDistribution")} disabled={currentView === "periodDistribution"}>
              Period Distribution View
            </button>
          </div>
          <div style={controlGroupStyle}>
            <button style={buttonStyle} onClick={runCurrentSimulation} disabled={isLoading}>
              {isLoading ? "Calculating..." : "Run Calculation"}
            </button>
          </div>
          <div style={controlGroupStyle}>
            <label style={labelStyle}>Select Theme:</label>
            <select id="themeSelector" value={activeTheme.name} onChange={(e) => setActiveTheme(allThemes.find((t) => t.name === e.target.value) || defaultThemes[0])} style={{ ...inputStyle, width: "auto", minWidth: "150px" }}>
              {allThemes.map((theme) => (
                <option key={theme.name} value={theme.name}>
                  {theme.name}
                </option>
              ))}
            </select>
            {activeTheme && !defaultThemes.some((t) => t.name === activeTheme.name) && (
              <button onClick={() => deleteCustomTheme(activeTheme.name)} style={{ ...buttonStyle, backgroundColor: "#c0392b", marginLeft: "10px" }}>
                Delete "{activeTheme.name}"
              </button>
            )}
            <button onClick={() => setShowCustomThemeEditor(!showCustomThemeEditor)} style={{ ...buttonStyle, marginLeft: "10px" }}>
              {showCustomThemeEditor ? "Cancel Edit" : "Customize Theme"}
            </button>
          </div>
          {showCustomThemeEditor && (
            <div style={controlGroupStyle}>
              <h3>Custom Theme Editor</h3>
              <div><label style={labelStyle}>Name:</label><input style={inputStyle} type="text" name="name" value={customThemeEdit.name} onChange={handleCustomThemeChange} /></div>
              {(Object.keys(customThemeEdit) as Array<keyof ThemeColors>).filter(key => key !== "name").map((key) => (
                <div key={key}>
                  <label style={{...labelStyle, textTransform: "capitalize"}}>{key.replace(/([A-Z])/g, " $1").trim()}:</label>
                  <input style={colorInputStyle} type={typeof initialCustomTheme[key] === "string" && initialCustomTheme[key].startsWith("#") ? "color" : "text"} name={key} value={customThemeEdit[key]} onChange={handleCustomThemeChange} />
                </div>
              ))}
              <button onClick={saveCustomTheme} style={buttonStyle}>Save Custom Theme</button>
            </div>
          )}
          <div style={controlGroupStyle}>
            <button style={buttonStyle} onClick={() => handleExport("png")} disabled={isLoading || (!simulationResults && !periodDistributionResults)}>
              Export as PNG
            </button>
            <button style={buttonStyle} onClick={() => handleExport("jpeg")} disabled={isLoading || (!simulationResults && !periodDistributionResults)}>
              Export as JPEG
            </button>
          </div>
        </section>
      </div>

      {error && <p style={{ color: "red", textAlign: "center" }}>Error: {error}</p>}

      {currentView === "mainSimulation" && simulationResults && (
        <div ref={chartRef} style={{ marginTop: "20px", backgroundColor: activeTheme.backgroundColor, padding: "10px" }}>
          <SimulationChart data={simulationResults} themeColors={activeTheme} />
        </div>
      )}
      {currentView === "periodDistribution" && periodDistributionResults && (
        <div ref={periodChartsRef} style={{ marginTop: "20px", backgroundColor: activeTheme.backgroundColor, padding: "10px" }}>
          <PeriodDistributionChart data={periodDistributionResults} themeColors={activeTheme} />
        </div>
      )}
      {isLoading && <p style={{ textAlign: "center" }}>Loading results...</p>}
      {!isLoading && !error && currentView === "mainSimulation" && !simulationResults && <p style={{ textAlign: "center" }}>Run a simulation to see results.</p>}
      {!isLoading && !error && currentView === "periodDistribution" && !periodDistributionResults && <p style={{ textAlign: "center" }}>Run calculation for period distribution to see results.</p>}
    </div>
  );
};

export default HomePage;

