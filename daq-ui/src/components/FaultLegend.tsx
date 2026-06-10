// daq-ui/src/components/ai/FaultLegend.tsx
import { FAULTS_METADATA } from "@/lib/faults/metadata"

export const FaultLegend = () => {
  return (
      <div className="legend-section">
        <h3>Fault Legend</h3>
        <ul className="legend-items">
          {Object.entries(FAULTS_METADATA).map(([key, meta]) => (
              <li key={key} className="flex items-center gap-4">
                <span className="text-sm" style={{ color: meta.color || "white" }}>⬤</span>
                <span>{meta.label}</span>
              </li>
          ))}
        </ul>
      </div>
  )
}
