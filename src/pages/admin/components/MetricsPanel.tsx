import React from "react";
import { useRealtimeMetrics } from "../hooks/useRealtimeMetrics";

const MetricsPanel = () => {
  const metrics = useRealtimeMetrics();

  return (
    <div>
      <h2 className="text-xl font-semibold">Mai Troll Stats</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
        {Object.entries(metrics).map(([key, value]) => (
          <div key={key} className="p-3 bg-gray-800 rounded">
            <p className="text-gray-400">{key}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MetricsPanel;