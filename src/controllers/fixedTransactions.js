import { supabase } from "../utils/Supabase.js";
import { getUsdRateForDate } from "../helpers/getUsdRateForDate.js";

/**
 * CRUD para fixed_transactions
 */
export const getFixedTransactionsByPlayer = async (req, res) => {
    try {
        const player_id = req.params.playerId;
        const { data, error } = await supabase
            .from("fixed_transactions")
            .select("*")
            .eq("player_id", player_id)
            .order("day_of_month", { ascending: true });

        if (error) return res.status(500).json({ error: error.message });
        res.status(200).json(data || []);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error del servidor" });
    }
};

export const createFixedTransaction = async (req, res) => {
    try {
        const { player_id, type, description, amount, currency = "ARS", day_of_month } = req.body;
        if (!player_id || !type || !amount || !day_of_month) {
            return res.status(400).json({ error: "Faltan datos obligatorios" });
        }
        const insertObj = {
            player_id,
            type,
            description,
            amount,
            currency,
            day_of_month,
            active: true,
        };
        const { data, error } = await supabase.from("fixed_transactions").insert([insertObj]).select();
        if (error) return res.status(500).json({ error: error.message });
        res.status(201).json(data[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error del servidor" });
    }
};

export const updateFixedTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = { ...req.body, updated_at: new Date().toISOString() };
        const { data, error } = await supabase.from("fixed_transactions").update(updates).eq("id", id).select();
        if (error) return res.status(500).json({ error: error.message });
        res.status(200).json(data[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error del servidor" });
    }
};

export const deleteFixedTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from("fixed_transactions").delete().eq("id", id);
        if (error) return res.status(500).json({ error: error.message });
        res.status(200).json({ message: "Movimiento fijo eliminado" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error del servidor" });
    }
};

/**
 * Función que crea transacciones del día actual para todos los fixed_transactions activos
 * - Evita duplicados: busca si existe una transaction con same fixed_id y date
 */
export const runDailyFixedTransactionJob = async () => {
    try {
        // hoy
        const today = new Date();
        const day = today.getDate();

        // Obtener fixed_transactions activos con day_of_month = day
        const { data: fixeds, error: fetchError } = await supabase
            .from("fixed_transactions")
            .select("*")
            .eq("active", true)
            .eq("day_of_month", day);

        if (fetchError) {
            console.error("Error fetching fixed_transactions:", fetchError);
            return;
        }

        for (const f of fixeds || []) {
            try {
                // armar fecha para hoy
                const dateISO = new Date(today.getFullYear(), today.getMonth(), day).toISOString();

                // verificar si ya existe transaccion creada desde este fixed (evitar duplicados)
                const { data: exists, error: existsErr } = await supabase
                    .from("transactions")
                    .select("id")
                    .eq("fixed_id", f.id)
                    .eq("date", dateISO)
                    .limit(1);

                if (existsErr) {
                    console.error("Error comprobando duplicado:", existsErr);
                    continue;
                }

                if (exists && exists.length > 0) {
                    console.log(`Ya existe transacción para fixed ${f.id} en fecha ${dateISO}`);
                    continue; // skip
                }

                // obtener usd_rate
                const usd_rate = await getUsdRateForDate(dateISO);

                // convertir si es necesario
                let amountPesos = Number(f.amount);
                if (f.currency === "USD") {
                    if (!usd_rate) {
                        console.warn(`No usd_rate para fixed ${f.id}, salto`);
                        continue;
                    }
                    amountPesos = Number(f.amount) * Number(usd_rate);
                }

                // Insertar transacción con referencia fixed_id
                const insertObj = {
                    player_id: f.player_id,
                    type: f.type,
                    description: f.description + " (fijo)",
                    amount: amountPesos,
                    date: dateISO,
                    usd_rate: usd_rate ?? null,
                    currency: "ARS",
                    fixed_id: f.id,
                    created_at: new Date().toISOString(),
                };

                const { data: insData, error: insErr } = await supabase.from("transactions").insert([insertObj]).select();

                if (insErr) {
                    console.error("Error insertando transacción fija:", insErr);
                } else {
                    console.log("Creada transacción fija:", insData?.[0]?.id);
                }
            } catch (innerErr) {
                console.error("Error procesando fixed:", innerErr);
            }
        }
    } catch (err) {
        console.error("Error en runDailyFixedTransactionJob:", err);
    }
};
