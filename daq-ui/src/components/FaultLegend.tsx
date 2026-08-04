// daq-ui/src/components/FaultLegend.tsx
import { FAULTS_METADATA } from "@/lib/faults/metadata";

export const FaultLegend = () => {
    return (
        <section className="fault-legend-wrap" aria-labelledby="fault-legend-title">
            <h3 id="fault-legend-title" className="fault-legend-header">
                Status Legend
            </h3>

            <ul
                className="fault-legend"
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    columnGap: "18px",
                    rowGap: "3px",
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    width: "100%",
                }}
            >
                {Object.entries(FAULTS_METADATA).map(([key, meta]) => (
                    <li
                        key={key}
                        className="fault-legend-item"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            minWidth: 0,
                            whiteSpace: "nowrap",
                        }}
                    >
                        <span
                            aria-hidden="true"
                            style={{
                                color: meta.color || "white",
                                fontSize: "10px",
                                lineHeight: 1,
                                flex: "0 0 auto",
                            }}
                        >
                            ●
                        </span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                            {meta.label}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
};
