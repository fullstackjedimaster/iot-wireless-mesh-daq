import { useEffect, useState } from "react"
import { getProfile } from "../../../../ai-ui/src/lib/api"
import { FaultProfile } from "../../../../ai-ui/src/lib/api"

export function useFaultStatus(pollInterval = 3000) {
    const [profile, setProfile] = useState<Record<string, FaultProfile>>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let active = true

        async function fetchStatus() {
            try {
                const data = await getProfile()
                if (active) setProfile(data)
            } catch (err) {
                console.error("Failed to fetch fault profile:", err)
            } finally {
                if (active) setLoading(false)
            }
        }

        fetchStatus()
        const interval = setInterval(fetchStatus, pollInterval)
        return () => {
            active = false
            clearInterval(interval)
        }
    }, [pollInterval])

    return { profile, loading }
}
