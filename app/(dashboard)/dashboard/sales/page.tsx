import { SalesClient } from "./SalesClient"

function thirtyDaysAgo() {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
}

export default function SalesPage() {
  // Pass the same startDate the layout used so the SWR key matches the pre-fetched data
  return <SalesClient initialStartDate={thirtyDaysAgo()} />
}
