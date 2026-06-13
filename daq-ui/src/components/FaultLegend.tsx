// daq-ui/src/components/ai/FaultLegend.tsx
import { FAULTS_METADATA } from "@/lib/faults/metadata"

export const FaultLegend = () => {
  return (
      <div>
        <h3 className="text-md font-semibold mb-1">Fault Legend</h3>
        <ul className="text-sm space-y-1">
          {Object.entries(FAULTS_METADATA).map(([key, meta]) => (
              <li key={key} className="flex items-center gap-2">
                <span className="text-lg" style={{ color: meta.color || "white" }}>⬤</span>
                <span>{meta.label}</span>
              </li>
          ))}
        </ul>
      </div>
  )
}
