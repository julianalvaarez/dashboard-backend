import { usdRates } from "../utils/usdRates.js"
import axios from "axios"

export async function getUsdRateForDate(dateString) {
    const d = stripTime(new Date(dateString))        // fecha de la transacción
    const today = stripTime(new Date())              // fecha actual

    const diffDays = Math.floor((today - d) / (1000 * 60 * 60 * 24))

    // 🔹 Si la fecha es actual o hasta 2 días antes → pedir a la API
    if (diffDays >= 0 && diffDays <= 2) {
        try {
            const { data } = await axios.get("https://api.bluelytics.com.ar/v2/latest")
            return data?.blue?.value_avg ?? null
        } catch (err) {
            console.error("Error al obtener USD actual:", err.message)
            // fallback
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
            return usdRates[key] || null
        }
    }

    // 🔹 Si es histórico → buscar en la tabla
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    return usdRates[key] || null
}

function stripTime(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}