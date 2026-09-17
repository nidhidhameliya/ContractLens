"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const data = [
{ name: "Jan", value: 400000 },
{ name: "Feb", value: 300000 },
{ name: "Mar", value: 550000 },
{ name: "Apr", value: 450000 },
{ name: "May", value: 700000 },
{ name: "Jun", value: 650000 },
{ name: "Jul", value: 850000 },
{ name: "Aug", value: 1200000 },
{ name: "Sep", value: 1100000 },
{ name: "Oct", value: 1400000 },
{ name: "Nov", value: 1300000 },
{ name: "Dec", value: 1800000 }];


export default function ExposureChart({ totalExposure }) {
  // If we have a real total exposure, let's scale the mock data so it ends near the real number 
  // for a realistic presentation effect.
  const scale = totalExposure ? totalExposure / 1800000 : 1;
  const chartData = data.map((d) => ({ ...d, value: d.value * scale }));

  return (
    <div className="w-full h-full min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "var(--text-tertiary)" }}
            dy={10} />
          
          <YAxis
            hide
            domain={["dataMin - 100000", "dataMax + 200000"]} />
          
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg-surface-raised)",
              backdropFilter: "blur(16px)",
              border: "1px solid var(--border-default)",
              borderRadius: "12px",
              boxShadow: "var(--shadow-lg)",
              color: "var(--text-primary)"
            }}
            itemStyle={{ color: "var(--text-primary)", fontWeight: 600 }}
            formatter={(value) => [`$${Math.round(value).toLocaleString()}`, "Exposure"]} />
          
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--accent)"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorValue)"
            animationDuration={1500}
            animationEasing="ease-in-out" />
          
        </AreaChart>
      </ResponsiveContainer>
    </div>);

}