import { usdRates } from "../utils/usdRates.js"

export async function getUsdRateForDate(dateString) {
    const d = new Date(dateString)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`

    // 🔹 Ver si la fecha es "actual" (hoy o hasta 2 días antes)
    const today = new Date()
    const diffDays = Math.floor((today - d) / (1000 * 60 * 60 * 24))

    if (diffDays >= 0 && diffDays <= 2) {
        try {
            const res = await fetch("https://api.bluelytics.com.ar/v2/latest")
            const { data } = await res.json()
            return data.blue.value_avg // promedio compra/venta
        } catch (err) {
            console.error("Error obteniendo USD actual:", err.message)
            // fallback a tabla estática si falla la API
            return usdRates[key] || null
        }
    }

    // 🔹 Si es histórico, devolver tabla estática
    return usdRates[key] || null
}
