"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { ThemeColors } from '@/app/page'; // Assuming ThemeColors is exported from page.tsx

// Interfaces from page.tsx (or a shared types file)
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

interface PeriodDistributionChartProps {
  data: AllPeriodDistributions | null;
  themeColors: ThemeColors;
}

const PeriodChart: React.FC<{ periodData: PeriodDistributionData, periodName: string, themeColors: ThemeColors }> = ({ periodData, periodName, themeColors }) => {
  console.log(`[PeriodChart - ${periodName}] Received periodData:`, periodData);
  if (!periodData || !periodData.distribution || periodData.distribution.length === 0) {
    console.warn(`[PeriodChart - ${periodName}] No distribution data or empty distribution.`);
    return <p style={{color: themeColors.textColor}}>No distribution data for {periodName}.</p>;
  }

  // Sort data by messages to ensure correct bar order
  const sortedDistribution = [...periodData.distribution].sort((a, b) => a.messages - b.messages);
  console.log(`[PeriodChart - ${periodName}] Sorted distribution:`, sortedDistribution);

  return (
    <div style={{ marginBottom: '30px' }}>
      <h3 style={{ color: themeColors.textColor, textAlign: 'center' }}>{periodName} Period Distribution</h3>
      <p style={{ color: themeColors.textColor, textAlign: 'center', fontSize: '0.9em' }}>
        Expected Messages: {periodData.expected_messages.toFixed(2)} | 
        StdDev: {periodData.std_dev.toFixed(2)} | 
        Rel. Variation: {periodData.rel_variation.toFixed(2)}% | 
        Rolls (n): {periodData.n_trials} | 
        P(msg/roll): {periodData.p_success.toFixed(4)}
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={sortedDistribution} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={themeColors.gridColor} />
          <XAxis 
            dataKey="messages" 
            stroke={themeColors.textColor} 
            label={{ value: 'Number of Messages', position: 'insideBottom', offset: -5, fill: themeColors.textColor }}
          />
          <YAxis 
            stroke={themeColors.textColor} 
            label={{ value: 'Probability', angle: -90, position: 'insideLeft', fill: themeColors.textColor }}
            tickFormatter={(tick) => tick.toFixed(3)} // Format probability to 3 decimal places
          />
          <Tooltip 
            contentStyle={{ backgroundColor: themeColors.tooltipBg, color: themeColors.tooltipColor, border: `1px solid ${themeColors.gridColor}`}} 
            formatter={(value: number, name: string, props) => {
              if (name === "probability") return [`${(value * 100).toFixed(2)}%`, "Probability"];
              return [value, name];
            }}
            labelFormatter={(label) => `Messages: ${label}`}
          />
          <Bar dataKey="probability" name="Probability" fill={themeColors.barColor}>
            {sortedDistribution.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={themeColors.barColor} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const PeriodDistributionChart: React.FC<PeriodDistributionChartProps> = ({ data, themeColors }) => {
  console.log("[PeriodDistributionChart] Received data:", data);
  console.log("[PeriodDistributionChart] Received themeColors:", themeColors);

  if (!data) {
    console.warn("[PeriodDistributionChart] Data is null or undefined.");
    return <p style={{color: themeColors.textColor}}>No period distribution data available. Run the calculation for Period Distribution View.</p>;
  }
  if (data.error) {
    console.error("[PeriodDistributionChart] Error in period distribution data from backend:", data.error, "Type:", data.type);
    return <p style={{color: 'red'}}>Error in period distribution data: {data.error} (Type: {data.type})</p>;
  }

  const periods: (keyof AllPeriodDistributions)[] = ["Night", "Morning", "Afternoon", "Evening"];
  console.log("[PeriodDistributionChart] Processing periods:", periods);

  return (
    <div style={{ width: '100%' }}>
      {periods.map(periodName => {
        // Ensure we don't try to render charts for 'error' or 'type' properties if they exist on the data object
        if (periodName === 'error' || periodName === 'type') return null; 
        
        const periodKey = periodName as Exclude<keyof AllPeriodDistributions, 'error' | 'type'>;
        const specificPeriodData = data[periodKey];
        console.log(`[PeriodDistributionChart] Data for period ${periodKey}:`, specificPeriodData);

        if (!specificPeriodData) {
            console.warn(`[PeriodDistributionChart] No data found for period: ${periodKey}`);
            return <p key={periodName} style={{color: themeColors.textColor}}>Data for {periodName} is missing.</p>;
        }

        return (
          <PeriodChart 
            key={periodName} 
            periodData={specificPeriodData} 
            periodName={periodName} 
            themeColors={themeColors} 
          />
        );
      })}
    </div>
  );
};

export default PeriodDistributionChart;

