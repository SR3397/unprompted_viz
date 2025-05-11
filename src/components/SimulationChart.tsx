"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart, ReferenceLine } from 'recharts';

interface SimulationResultItem {
  time_bin: string;
  mean_messages: number;
  std_dev_messages: number;
  total_messages_in_bin: number;
  percentage_of_total: number;
  active_multiplier_period: string;
  active_multiplier_value: number;
}

interface SimulationChartProps {
  data: SimulationResultItem[];
  themeColors: {
    textColor: string;
    gridColor: string;
    tooltipBg: string;
    tooltipColor: string;
    barColor: string;
    sdLineColor: string;
  };
}

const SimulationChart: React.FC<SimulationChartProps> = ({ data, themeColors }) => {
  if (!data || data.length === 0) {
    return <p>No data to display. Run a simulation.</p>;
  }

  const chartData = data.map(item => ({
    ...item,
    meanPlusSd: item.mean_messages + item.std_dev_messages,
    meanMinusSd: Math.max(0, item.mean_messages - item.std_dev_messages), // Ensure SD doesn't go below 0
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={themeColors.gridColor} />
        <XAxis dataKey="time_bin" stroke={themeColors.textColor} />
        <YAxis label={{ value: 'Avg Messages / Bin', angle: -90, position: 'insideLeft', fill: themeColors.textColor }} stroke={themeColors.textColor} />
        <Tooltip 
          contentStyle={{ backgroundColor: themeColors.tooltipBg, color: themeColors.tooltipColor, border: `1px solid ${themeColors.gridColor}`}} 
          formatter={(value: number, name: string) => {
            if (name === "Mean Messages") return [value.toFixed(2), "Mean Messages"];
            if (name === "Std Deviation Range") return [`±${(value).toFixed(2)} (from mean)`, "Std Dev"];
            if (name === "Total Messages") return [value, "Total in Bin"];
            if (name === "Percentage of Total") return [`${value.toFixed(2)}%`, "% of Total"];
            return [value, name];
          }}
          labelFormatter={(label) => {
            const item = data.find(d => d.time_bin === label);
            return item ? `${label} (Period: ${item.active_multiplier_period}, Mult: ${item.active_multiplier_value})` : label;
          }}
        />
        <Legend wrapperStyle={{ color: themeColors.textColor }} />
        
        <Bar dataKey="mean_messages" name="Mean Messages" fill={themeColors.barColor} />

        {/* Representing SD as lines or area. For simplicity, let's use lines for upper/lower bounds */}
        {/* This is a simplified SD visualization. A proper error bar or shaded area might be more conventional but more complex with Recharts default components. */}
        {/* We can show the mean +/- SD as separate lines or a shaded area if desired, but that makes the ComposedChart more complex. */}
        {/* For now, the tooltip will show SD. We can add ReferenceLines for each point if needed, or a custom shape. */}
        {/* Let's add lines for mean + SD and mean - SD for a visual range indication */}
        <Line type="monotone" dataKey="meanPlusSd" name="Mean +1 SD" stroke={themeColors.sdLineColor} strokeDasharray="5 5" dot={false} activeDot={false} />
        <Line type="monotone" dataKey="meanMinusSd" name="Mean -1 SD" stroke={themeColors.sdLineColor} strokeDasharray="5 5" dot={false} activeDot={false} />

      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default SimulationChart;

