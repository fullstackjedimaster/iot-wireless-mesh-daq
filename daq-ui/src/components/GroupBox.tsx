import React from "react"

interface GroupBoxProps {
    title: string
    children: React.ReactNode
}

export default function GroupBox({ title, children }: GroupBoxProps) {
    return (
            <fieldset className="fieldset-section">
                <legend>
                    {title}
                </legend>
                {children}
            </fieldset>

    )
}
